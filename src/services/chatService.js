const OpenAI = require("openai");
const logger = require("../config/logger");
const zoneService = require("./zoneService");
const reportService = require("./reportService");

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
      }
    ];
  }



  /**
   * Punto de entrada principal para el chat
   */
  async getResponse(pregunta, usuario_id) {
    try {
      logger.debug(`ChatService.getResponse - Usuario: ${usuario_id}, Pregunta: ${pregunta}`);

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
   */
  async _checkRelevance(pregunta, historial) {
    try {
      const prompt = `
        Analiza si la siguiente pregunta del usuario es RELEVANTE para una aplicación de meteorología y naturaleza (MeteoMap).
        
        Temas RELEVANTES:
        - Clima, temperaturas, viento, nieve en CUALQUIER lugar (ciudades, montañas, playas, etc.).
        - Seguridad, avisos de peligro, senderismo, naturaleza y medio ambiente.
        - Información sobre picos, valles, parques naturales o geografía en general.
        - Uso de la propia aplicación MeteoMap.
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
   */
  async _runAgenticLoop(pregunta, historial, usuario_id) {
    const messages = [
      {
        role: "system",
        content: `Eres el asistente experto de MeteoMap. Tu misión es ayudar a usuarios con información meteorológica y de seguridad real de distintas zonas geográficas (mayoritariamente montañosas).
        INSTRUCCIONES:
        1. Utiliza las herramientas disponibles para obtener datos REALES. No inventes temperaturas ni estados de zonas.
        2. Si el usuario pregunta por una zona que no aparece en 'list_zones', usa las coordenadas (lat/lon) de las zonas disponibles para estimar cuál es la más cercana. Proporciona la información aclarando EXPLICITAMENTE que son datos de una zona cercana y menciona la distancia estimada si es posible. Si no hay nada a una distancia razonable (ej: más de 150km), informa de que no tienes datos para esa región.
        3. Sé conciso pero prioriza la seguridad. Si hay avisos de peligro, menciónalos claramente.
        4. El ID de usuario actual es ${usuario_id}.
        5. En tu respuesta, no incluyas datos sensibles de la base de datos (como el id de los objetos almacenados).
        6. NO inventes enlaces (URLs) que no aparezcan en los datos.
        7. INTEGRIDAD GEOGRÁFICA: NUNCA inventes o cambies la ubicación de una zona. (Ejemplo: Sierra Nevada está en Granada/Andalucía, NUNCA digas que está cerca de Huesca/Aragón). Si no conoces la ubicación exacta de un lugar solicitado, admítelo.`
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
    for (let i = 0; i < 5; i++) {
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
        const reports = await reportService.getReports({ zonaId: args.zoneId, limit: args.limit || 5 });
        // Solo lo relevante de los reportes
        return reports.map(r => ({
          categoria: r.categoria?.nombre,
          comentario: r.comentario,
          nivelRiesgo: r.nivelRiesgo,
          fecha: r.createdAt
        }));

      case "get_zone_stats":
        return await zoneService.getZoneDashboard(args.zoneId);

      default:
        throw new Error(`Herramienta '${name}' no implementada.`);
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


}

module.exports = new ChatService();