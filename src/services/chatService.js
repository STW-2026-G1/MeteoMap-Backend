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

    // Configuración del modelo
    this.modelName = "gemini-3-flash-preview";
    this.temperature = 0.7;
    this.maxTokens = 1024;
  }

  // Definición de herramientas (Function Calling)
  _getTools() {
    return [
      {
        functionDeclarations: [
          {
            name: "list_zones",
            description: "Obtiene la lista de todas las zonas de montaña activas en el sistema. Útil para conocer qué zonas existen y sus IDs.",
            parameters: { type: "OBJECT", properties: {} }
          },
          {
            name: "get_zone_weather",
            description: "Obtiene los datos meteorológicos actuales (temperatura, viento, etc.) para una zona específica.",
            parameters: {
              type: "OBJECT",
              properties: {
                zoneId: { type: "STRING", description: "ID único de la zona (ej: 65f...)" }
              },
              required: ["zoneId"]
            }
          },
          {
            name: "get_zone_forecast",
            description: "Obtiene la predicción meteorológica detallada para las próximas 12 horas en una zona.",
            parameters: {
              type: "OBJECT",
              properties: {
                zoneId: { type: "STRING", description: "ID único de la zona." }
              },
              required: ["zoneId"]
            }
          },
          {
            name: "get_zone_reports",
            description: "Obtiene los reportes de seguridad, avisos y condiciones del terreno más recientes para una zona.",
            parameters: {
              type: "OBJECT",
              properties: {
                zoneId: { type: "STRING", description: "ID único de la zona." },
                limit: { type: "NUMBER", description: "Límite de reportes a recuperar (por defecto 5)." }
              },
              required: ["zoneId"]
            }
          },
          {
            name: "get_zone_stats",
            description: "Obtiene un resumen estadístico de la actividad y tipos de reportes en una zona.",
            parameters: {
              type: "OBJECT",
              properties: {
                zoneId: { type: "STRING", description: "ID único de la zona." }
              },
              required: ["zoneId"]
            }
          }
        ]
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
      const model = this.client.getGenerativeModel({ model: this.modelName });

      const prompt = `
        Analiza si la siguiente pregunta del usuario es RELEVANTE para una aplicación de mapas meteorológicos de montaña y seguridad en el Pirineo (MeteoMap).
        
        Temas RELEVANTES:
        - Clima, temperaturas, viento, nieve en montañas y zonas naturales.
        - Seguridad en montaña, avisos de peligro, estado de senderos y rutas.
        - Información sobre picos, valles, parques naturales o zonas de montaña en general.
        - Uso de la propia aplicación MeteoMap (ver mapas, crear reportes, buscar zonas, etc.).
        - Saludos y cortesía básica.

        Temas IRRELEVANTES:
        - Recetas de cocina, política, deportes generales (fútbol, etc.).
        - Programación, historia universal no relacionada con la montaña.
        - Consultas sobre ciudades urbanas que no tengan que ver con el senderismo o montañismo.
        - Cualquier cosa que no tenga nada que ver con el ámbito de la app.

        Responde SOLO con un JSON: {"relevante": true} o {"relevante": false}
        
        Pregunta: "${pregunta}"
      `;

      const result = await model.generateContent(prompt);
      const response = await result.response;
      const text = response.text().trim();

      try {
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (!jsonMatch) return true; // Fallback a relevante si no hay JSON
        const parsed = JSON.parse(jsonMatch[0]);
        return parsed.relevante === true;
      } catch (e) {
        return true;
      }
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
    const model = this.client.getGenerativeModel({
      model: this.modelName,
      tools: this._getTools(),
    });

    // Construir historial de mensajes para Gemini
    const contents = [];

    // Agregar sistema (contexto inicial)
    contents.push({
      role: "user",
      parts: [{
        text: `Eres el asistente experto de MeteoMap. Tu misión es ayudar a usuarios con información meteorológica y de seguridad real de distintas zonas geográficas (mayoritariamente montañosas).
        INSTRUCCIONES:
        1. Utiliza las herramientas disponibles para obtener datos REALES. No inventes temperaturas ni estados de zonas.
        2. Si el usuario pregunta por una zona que no conoces, usa 'list_zones' para ver qué tenemos disponible.
        3. Sé conciso pero prioriza la seguridad. Si hay avisos de peligro, menciónalos claramente.
        4. El ID de usuario actual es ${usuario_id}.
        5. En tu respuesta, no incluyas datos sensibles de la base de datos (como el id de los objetos almacenados).`
      }]
    });
    contents.push({ role: "model", parts: [{ text: "Entendido. Estoy listo para ayudar con datos precisos de MeteoMap." }] });

    // Agregar historial previo
    historial.forEach(h => {
      contents.push({ role: "user", parts: [{ text: h.pregunta }] });
      contents.push({ role: "model", parts: [{ text: h.respuesta }] });
    });

    // Agregar pregunta actual
    contents.push({ role: "user", parts: [{ text: pregunta }] });

    let chat = model.startChat({
      history: contents.slice(0, -1), // El último mensaje se envía con sendMessage
      generationConfig: {
        temperature: this.temperature,
        maxOutputTokens: this.maxTokens,
      }
    });

    // Prompt inicial
    let response = await chat.sendMessage(pregunta);
    let responseText = "";

    // Bucle para manejar múltiples llamadas a funciones si es necesario
    // Limitamos a 5 iteraciones para evitar bucles infinitos
    for (let i = 0; i < 5; i++) {
      const functionCalls = response.response.functionCalls();

      if (!functionCalls || functionCalls.length === 0) {
        responseText = response.response.text();
        break;
      }

      const functionResponses = [];

      for (const call of functionCalls) {
        logger.debug(`Gemini solicita ejecutar herramienta: ${call.name} con args: ${JSON.stringify(call.args)}`);

        try {
          const apiResult = await this._executeTool(call.name, call.args);
          functionResponses.push({
            functionResponse: {
              name: call.name,
              response: { content: apiResult }
            }
          });
        } catch (toolErr) {
          functionResponses.push({
            functionResponse: {
              name: call.name,
              response: { error: toolErr.message }
            }
          });
        }
      }

      // Enviar los resultados de las funciones de vuelta a Gemini
      response = await chat.sendMessage(functionResponses);
    }

    return {
      respuesta: responseText || response.response.text(),
      modelo: this.modelName,
      datosUtilizados: ["tools_api"]
    };
  }

  /**
   * Ejecutor de herramientas locales
   * @private
   */
  async _executeTool(name, args) {
    switch (name) {
      case "list_zones":
        return await zoneService.getZones("ACTIVA");

      case "get_zone_weather":
        return await zoneService.getWeatherData(args.zoneId);

      case "get_zone_forecast":
        return await zoneService.getWeatherForecast(args.zoneId);

      case "get_zone_reports":
        return await reportService.getReports({ zonaId: args.zoneId, limit: args.limit || 5 });

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