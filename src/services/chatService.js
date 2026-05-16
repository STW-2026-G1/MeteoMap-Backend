/**
  * @file Servicio de Chat con IA
  * @module services/chatService
  * @description Implementa la lógica de negocio para conversaciones con asistente IA:
  * - Gestión de historial de conversación por usuario
  * - Relevancia de preguntas (guardrails)
  * - Bucle agentico con function calling
  * - Integración con herramientas (zonas, reportes, alertas, comentarios)
  * - Control de límites de uso diario
  */

const OpenAI = require("openai");
const logger = require("../config/logger");
const zoneService = require("./zoneService");
const reportService = require("./reportService");
const aemetAlertsService = require("./aemetAlertsService");
const commentService = require("./commentService");
const User = require("../models/User");
const { getHelp } = require("../config/appKnowledge");

class ChatService {
  constructor() {
    // Inicializar cliente de Mistral (usando SDK de OpenAI por compatibilidad)
    this.apiKey = process.env.MISTRAL_API_KEY;
    if (!this.apiKey) {
      logger.warn("MISTRAL_API_KEY no configurada - funcionará en modo degradado");
    }
    this.client = this.apiKey ? new OpenAI({
      apiKey: this.apiKey,
      baseURL: "https://api.mistral.ai/v1"
    }) : null;

    // Almacenamiento de historial por usuario
    this.conversationHistory = new Map();
    this.MAX_HISTORY = 10;

    // Configuración del modelo (Mistral Small es excelente para herramientas)
    this.modelName = "mistral-small-latest";
    this.temperature = 0.7;
    this.maxTokens = 1024;
  }

  // Definición de herramientas (Function Calling)
  _getTools() {
    return [
      {
        type: "function",
        function: {
          name: "list_zones",
          description: "Obtiene la lista de todas las zonas de montaña activas en el sistema. Útil para conocer qué zonas existen y sus IDs.",
          parameters: { type: "object", properties: {} }
        }
      },
      {
        type: "function",
        function: {
          name: "get_zone_weather",
          description: "Obtiene los datos meteorológicos actuales para una zona específica. IMPORTANTE: Debes proporcionar el ID técnico (ObjectId) obtenido de list_zones.",
          parameters: {
            type: "object",
            properties: {
              zoneId: { type: "string", description: "El ID técnico (ObjectId) de la zona." }
            },
            required: ["zoneId"]
          }
        }
      },
      {
        type: "function",
        function: {
          name: "get_zone_forecast",
          description: "Obtiene la predicción detallada para las próximas 12 horas. REQUIERE el ID técnico de la zona.",
          parameters: {
            type: "object",
            properties: {
              zoneId: { type: "string", description: "El ID técnico (ObjectId) de la zona." }
            },
            required: ["zoneId"]
          }
        }
      },
      {
        type: "function",
        function: {
          name: "get_zone_reports",
          description: "Obtiene los reportes de seguridad, avisos y condiciones del terreno más recientes para una zona.",
          parameters: {
            type: "object",
            properties: {
              zoneId: { type: "string", description: "ID único de la zona." },
              limit: { type: "number", description: "Límite de reportes a recuperar (por defecto 5)." }
            },
            required: ["zoneId"]
          }
        }
      },
      {
        type: "function",
        function: {
          name: "get_zone_stats",
          description: "Obtiene un resumen estadístico de la actividad y tipos de reportes en una zona.",
          parameters: {
            type: "object",
            properties: {
              zoneId: { type: "string", description: "ID único de la zona." }
            },
            required: ["zoneId"]
          }
        }
      },
      {
        type: "function",
        function: {
          name: "get_active_alerts",
          description: "Obtiene todas las alertas meteorológicas activas de AEMET (avisos de nieve, viento, lluvia, etc.). Útil para informar sobre avisos de seguridad actuales.",
          parameters: { type: "object", properties: {} }
        }
      },
      {
        type: "function",
        function: {
          name: "get_zone_comments",
          description: "Obtiene los comentarios y discusiones de la comunidad en el foro de una zona.",
          parameters: {
            type: "object",
            properties: {
              zoneId: { type: "string", description: "ID único de la zona." },
              limit: { type: "number", description: "Límite de comentarios (por defecto 10)." }
            },
            required: ["zoneId"]
          }
        }
      },
      {
        type: "function",
        function: {
          name: "get_app_help",
          description: "Obtiene instrucciones detalladas sobre cómo realizar acciones en la aplicación MeteoMap (crear reportes, editar perfil, añadir comentarios, etc.).",
          parameters: {
            type: "object",
            properties: {
              tema: { type: "string", description: "El tema o funcionalidad sobre la que el usuario tiene dudas (ej: 'reportes', 'avatar', 'comentarios')." }
            },
            required: ["tema"]
          }
        }
      }
    ];
  }



  /**
   * Punto de entrada principal para el chat
   * @param {string} pregunta - Pregunta del usuario
   * @param {string} usuario_id - ID del usuario que pregunta
   * @param {string} rol - Rol del usuario
   * @param {object} contexto - Contexto adicional (opcional)
   * @returns {object} Respuesta del asistente con datos utilizados
   */
  async getResponse(pregunta, usuario_id, rol, contexto) {
    try {
      logger.debug(`ChatService.getResponse - Usuario: ${usuario_id}, Rol: ${rol}, Pregunta: ${pregunta}`);

      // 1. Manejo de límites y estadísticas de uso
      const user = await User.findById(usuario_id);
      if (!user) throw new Error("Usuario no encontrado");

      // Solo aplicar el bloqueo si NO es ADMIN
      const userRol = user.datos_acceso?.rol || rol;
      if (userRol !== "ADMIN" && user.limites_ia.peticiones_hoy >= 10) {
        const error = new Error("Has alcanzado el límite de 10 peticiones diarias al asistente de IA.");
        error.status = 429;
        throw error;
      }

      // Incrementar contador siempre (para trackeo)
      user.limites_ia.peticiones_hoy += 1;
      await user.save();

      if (!this.client) {
        return { respuesta: "El servicio de IA no está disponible en este momento." };
      }

      // 1. Obtener historial
      const historial = this._obtenerHistorial(usuario_id);

      // 2. Verificar relevancia (Guardrail)
      const esRelevante = await this._checkRelevance(pregunta, historial);
      if (!esRelevante) {
        return {
          respuesta: "Lo siento, solo puedo responder preguntas relacionadas con MeteoMap, el clima de montaña, seguridad en el Pirineo o el funcionamiento de esta aplicación. ¿En qué puedo ayudarte respecto a estos temas?",
          analisis: { fueraDeAmbito: true }
        };
      }

      // 3. Ejecutar bucle agentico con Tools
      const resultado = await this._runAgenticLoop(pregunta, historial, usuario_id);

      // 4. Guardar en historial
      this._guardarEnHistorial(usuario_id, {
        pregunta,
        respuesta: resultado.respuesta,
        timestamp: new Date()
      });

      return resultado;
    } catch (err) {
      logger.error(`Error en ChatService.getResponse: ${err.message}`);
      throw err;
    }
  }

  /**
   * Verifica si la pregunta es relevante para el sistema (MeteoMap)
   * @private
   * @param {string} pregunta - Pregunta del usuario
   * @param {Array} historial - Historial de conversación
   * @returns {boolean} True si es relevante, false en caso contrario
   */
  async _checkRelevance(pregunta, historial) {
    try {
      const prompt = `
        Analiza si la siguiente pregunta del usuario es RELEVANTE para una aplicación de meteorología y naturaleza (MeteoMap).
        
        Temas RELEVANTES:
        - Clima, temperaturas, viento, nieve en CUALQUIER lugar (ciudades, montañas, playas, etc.).
        - Seguridad, alertas o avisos de peligro (por ejemplo, alertas de AEMET), senderismo, naturaleza y medio ambiente.
        - Información sobre picos, valles, parques naturales o geografía en general.
        - Uso de la propia aplicación MeteoMap (reportes, comentarios, favoritos, información de perfil, etc).
        - Saludos y cortesía básica.

        Temas IRRELEVANTES:
        - Recetas de cocina, política, deportes generales (fútbol, etc.).
        - Programación, historia universal no relacionada con la naturaleza.
        - Temas que no tengan NADA que ver con el clima, la geografía o la aplicación.

        Responde SOLO con un JSON: {"relevante": true} o {"relevante": false}
      `;

      // Incluir historial reciente para dar contexto al guardián
      const messagesForRelevance = [{ role: "system", content: prompt }];

      // Cogemos las últimas 2 interacciones (4 mensajes)
      historial.slice(-2).forEach(h => {
        messagesForRelevance.push({ role: "user", content: h.pregunta });
        messagesForRelevance.push({ role: "assistant", content: h.respuesta });
      });

      messagesForRelevance.push({ role: "user", content: pregunta });

      const response = await this.client.chat.completions.create({
        model: this.modelName,
        messages: messagesForRelevance,
        response_format: { type: "json_object" },
        temperature: 0
      });

      const text = response.choices[0].message.content.trim();
      const parsed = JSON.parse(text);
      return parsed.relevante === true;
    } catch (err) {
      logger.error(`Error en _checkRelevance: ${err.message}`);
      return true; // Fallback permisivo
    }
  }

  /**
   * Bucle agentico que utiliza function calling para obtener datos y generar respuesta
   * @private
   * @param {string} pregunta - Pregunta del usuario
   * @param {Array} historial - Historial de conversación
   * @param {string} usuario_id - ID del usuario
   * @returns {object} Respuesta con datos meteorológicos y información relevante
   */
  async _runAgenticLoop(pregunta, historial, usuario_id) {
    const messages = [
      {
        role: "system",
        content: `Eres el asistente experto de MeteoMap. Tu misión es ayudar a usuarios con información meteorológica y de seguridad real de distintas zonas geográficas (mayoritariamente montañosas).
        INSTRUCCIONES:
        1. Utiliza las herramientas disponibles para obtener datos REALES. No inventes temperaturas ni estados de zonas.
        2. Si el usuario pregunta por una zona o ubicación que no aparece en 'list_zones', usa las coordenadas (lat/lon) de las zonas disponibles para estimar cuál es la más cercana. Si hay alguna a una distancia razonable (ej: menos de 150km), proporciona su información aclarando EXPLICITAMENTE que son datos de una zona cercana. SI NO HAY NADA cercano en el sistema para esa región o ubicación, informa de que no tienes datos disponibles en MeteoMap para ese lugar. NUNCA inventes pronósticos, temperaturas o estados del tiempo basados en tu conocimiento interno; la información meteorológica debe provenir exclusivamente de las herramientas.
        3. Sé conciso pero prioriza la seguridad. Si hay avisos de peligro, menciónalos claramente.
        4. El ID de usuario actual es ${usuario_id}.
        5. En tu respuesta, no incluyas datos sensibles de la base de datos (como el id de los objetos almacenados).
        6. NO inventes enlaces (URLs) que no aparezcan en los datos.
        7. INTEGRIDAD GEOGRÁFICA: NUNCA inventes o cambies la ubicación de una zona. Si no conoces la ubicación EXACTA de un lugar solicitado (ej: "la EINA"), NO intentes adivinar su provincia o región. En esos casos, admite que no conoces la ubicación de ese lugar y pregunta al usuario dónde se encuentra.
        8. GUÍA DE LA APP: Si el usuario pregunta cómo hacer algo en MeteoMap (ej: '¿cómo creo un reporte?', '¿cómo cambio mi foto?'), utiliza SIEMPRE la herramienta 'get_app_help' para obtener las instrucciones oficiales. No asumas cómo funciona la interfaz por tu cuenta.`
      }
    ];

    // Agregar historial previo
    historial.forEach(h => {
      messages.push({ role: "user", content: h.pregunta });
      messages.push({ role: "assistant", content: h.respuesta });
    });

    // Agregar pregunta actual
    messages.push({ role: "user", content: pregunta });

    // Bucle para manejar llamadas a funciones
    for (let i = 0; i < 10; i++) {
      const response = await this.client.chat.completions.create({
        model: this.modelName,
        messages: messages,
        tools: this._getTools(),
        tool_choice: "auto",
        temperature: this.temperature,
      });

      const responseMessage = response.choices[0].message;

      // Si no hay llamadas a funciones, hemos terminado
      if (!responseMessage.tool_calls) {
        return {
          respuesta: responseMessage.content,
          modelo: this.modelName,
          datosUtilizados: ["tools_api"]
        };
      }

      // Procesar llamadas a funciones
      messages.push(responseMessage);

      for (const toolCall of responseMessage.tool_calls) {
        const functionName = toolCall.function.name;
        const functionArgs = JSON.parse(toolCall.function.arguments);

        logger.debug(`Mistral solicita ejecutar herramienta: ${functionName} con args: ${toolCall.function.arguments}`);

        try {
          const functionResponse = await this._executeTool(functionName, functionArgs);
          messages.push({
            tool_call_id: toolCall.id,
            role: "tool",
            name: functionName,
            content: JSON.stringify(functionResponse),
          });
        } catch (toolErr) {
          messages.push({
            tool_call_id: toolCall.id,
            role: "tool",
            name: functionName,
            content: JSON.stringify({ error: toolErr.message }),
          });
        }
      }
    }

    throw new Error("Demasiadas iteraciones en el bucle agentico");
  }

  /**
   * Ejecutor de herramientas locales
   * @private
   * @param {string} name - Nombre de la herramienta a ejecutar
   * @param {object} args - Argumentos para la herramienta
   * @returns {object} Resultado de la ejecución
   */
  async _executeTool(name, args) {
    switch (name) {
      case "list_zones":
        const allZones = await zoneService.getZones("ACTIVA");
        // Devolver nombre e id con coordenadas para que la IA pueda estimar cercanía
        return allZones.zones.map(z => ({
          id: z._id,
          nombre: z.nombre,
          lat: z.geolocalizacion?.coordinates[1],
          lon: z.geolocalizacion?.coordinates[0]
        }));

      case "get_zone_weather":
        const weather = await zoneService.getWeatherData(args.zoneId);
        // Filtrar datos meteorológicos para ser concisos
        return {
          temperatura: weather.current?.temperature,
          viento: weather.current?.wind,
          humedad: weather.current?.humidity,
          estado: weather.current?.weather_descriptions
        };

      case "get_zone_forecast":
        const forecast = await zoneService.getWeatherForecast(args.zoneId);
        return forecast; // Las predicciones suelen ser manejables

      case "get_zone_reports":
        const reportsResult = await reportService.getReports({ zonaId: args.zoneId, limit: args.limit || 5 });
        const reports = reportsResult.reports || [];
        // Solo lo relevante de los reportes
        return reports.map(r => ({
          categoria: r.categoria_id?.nombre,
          comentario: r.contenido?.descripcion,
          nivelRiesgo: r.nivelRiesgo,
          fecha: r.createdAt
        }));

      case "get_zone_stats":
        return await zoneService.getZoneDashboard(args.zoneId);

      case "get_active_alerts":
        const alerts = await aemetAlertsService.fetchAlerts();
        // Devolver solo lo esencial para no saturar de tokens
        return alerts.map(a => ({
          fenomeno: a.fenomeno,
          nivel: a.nivel,
          descripcion: a.descripcion,
          comienzo: a.comienzo,
          fin: a.fin,
          provincias: a.provincias
        }));

      case "get_zone_comments":
        const commentsResult = await commentService.getCommentsByZone(args.zoneId, args.limit || 10);
        const comments = commentsResult.comments || [];
        return comments.map(c => ({
          usuario: c.usuario_id?.perfil?.nombre || "Usuario",
          texto: c.contenido,
          fecha: c.createdAt
        }));

      case "get_app_help":
        return { helpText: getHelp(args.tema) };

      default:
        throw new Error(`Herramienta '${name}' no implementada.`);
    }
  }

  /**
   * Gestionar historial de conversación por usuario
   * @private
   * @param {string} usuario_id - ID del usuario
   * @returns {Array} Array del historial (últimos MAX_HISTORY mensajes)
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
   * @param {string} usuario_id - ID del usuario
   * @param {object} mensaje - Objeto con pregunta, respuesta y timestamp
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
   * @param {string} usuario_id - ID del usuario
   */
  limpiarHistorial(usuario_id) {
    this.conversationHistory.delete(usuario_id);
    logger.info(`Historial de conversación limpiado para usuario: ${usuario_id}`);
  }


}

module.exports = new ChatService();