/**
 * @file Controlador de chat
 * @module controllers/ChatController
 * @description Maneja las solicitudes HTTP del chatbot inteligente y mapea hacia los servicios correspondientes.
 * Gestiona las preguntas del usuario y proporciona respuestas inteligentes basadas en datos meteorológicos y de usuario.
 */

const chatService = require("../services/chatService");
const logger = require("../config/logger");

class ChatController {
  /**
   * Procesa una pregunta del usuario y retorna una respuesta del chatbot inteligente
   * @async
   * @param {Object} req - Objeto de solicitud HTTP con usuario autenticado en req.user
   * @param {string} req.body.pregunta - Pregunta del usuario
   * @param {Object} req.body.contexto - Contexto opcional para mejorar la respuesta
   * @param {string} req.user.userId - ID del usuario autenticado
   * @param {string} req.user.rol - Rol del usuario
   * @param {Object} res - Objeto de respuesta HTTP
   * @param {Function} next - Función middleware para pasar al siguiente controlador
   * @returns {Object} Respuesta con datos del chatbot, respuesta y datos utilizados
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