const commentService = require("../services/commentService");
const logger = require("../config/logger");

class CommentController {
  /**
   * GET /api/comments/zone/{zoneId}
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
   * GET /api/comments/report/{reportId}
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
   * POST /api/comments/zone/{zoneId}
   */
  async createZoneComment(req, res, next) {
   try {
      const { zoneId } = req.params;
      const { contenido, etiqueta } = req.body;
      const { userId } = req.user;
      
      // Unificamos la data para el servicio
      const result = await commentService.createComment({
         usuario_id: userId,
         reporte_id: null,
         zona_id: zoneId, // Viene de la URL
         contenido,
         etiqueta: etiqueta || null,
      });
      res.status(201).json(result);
   } catch (err) {
      next(err);
   }
  }

  /**
   * POST /api/comments/report/{reportId}
   */
  async createReportComment(req, res, next) {
   try {
      const { reportId } = req.params;
      const { contenido, etiqueta } = req.body;
      const { userId } = req.user;

      // Unificamos la data para el servicio
      const result = await commentService.createComment({
         usuario_id: userId,
         reporte_id: reportId, // Viene de la URL
         zona_id: null,
         contenido,
         etiqueta: etiqueta || null
      });
      res.status(201).json(result);
   } catch (err) {
      next(err);
   }
  }

  /**
   * DELETE /api/comments/{id}
   */
  async deleteComment(req, res, next) {
    try {
      const { id } = req.params;
      const result = await commentService.deleteComment(id);
      res.json(result);
    } catch (err) {
      next(err);
    }
  }

}

module.exports = new CommentController();
