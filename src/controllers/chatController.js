const chatService = require("../services/chatService");
const logger = require("../config/logger");

class ChatController {
  /**
   * POST /api/chat/ask
   * Endpoint principal del chatbot inteligente
   */
  async getResponse(req, res, next) {
    try {
      const { usuario_id, pregunta, contexto } = req.body;

      logger.info(`Chat request de usuario ${usuario_id}: ${pregunta}`);

      // Llamar al servicio que tiene acceso a todos los endpoints
      const resultado = await chatService.getResponse(
        pregunta,
        usuario_id,
        contexto
      );

      // Responder con formato consistente
      res.json({
        status: "success",
        data: {
          id: Math.random().toString(36).substr(2, 9),
          usuario_id,
          pregunta,
          respuesta: resultado.respuesta,
          datos_utilizados: resultado.datosUtilizados,
          modelo: resultado.modelo,
          timestamp: new Date().toISOString(),
        },
      });
    } catch (err) {
      logger.error(`Error en ChatController.getResponse: ${err.message}`);
      next(err);
    }
  }
}

module.exports = new ChatController();