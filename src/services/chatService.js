const { GoogleGenerativeAI } = require("@google/generative-ai");
const logger = require("../config/logger");
const Zone = require("../models/Zone");
const Report = require("../models/Report");
const User = require("../models/User");
const zoneService = require("./zoneService");
const reportService = require("./reportService");

class ChatService {
  constructor() {
    // Inicializar cliente de Gemini
    this.apiKey = process.env.GEMINI_API_KEY;
    if (!this.apiKey) {
      logger.warn("GEMINI_API_KEY no configurada - funcionará en modo degradado");
    }
    this.client = this.apiKey ? new GoogleGenerativeAI(this.apiKey) : null;
    
    // Almacenamiento de historial por usuario (in-memory, en producción usar Redis/DB)
    this.conversationHistory = new Map();
    this.MAX_HISTORY = 10; // Mantener últimos 10 mensajes por usuario
  }

  Model = "gemini-3-flash-preview";
  TEMPERATURE = 0.7;
  MAX_TOKENS = 1024;



  /**
   * Chatbot inteligente que accede a todos los endpoints
   * Analiza la pregunta, obtiene datos contextuales y genera respuestas basadas en BD
   */
  async getResponse(pregunta, usuario_id, contextoAdicional = null) {
    try {
      logger.debug(`ChatService.getResponse - Usuario: ${usuario_id}, Pregunta: ${pregunta}`);

      // 1. Obtener historial de conversación del usuario
      const historial = this._obtenerHistorial(usuario_id);
      
      // 2. Analizar intenciones y entidades de la pregunta
      const analisis = await this._analizarPreguntaInteligente(pregunta, historial);
      logger.debug(`Análisis: ${JSON.stringify(analisis)}`);

      // 3. Obtener datos enriquecidos de la BD
      const datosContexto = await this._obtenerDatosEnriquecidos(
        analisis,
        usuario_id,
        historial
      );
      logger.debug(`Datos obtenidos: ${Object.keys(datosContexto).join(", ")}`);

      // 4. Generar respuesta con prompts mejorados
      const respuestaFinal = await this._generarRespuestaAvanzada(
        pregunta,
        analisis,
        datosContexto,
        historial,
        usuario_id
      );

      // 5. Guardar en historial
      this._guardarEnHistorial(usuario_id, {
        pregunta,
        respuesta: respuestaFinal.respuesta,
        timestamp: new Date(),
        analisis: analisis.tipo,
      });

      return respuestaFinal;
    } catch (err) {
      logger.error(`Error en ChatService.getResponse: ${err.message}`);
      throw err;
    }
  }

  /**
   * Gestionar historial de conversación por usuario
   * @private
   */
  _obtenerHistorial(usuario_id) {
    if (!this.conversationHistory.has(usuario_id)) {
      this.conversationHistory.set(usuario_id, []);
    }
    return this.conversationHistory.get(usuario_id);
  }

  /**
   * Guardar mensaje en historial
   * @private
   */
  _guardarEnHistorial(usuario_id, mensaje) {
    const historial = this._obtenerHistorial(usuario_id);
    historial.push(mensaje);
    
    // Mantener solo los últimos MAX_HISTORY mensajes
    if (historial.length > this.MAX_HISTORY) {
      historial.shift();
    }
  }

  /**
   * Limpiar historial de un usuario
   */
  limpiarHistorial(usuario_id) {
    this.conversationHistory.delete(usuario_id);
    logger.info(`Historial de conversación limpiado para usuario: ${usuario_id}`);
  }

  /**
   * Análisis inteligente de intenciones usando Gemini + análisis de historial
   * @private
   */
  async _analizarPreguntaInteligente(pregunta, historial) {
    try {
      if (!this.client) {
        return this._analizarPreguntaPorPalabrasClaves(pregunta);
      }

      // Construir contexto de historial para mejores resultados
      let contextHistorial = "";
      if (historial.length > 0) {
        const ultimasPreguntas = historial.slice(-3).map(h => h.pregunta).join(" | ");
        contextHistorial = `Preguntas anteriores del usuario: ${ultimasPreguntas}\n`;
      }

      const model = this.client.getGenerativeModel({ model: this.Model });

      const prompt = `
        Eres un analizador de intenciones para un sistema de información sobre montañismo.
        Analiza esta pregunta y extrae la información exacta.
        Responde SOLO con un JSON válido (sin markdown).
        
        ${contextHistorial}
        Pregunta actual: "${pregunta}"
        
        Responde exactamente con este formato:
        {
          "intencion": "informacion|recomendacion|comparacion|analisis|ayuda|general",
          "entidadPrincipal": "zona|clima|reporte|usuario|actividad",
          "zonasRelevantes": ["nombre_zona_1", "nombre_zona_2"] o [],
          "tiposReporte": ["tipo1", "tipo2"] o [],
          "palabrasClave": ["clave1", "clave2"],
          "requiereAnalisis": true|false,
          "urgencia": "baja|normal|alta",
          "dominio": "meteorologia|seguridad|experiencia|general"
        }
      `;

      const result = await model.generateContent(prompt);
      const response = await result.response;
      const text = response.text().trim();
      
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        logger.warn("No se pudo extraer JSON del análisis de intenciones");
        return this._analizarPreguntaPorPalabrasClaves(pregunta);
      }

      return JSON.parse(jsonMatch[0]);
    } catch (err) {
      logger.error(`Error en _analizarPreguntaInteligente: ${err.message}`);
      return this._analizarPreguntaPorPalabrasClaves(pregunta);
    }
  }

  /**
   * Análisis robusto por palabras clave (fallback)
   * @private
   */
  async _analizarPreguntaPorPalabrasClaves(pregunta) {
    const lower = pregunta.toLowerCase();

    // Detectar intención
    let intencion = "general";
    if (lower.includes("recomiend") || lower.includes("sugier")) intencion = "recomendacion";
    else if (lower.includes("compar")) intencion = "comparacion";
    else if (lower.includes("analiz") || lower.includes("estadístic")) intencion = "analisis";
    else if (lower.includes("¿") || lower.includes("?")) intencion = "informacion";

    // Detectar dominio
    let dominio = "general";
    if (lower.includes("clima") || lower.includes("tiempo") || lower.includes("temperatura")) dominio = "meteorologia";
    if (lower.includes("peligr") || lower.includes("riesgo") || lower.includes("segur")) dominio = "seguridad";
    if (lower.includes("experiencia") || lower.includes("opinión") || lower.includes("reseña")) dominio = "experiencia";

    // Detectar entidad principal
    let entidadPrincipal = "general";
    if (lower.includes("zona") || lower.includes("montaña") || lower.includes("pico")) entidadPrincipal = "zona";
    if (lower.includes("clima") || lower.includes("tiempo") || lower.includes("meteo")) entidadPrincipal = "clima";
    if (lower.includes("reporte") || lower.includes("aviso") || lower.includes("alerta")) entidadPrincipal = "reporte";

    return {
      intencion,
      entidadPrincipal,
      zonasRelevantes: [],
      tiposReporte: [],
      palabrasClave: this._extraerPalabrasClave(pregunta),
      requiereAnalisis: intencion === "analisis" || intencion === "comparacion",
      urgencia: lower.includes("urgente") || lower.includes("ahora") ? "alta" : "normal",
      dominio,
    };
  }

  /**
   * Extraer palabras clave de la pregunta
   * @private
   */
  _extraerPalabrasClave(pregunta) {
    const palabrasComunes = ["es", "el", "la", "en", "que", "de", "a", "y", "o", "pero", "como", "para", "por", "con"];
    const palabras = pregunta.toLowerCase()
      .split(/[\s,.:;!?]+/)
      .filter(p => p.length > 3 && !palabrasComunes.includes(p));
    
    return [...new Set(palabras)].slice(0, 5);
  }

  /**
   * Obtener datos enriquecidos de la BD con análisis y correlaciones
   * @private
   */
  async _obtenerDatosEnriquecidos(analisis, usuario_id, historial) {
    const datos = {
      timestamp: new Date(),
      fuentes: [],
    };

    try {
      // Obtener zonas activas
      if (analisis.entidadPrincipal === "zona" || analisis.intencion === "comparacion") {
        try {
          const resultado = await zoneService.getZones("ACTIVA");
          
          if (resultado && resultado.zones.length > 0) {
            datos.zonas = resultado.zones.map((z) => ({
              _id: z._id,
              nombre: z.nombre,
              descripcion: z.descripcion,
              dificultad: z.dificultad,
              altitud: z.altitud,
              coordenadas: z.geolocalizacion?.coordinates,
              estado: z.estado,
            }));
            datos.fuentes.push("zonas");
          }
        } catch (err) {
          logger.error(`Error obteniendo zonas: ${err.message}`);
        }
      }

      // Obtener clima y pronóstico si es relevante
      if (analisis.entidadPrincipal === "clima" || analisis.dominio === "meteorologia") {
        try {
          const zonas = datos.zonas || (await zoneService.getZones("ACTIVA")).zones;
          
          // TODO Obtener clima de zonas nombradas
          const climatData = [];
         
          
          if (climatData.length > 0) {
            datos.clima = climatData;
            datos.fuentes.push("meteorologia");
          }
        } catch (err) {
          logger.error(`Error obteniendo datos climáticos: ${err.message}`);
        }
      }

      // Obtener reportes recientes con análisis
      if (analisis.entidadPrincipal === "reporte" || analisis.dominio === "seguridad") {
        try {
          const resultado = await reportService.getReports({ limit: 15 });
          
          if (resultado && resultado.reports.length > 0) {
            datos.reportes = await this._analizarReportes(resultado.reports);
            datos.fuentes.push("reportes");
          }
        } catch (err) {
          logger.error(`Error obteniendo reportes: ${err.message}`);
        }
      }

      // Obtener información del usuario si existe
      if (usuario_id) {
        try {
          const user = await User.findById(usuario_id).lean();
          if (user) {
            datos.usuario = {
              nombre: user.nombre,
              email: user.email,
              zonasFavoritas: user.zonas_favoritas || [],
            };
            datos.fuentes.push("usuario");
          }
        } catch (err) {
          logger.warn(`No se pudo obtener información del usuario: ${err.message}`);
        }
      }

      logger.debug(`Datos enriquecidos obtenidos de: ${datos.fuentes.join(", ")}`);
      return datos;
    } catch (err) {
      logger.error(`Error en _obtenerDatosEnriquecidos: ${err.message}`);
      return datos;
    }
  }

  /**
   * Analizar reportes y extraer insights
   * @private
   */
  async _analizarReportes(reportes) {
    const analisis = {
      total: reportes.length,
      porTipo: {},
      recientes: [],
      criticos: [],
    };

    for (const reporte of reportes) {
      // Contar por tipo
      const tipo = reporte.tipo || "general";
      analisis.porTipo[tipo] = (analisis.porTipo[tipo] || 0) + 1;

      // Últimos 5 reportes
      if (analisis.recientes.length < 5) {
        analisis.recientes.push({
          tipo: reporte.tipo,
          zona: reporte.zona_id?.nombre || "Desconocida",
          titulo: reporte.categoria?.nombre || "Reporte",
          descripcion: reporte.contenido?.descripcion || "",
          fecha: reporte.createdAt,
          validaciones: reporte.validaciones || {},
        });
      }

      // Reportes críticos/validados
      const validaciones = reporte.validaciones || {};
      const ratio = validaciones.confirmaciones / Math.max(validaciones.confirmaciones + validaciones.desmentidos, 1);
      if (ratio > 0.7 && validaciones.confirmaciones >= 2) {
        analisis.criticos.push({
          tipo: reporte.tipo,
          zona: reporte.zona_id?.nombre || "Desconocida",
          descripcion: reporte.contenido?.descripcion || "",
          confirmaciones: validaciones.confirmaciones,
        });
      }
    }

    return analisis;
  }

  /**
   * Generar respuesta avanzada usando Gemini con prompts contextuales
   * @private
   */
  async _generarRespuestaAvanzada(pregunta, analisis, datosContexto, historial, usuario_id) {
    try {
      if (!this.client) {
        return this._generarRespuestaFallback(pregunta, datosContexto, analisis);
      }

      const model = this.client.getGenerativeModel({
        model: this.Model,
        generationConfig: {
          temperature: this.TEMPERATURE,
          maxOutputTokens: this.MAX_TOKENS,
        },
      });

      // Construir contexto enriquecido
      const contextoDatos = this._construirContextoDatos(datosContexto);
      const contextoHistorial = this._construirContextoHistorial(historial);

      const prompt = `
Eres un asistente experto en montañismo, seguridad en altura y meteorología.
Tienes acceso a una base de datos con información real de zonas, reportes de seguridad y datos meteorológicos.

**INSTRUCCIONES IMPORTANTES:**
1. Basa SIEMPRE tu respuesta en los datos reales proporcionados, no en supuestos
2. Si no tienes datos sobre algo, admítelo claramente
3. Sé específico: menciona nombres reales de zonas, coordenadas, temperaturas exactas
4. Destaca información crítica: alertas de seguridad, reportes validados, cambios de clima
5. Proporciona recomendaciones prácticas y fundamentadas
6. Sé conciso pero completo (máximo 3-4 párrafos)

**CONTEXTO DEL USUARIO:**
- ID: ${usuario_id}
${contextoHistorial ? `- Historial: ${contextoHistorial}` : ""}

**DATOS DISPONIBLES EN LA BASE DE DATOS:**
${contextoDatos}

**INTENCIÓN DEL USUARIO:**
- Tipo: ${analisis.intencion}
- Dominio: ${analisis.dominio}
- Urgencia: ${analisis.urgencia}
- Palabras clave: ${analisis.palabrasClave.join(", ")}

**PREGUNTA:**
${pregunta}

**RESPUESTA:**
Proporciona una respuesta natural, útil y basada ÚNICAMENTE en los datos disponibles.
Si necesitas aclaraciones o hay información faltante, solicítala.
`;

      const result = await model.generateContent(prompt);
      const response = await result.response;
      const respuesta = response.text();

      // Extraer sugerencias de seguimiento
      const sugerencias = this._generarSugerencias(analisis, datosContexto);

      logger.debug("Respuesta generada exitosamente por Gemini");

      return {
        respuesta,
        modelo: this.Model,
        analisis: {
          intencion: analisis.intencion,
          dominio: analisis.dominio,
          urgencia: analisis.urgencia,
        },
        datosUtilizados: datosContexto.fuentes || [],
        sugerencias,
      };
    } catch (err) {
      logger.error(`Error generando respuesta avanzada: ${err.message}`);
      return `Error generando respuesta avanzada: ${err.message}`
    }
  }

  /**
   * Construir contexto de datos para el prompt
   * @private
   */
  _construirContextoDatos(datosContexto) {
    let contexto = "";

    if (datosContexto.zonas && datosContexto.zonas.length > 0) {
      contexto += "\n**ZONAS DISPONIBLES:**\n";
      datosContexto.zonas.forEach((z) => {
        contexto += `- ${z.nombre} (Dificultad: ${z.dificultad}, Altitud: ${z.altitud}m): ${z.descripcion}\n`;
      });
    }

    if (datosContexto.clima && datosContexto.clima.length > 0) {
      contexto += "\n**DATOS METEOROLÓGICOS ACTUALES:**\n";
      datosContexto.clima.forEach((c) => {
        contexto += `- ${c.zona}: ${JSON.stringify(c.clima).substring(0, 100)}...\n`;
      });
    }

    if (datosContexto.reportes) {
      contexto += "\n**REPORTES DE SEGURIDAD:**\n";
      if (datosContexto.reportes.criticos.length > 0) {
        contexto += "CRÍTICOS:\n";
        datosContexto.reportes.criticos.forEach((r) => {
          contexto += `- ${r.zona}: ${r.descripcion} (${r.confirmaciones} confirmaciones)\n`;
        });
      }
      if (datosContexto.reportes.recientes.length > 0) {
        contexto += "RECIENTES:\n";
        datosContexto.reportes.recientes.forEach((r) => {
          contexto += `- ${r.zona}: ${r.titulo} (${r.fecha})\n`;
        });
      }
    }

    if (datosContexto.usuario) {
      contexto += `\n**USUARIO:** ${datosContexto.usuario.nombre}\n`;
      if (datosContexto.usuario.zonasFavoritas.length > 0) {
        contexto += `Zonas favoritas: ${datosContexto.usuario.zonasFavoritas.join(", ")}\n`;
      }
    }

    return contexto || "No hay datos disponibles en la base de datos para esta consulta.";
  }

  /**
   * Construir contexto del historial de conversación
   * @private
   */
  _construirContextoHistorial(historial) {
    if (!historial || historial.length === 0) return "";
    
    const ultimosMensajes = historial.slice(-3);
    return ultimosMensajes
      .map((m) => `${m.pregunta} → ${m.analisis}`)
      .join(" | ");
  }

  /**
   * Generar sugerencias de preguntas de seguimiento
   * @private
   */
  _generarSugerencias(analisis, datosContexto) {
    const sugerencias = [];

    if (analisis.dominio === "meteorologia" && datosContexto.clima) {
      sugerencias.push("¿Cuál es el pronóstico de lluvia para esta zona?");
      sugerencias.push("¿A qué hora será el mejor momento para visitar?");
    }

    if (analisis.dominio === "seguridad" && datosContexto.reportes?.criticos.length > 0) {
      sugerencias.push("¿Cuáles son las medidas de prevención recomendadas?");
      sugerencias.push("¿Hay alternativas más seguras en otras zonas?");
    }

    if (datosContexto.zonas && datosContexto.zonas.length > 1) {
      sugerencias.push("¿Cómo se comparan estas zonas en dificultad?");
      sugerencias.push("¿Cuál es la mejor época para visitar?");
    }

    return sugerencias.slice(0, 2);
  }

 
}

module.exports = new ChatService();