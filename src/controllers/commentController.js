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
  // En el controller
   async deleteComment(req, res, next) {
      try {
         const { id } = req.params;
         const { userId, rol } = req.user;
         
         // El servicio debería comprobar si el usuario es dueño o admin
         const result = await commentService.deleteComment(id, userId, rol);
         res.json(result);
      } catch (err) { next(err); }
   }

   async replyComment(req, res, next) {
      try {
         const { id } = req.params; // ID del comentario al que respondes
         const { contenido } = req.body;
         const { userId } = req.user;

         const reply = await commentService.createComment({
            usuario_id: userId,
            contenido,
            parent_id: id, // Guardamos la referencia al padre
            estado: "ACTIVO"
         });
         res.status(201).json(reply);
      } catch (err) { next(err); }
   }

   async likeComment(req, res, next) {
      try {
         const { id } = req.params; // ID del comentario
         const { userId } = req.user; // ID del token
         const result = await commentService.likeComment(id, userId);
         res.json({ message: "Me gusta añadido", likes: result.likes.length });
      } catch (err) { next(err); }
   }

   async unlikeComment(req, res, next) {
      try {
         const { id } = req.params;
         const { userId } = req.user;
         const result = await commentService.unlikeComment(id, userId);
         res.json({ message: "Me gusta quitado", likes: result.likes.length });
      } catch (err) { next(err); }
   }

   async getReplies(req, res, next) {
      try {
         const { id } = req.params;
         const result = await commentService.getRepliesByParent(id);
         res.json(result);
      } catch (err) { next(err); }
   }

   async editComment(req, res, next) {
       try {
          const { id } = req.params;
          const { userId, rol } = req.user;
          const { contenido } = req.body;

          const result = await commentService.editComment(id, userId, rol, {
             contenido,
          });
          res.json(result);
       } catch (err) { next(err); }
    }

}

module.exports = new CommentController();
