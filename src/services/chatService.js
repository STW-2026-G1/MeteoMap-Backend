const { GoogleGenerativeAI } = require("@google/generative-ai");
const logger = require("../config/logger");
const Zone = require("../models/Zone");
const Report = require("../models/Report");
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
  }

    Model = "gemini-3-flash-preview";
  /**
   * Chatbot inteligente que accede a todos los endpoints
   * Analiza la pregunta y decide qué datos obtener
   */
  async getResponse(pregunta, usuario_id, contexto = null) {
    try {
      logger.debug(`ChatService.getResponse - Pregunta: ${pregunta}`);

      // 1. Analizar qué tipo de información necesita con Gemini
      const tiposInfo = await this._analizarPregunta(pregunta);
      logger.debug(`Tipos de información detectados: ${JSON.stringify(tiposInfo)}`);

      // 2. Obtener datos según lo que necesita
      const datosContexto = await this._obtenerDatos(tiposInfo, usuario_id);
      logger.debug(`Datos obtenidos: ${Object.keys(datosContexto).join(", ")}`);

      // 3. Generar respuesta en lenguaje natural con Gemini
      const respuestaFinal = await this._generarRespuesta(
        pregunta,
        datosContexto,
        contexto
      );

      return respuestaFinal;
    } catch (err) {
      logger.error(`Error en ChatService.getResponse: ${err.message}`);
      throw err;
    }
  }

  /**
   * Analizar la pregunta para determinar qué tipos de información se necesitan
   * @private
   */
  async _analizarPregunta(pregunta) {
    try {
      if (!this.client) {
        // Si no hay API key, usar análisis simple por palabras clave
        return this._analizarPreguntaPorPalabrasClaves(pregunta);
      }

      const model = this.client.getGenerativeModel({
        model: this.Model,
      });

      const prompt = `
        Analiza esta pregunta y determina qué información se necesita de una API de montañismo.
        Responde SOLO con un JSON válido (sin markdown, sin explicaciones adicionales).
        
        Pregunta: "${pregunta}"
        
        Responde con este formato exacto:
        {
          "necesitaZonas": boolean,
          "necesitaClima": boolean,
          "necesitaReportes": boolean,
          "necesitaUsuarios": boolean,
          "necesitaComentarios": boolean,
          "zonaEspecifica": "nombre_zona o null",
          "tipo": "informacion|recomendacion|analisis|ayuda"
        }
      `;

      const result = await model.generateContent(prompt);
      const response = await result.response;
      const text = response.text().trim();
      logger.debug(`Resultado de analizar pregunta: ${text}`);
      // Extraer JSON del texto
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        logger.warn("No se pudo extraer JSON de la respuesta de Gemini");
        return this._analizarPreguntaPorPalabrasClaves(pregunta);
      }

      return JSON.parse(jsonMatch[0]);
    } catch (err) {
      logger.error(`Error en _analizarPregunta: ${err.message}`);
      return this._analizarPreguntaPorPalabrasClaves(pregunta);
    }
  }

  /**
   * Análisis simple por palabras clave (fallback)
   * @private
   */
  async _analizarPreguntaPorPalabrasClaves(pregunta) {
    const lower = pregunta.toLowerCase();

    return {
      necesitaZonas:
        lower.includes("zona") ||
        lower.includes("montaña") ||
        lower.includes("pico") ||
        lower.includes("sierra"),
      necesitaClima:
        lower.includes("clima") ||
        lower.includes("tiempo") ||
        lower.includes("meteo") ||
        lower.includes("lluvia") ||
        lower.includes("temperatura"),
      necesitaReportes:
        lower.includes("reporte") ||
        lower.includes("aviso") ||
        lower.includes("peligro") ||
        lower.includes("riesgo"),
      necesitaUsuarios:
        lower.includes("usuario") || lower.includes("perfil"),
      necesitaComentarios:
        lower.includes("comentario") ||
        lower.includes("opinión") ||
        lower.includes("experiencia"),
      zonaEspecifica: await this._extraerNombreZona(pregunta),
      tipo: lower.includes("recomend")
        ? "recomendacion"
        : lower.includes("¿")
          ? "informacion"
          : "analisis",
    };
  }

  /**
   * Intentar extraer un nombre de zona específica de la pregunta
   * Busca en la BD real en lugar de usar valores hardcodeados
   * @private
   */
  async _extraerNombreZona(pregunta) {
    try {
      // Obtener todas las zonas de la BD
      const zonas = await Zone.find({ estado: "ACTIVA" }, "nombre").lean();
      
      if (!zonas || zonas.length === 0) {
        return null;
      }

      const preguntaLower = pregunta.toLowerCase();

      // Buscar coincidencias de nombres de zona en la pregunta
      for (const zona of zonas) {
        if (preguntaLower.includes(zona.nombre.toLowerCase())) {
          return zona.nombre;
        }
      }

      return null;
    } catch (err) {
      logger.error(`Error extrayendo nombre de zona: ${err.message}`);
      return null;
    }
  }

  /**
   * Obtener datos de los endpoints según lo que se necesita
   * Utiliza los servicios ya existentes revisar si es eficiciente y/o necesario para cada caso
   * @private
   */
  async _obtenerDatos(tiposInfo, usuario_id) {
    const datos = {};

    try {
      // Obtener zonas usando ZoneService
      if (tiposInfo.necesitaZonas) {
        try {
          // Obtener todas las zonas activas
          const resultado = await zoneService.getZones("ACTIVA");
          
          if (tiposInfo.zonaEspecifica) {
            // Buscar zona específica
            const zonaEspecifica = resultado.zones.find(
              (z) => z.nombre.toLowerCase() === tiposInfo.zonaEspecifica.toLowerCase()
            );
            
            if (zonaEspecifica) {
              datos.zonaEspecifica = {
                nombre: zonaEspecifica.nombre,
                descripcion: zonaEspecifica.descripcion,
                estado: zonaEspecifica.estado,
                dificultad: zonaEspecifica.dificultad,
                coordenadas: zonaEspecifica.geolocalizacion?.coordinates,
              };
            }
          } else {
            // Obtener primeras 5 zonas
            datos.zonas = resultado.zones.slice(0, 5).map((z) => ({
              nombre: z.nombre,
              descripcion: z.descripcion,
              estado: z.estado,
              dificultad: z.dificultad,
            }));
          }
        } catch (err) {
          logger.error(`Error obteniendo zonas en ChatService: ${err.message}`);
        }
      }

      // Obtener datos de clima usando ZoneService
      // Esto usará caché y lo actualizará si es necesario
      if (tiposInfo.necesitaClima && datos.zonaEspecifica) {
        try {
          // Primero obtener la zona por nombre
          const zonas = await zoneService.getZones("ACTIVA");
          const zona = zonas.zones.find(
            (z) => z.nombre.toLowerCase() === tiposInfo.zonaEspecifica.toLowerCase()
          );

          if (zona && zona._id) {
            // Usar getWeatherData que maneja caché automáticamente
            const weatherData = await zoneService.getWeatherData(zona._id);
            datos.clima = weatherData;
          }
        } catch (err) {
          logger.error(`Error obteniendo clima en ChatService: ${err.message}`);
          // Fallback: usar datos crudos del caché si es que existen
          if (datos.zonaEspecifica?.cache_meteo?.datos_crudos) {
            datos.clima = datos.zonaEspecifica.cache_meteo.datos_crudos;
          }
        }
      }

      // Obtener reportes recientes usando ReportService
      if (tiposInfo.necesitaReportes) {
        try {
          // Si hay zona específica, filtrar reportes de esa zona
          const filtros = tiposInfo.zonaEspecifica 
            ? { zona: tiposInfo.zonaEspecifica, limit: 10 }
            : { limit: 10 };
          
          const resultado = await reportService.getReports(filtros);
          datos.reportesRecientes = resultado.reports.map((r) => ({
            tipo: r.tipo,
            titulo: r.categoria?.nombre || "Reporte",
            descripcion: r.contenido?.descripcion || "",
            zona: r.zona_id?.nombre,
            fecha: r.createdAt,
            validaciones: {
              confirmaciones: r.validaciones?.confirmaciones || 0,
              desmentidos: r.validaciones?.desmentidos || 0,
            },
          }));
        } catch (err) {
          logger.error(`Error obteniendo reportes en ChatService: ${err.message}`);
        }
      }
    } catch (err) {
      logger.error(`Error obteniendo datos en ChatService: ${err.message}`);
    }

    return datos;
  }

  /**
   * Generar respuesta en lenguaje natural usando Gemini
   * @private
   */
  async _generarRespuesta(pregunta, datosContexto, contextoUsuario) {
    try {
      if (!this.client) {
        return this._generarRespuestaBasica(pregunta, datosContexto);
      }

      const model = this.client.getGenerativeModel({
        model: this.Model,
      });

      // Construcción del prompt con contexto de datos
      let promptContexto = "";
      if (datosContexto.zonas) {
        promptContexto += `\nZonas disponibles: ${JSON.stringify(datosContexto.zonas)}`;
      }
      if (datosContexto.zonaEspecifica) {
        promptContexto += `\nInformación de zona: ${JSON.stringify(datosContexto.zonaEspecifica)}`;
      }
      if (datosContexto.clima) {
        promptContexto += `\nDatos meteorológicos: ${JSON.stringify(datosContexto.clima)}`;
      }
      if (datosContexto.reportesRecientes) {
        promptContexto += `\nReportes recientes: ${JSON.stringify(datosContexto.reportesRecientes.slice(0, 3))}`;
      }

      const prompt = `
        Eres un asistente experto en montañismo y seguridad en zonas de montaña.
        Responde siempre en lenguaje natural, amable y conciso.
        
        Datos disponibles:${promptContexto}
        
        Pregunta del usuario: "${pregunta}"
        ${contextoUsuario ? `Contexto adicional: ${contextoUsuario}` : ""}
        
        Proporciona una respuesta útil, clara y basada en los datos disponibles.
        Si no tienes información específica, sugiere opciones generales.
      `;

      const result = await model.generateContent(prompt);
      const response = await result.response;
      const respuesta = response.text();

      logger.debug("Respuesta generada exitosamente por Gemini");

      return {
        respuesta,
        modelo: this.Model,
        datosUtilizados: Object.keys(datosContexto).filter(
          (k) => datosContexto[k] !== undefined
        ),
      };
    } catch (err) {
      logger.error(`Error generando respuesta: ${err.message}`);
      return this._generarRespuestaBasica(pregunta, datosContexto);
    }
  }

  /**
   * Generar respuesta básica sin Gemini (fallback)
   * @private
   */
  _generarRespuestaBasica(pregunta, datosContexto) {
    let respuesta = "Te ayudaré con tu pregunta sobre montañismo.\n\n";

    if (datosContexto.zonaEspecifica) {
      respuesta += `Sobre ${datosContexto.zonaEspecifica.nombre}: ${datosContexto.zonaEspecifica.descripcion}\n`;
    }

    if (datosContexto.zonas && datosContexto.zonas.length > 0) {
      respuesta += `Zonas disponibles: ${datosContexto.zonas.map((z) => z.nombre).join(", ")}\n`;
    }

    if (datosContexto.clima) {
      respuesta += `Condiciones meteorológicas: Temperatura ${datosContexto.clima.temperatura}°C, Humedad ${datosContexto.clima.humedad}%\n`;
    }

    if (datosContexto.reportesRecientes && datosContexto.reportesRecientes.length > 0) {
      respuesta += `Reportes recientes: ${datosContexto.reportesRecientes.length} reportes en el sistema\n`;
    }

    return {
      respuesta: respuesta || "No tengo información específica para tu pregunta.",
      modelo: "fallback-basico",
      datosUtilizados: Object.keys(datosContexto).filter(
        (k) => datosContexto[k] !== undefined
      ),
    };
  }
}

module.exports = new ChatService();