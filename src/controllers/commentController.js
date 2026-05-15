/**
 * @file Controlador de comentarios
 * @module controllers/CommentController
 * @description Maneja las solicitudes HTTP de comentarios en zonas y reportes, mapea hacia los servicios correspondientes.
 * Gestiona obtención, creación, eliminación, respuestas, likes y edición de comentarios.
 */

const commentService = require("../services/commentService");
const logger = require("../config/logger");

class CommentController {
  /**
   * Obtiene comentarios de una zona específica
   * @async
   * @param {Object} req - Objeto de solicitud HTTP
   * @param {string} req.params.zoneId - ID de la zona
   * @param {number} req.query.limit - Límite de comentarios a retornar (default: 50)
   * @param {Object} res - Objeto de respuesta HTTP
   * @param {Function} next - Función middleware para pasar al siguiente controlador
   * @returns {Array} Array de comentarios de la zona
   */
  async getCommentsByZone(req, res, next) {
    try {
      const { zoneId } = req.params;
      const { limit } = req.query;
      const result = await commentService.getCommentsByZone(zoneId, limit ? parseInt(limit) : 50);
      res.json(result);
    } catch (err) {
      next(err);
    }
  }

  /**
   * Obtiene comentarios de un reporte específico
   * @async
   * @param {Object} req - Objeto de solicitud HTTP
   * @param {string} req.params.reportId - ID del reporte
   * @param {number} req.query.limit - Límite de comentarios a retornar (default: 50)
   * @param {Object} res - Objeto de respuesta HTTP
   * @param {Function} next - Función middleware para pasar al siguiente controlador
   * @returns {Array} Array de comentarios del reporte
   */
  async getReportComments(req, res, next) {
    try {
      const { reportId } = req.params;
      const { limit } = req.query;
      const result = await commentService.getReportComments(reportId, limit ? parseInt(limit) : 50);
      res.json(result);
    } catch (err) {
      next(err);
    }
  }

  /**
   * Crea un comentario en una zona específica
   * @async
   * @param {Object} req - Objeto de solicitud HTTP con usuario autenticado en req.user
   * @param {string} req.params.zoneId - ID de la zona
   * @param {string} req.body.contenido - Contenido del comentario
   * @param {string} req.body.etiqueta - Etiqueta opcional
   * @param {string} req.user.userId - ID del usuario autenticado
   * @param {Object} res - Objeto de respuesta HTTP
   * @param {Function} next - Función middleware para pasar al siguiente controlador
   * @returns {Object} Comentario creado
   */
  async createZoneComment(req, res, next) {
    try {
      const { zoneId } = req.params;
      const { contenido, etiqueta } = req.body;
      const { userId } = req.user;

      const result = await commentService.createComment({
        usuario_id: userId,
        reporte_id: null,
        zona_id: zoneId,
        contenido,
        etiqueta: etiqueta || null,
      });
      res.status(201).json(result);
    } catch (err) {
      next(err);
    }
  }

  /**
   * Crea un comentario en un reporte específico
   * @async
   * @param {Object} req - Objeto de solicitud HTTP con usuario autenticado en req.user
   * @param {string} req.params.reportId - ID del reporte
   * @param {string} req.body.contenido - Contenido del comentario
   * @param {string} req.body.etiqueta - Etiqueta opcional
   * @param {string} req.user.userId - ID del usuario autenticado
   * @param {Object} res - Objeto de respuesta HTTP
   * @param {Function} next - Función middleware para pasar al siguiente controlador
   * @returns {Object} Comentario creado
   */
  async createReportComment(req, res, next) {
    try {
      const { reportId } = req.params;
      const { contenido, etiqueta } = req.body;
      const { userId } = req.user;

      const result = await commentService.createComment({
        usuario_id: userId,
        reporte_id: reportId,
        zona_id: null,
        contenido,
        etiqueta: etiqueta || null,
      });
      res.status(201).json(result);
    } catch (err) {
      next(err);
    }
  }

  /**
   * Elimina un comentario específico (solo propietario o admin)
   * @async
   * @param {Object} req - Objeto de solicitud HTTP con usuario autenticado en req.user
   * @param {string} req.params.id - ID del comentario a eliminar
   * @param {string} req.user.userId - ID del usuario autenticado
   * @param {string} req.user.rol - Rol del usuario (para validar permisos)
   * @param {Object} res - Objeto de respuesta HTTP
   * @param {Function} next - Función middleware para pasar al siguiente controlador
   * @returns {Object} Resultado de la eliminación
   */
  async deleteComment(req, res, next) {
    try {
      const { id } = req.params;
      const { userId, rol } = req.user;

      const result = await commentService.deleteComment(id, userId, rol);
      res.json(result);
    } catch (err) {
      next(err);
    }
  }

  /**
   * Crea una respuesta a un comentario existente
   * @async
   * @param {Object} req - Objeto de solicitud HTTP con usuario autenticado en req.user
   * @param {string} req.params.id - ID del comentario padre
   * @param {string} req.body.contenido - Contenido de la respuesta
   * @param {string} req.user.userId - ID del usuario autenticado
   * @param {Object} res - Objeto de respuesta HTTP
   * @param {Function} next - Función middleware para pasar al siguiente controlador
   * @returns {Object} Comentario respuesta creado
   */
  async replyComment(req, res, next) {
    try {
      const { id } = req.params;
      const { contenido } = req.body;
      const { userId } = req.user;

      const reply = await commentService.createComment({
        usuario_id: userId,
        contenido,
        parent_id: id,
      });
      res.status(201).json(reply);
    } catch (err) {
      next(err);
    }
  }

  /**
   * Añade un like a un comentario específico
   * @async
   * @param {Object} req - Objeto de solicitud HTTP con usuario autenticado en req.user
   * @param {string} req.params.id - ID del comentario
   * @param {string} req.user.userId - ID del usuario autenticado
   * @param {Object} res - Objeto de respuesta HTTP
   * @param {Function} next - Función middleware para pasar al siguiente controlador
   * @returns {Object} Comentario con conteo de likes actualizado
   */
  async likeComment(req, res, next) {
    try {
      const { id } = req.params;
      const { userId } = req.user;
      const result = await commentService.likeComment(id, userId);
      res.json({ message: "Me gusta añadido", likes: result.likes.length });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Quita un like de un comentario específico
   * @async
   * @param {Object} req - Objeto de solicitud HTTP con usuario autenticado en req.user
   * @param {string} req.params.id - ID del comentario
   * @param {string} req.user.userId - ID del usuario autenticado
   * @param {Object} res - Objeto de respuesta HTTP
   * @param {Function} next - Función middleware para pasar al siguiente controlador
   * @returns {Object} Comentario con conteo de likes actualizado
   */
  async unlikeComment(req, res, next) {
    try {
      const { id } = req.params;
      const { userId } = req.user;
      const result = await commentService.unlikeComment(id, userId);
      res.json({ message: "Me gusta quitado", likes: result.likes.length });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Obtiene todas las respuestas de un comentario padre
   * @async
   * @param {Object} req - Objeto de solicitud HTTP
   * @param {string} req.params.id - ID del comentario padre
   * @param {Object} res - Objeto de respuesta HTTP
   * @param {Function} next - Función middleware para pasar al siguiente controlador
   * @returns {Array} Array de comentarios respuesta
   */
  async getReplies(req, res, next) {
    try {
      const { id } = req.params;
      const result = await commentService.getRepliesByParent(id);
      res.json(result);
    } catch (err) {
      next(err);
    }
  }

  /**
   * Edita el contenido de un comentario existente
   * @async
   * @param {Object} req - Objeto de solicitud HTTP con usuario autenticado en req.user
   * @param {string} req.params.id - ID del comentario a editar
   * @param {string} req.body.contenido - Nuevo contenido del comentario
   * @param {string} req.user.userId - ID del usuario autenticado
   * @param {string} req.user.rol - Rol del usuario (para validar permisos)
   * @param {Object} res - Objeto de respuesta HTTP
   * @param {Function} next - Función middleware para pasar al siguiente controlador
   * @returns {Object} Comentario actualizado
   */
  async editComment(req, res, next) {
    try {
      const { id } = req.params;
      const { userId, rol } = req.user;
      const { contenido } = req.body;

      const result = await commentService.editComment(id, userId, rol, {
        contenido,
      });
      res.json(result);
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new CommentController();
