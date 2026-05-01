const chatService = require("../services/chatService");
const logger = require("../config/logger");

class ChatController {
  /**
   * POST /api/chat/ask
   * Endpoint principal del chatbot inteligente
   */
  async getResponse(req, res, next) {
    try {
      const { pregunta, contexto } = req.body;
      const { userId, rol } = req.user;

      logger.info(`Chat request de usuario ${userId} (${rol}): ${pregunta}`);

      // Llamar al servicio con el ID y ROL del usuario autenticado
      const resultado = await chatService.getResponse(
        pregunta,
        userId,
        rol,
        contexto
      );

      // Responder con formato consistente
      res.json({
        status: "success",
        data: {
          id: Math.random().toString(36).substr(2, 9),
          usuario_id: userId,
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