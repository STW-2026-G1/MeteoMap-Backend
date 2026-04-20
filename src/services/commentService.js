const Comment = require("../models/Comment");
const Report = require("../models/Report");
const User = require("../models/User");
const logger = require("../config/logger");

class CommentService {
  /**
   * Obtener comentarios por zona
   */
  async getCommentsByZone(zoneId, limit = 50) {
    try {
      const comments = await Comment.find({ zona_id: zoneId, estado: "ACTIVO", parent_id: null})
        .populate("usuario_id", "perfil.nombre")
        .sort({ createdAt: -1 })
        .limit(limit);

      logger.debug(`CommentService.getCommentsByZone para zona: ${zoneId}`);

      return {
        count: comments.length,
        comments,
      };
    } catch (err) {
      logger.error(`Error en getCommentsByZone: ${err.message}`);
      throw err;
    }
  }

  /**
   * Obtener comentarios embebidos de un reporte
   */
  async getReportComments(reportId, limit = 50) {
    try {
      const report = await Report.findById(reportId);
      if (!report) {
        throw new Error("Reporte no encontrado");
      }

      const comentarios = report.comentarios
        .filter((c) => c.estado === "ACTIVO")
        .sort((a, b) => new Date(b.fecha) - new Date(a.fecha))
        .slice(0, limit);

      logger.debug(`CommentService.getReportComments para reporte: ${reportId}`);

      return {
        count: comentarios.length,
        comments: comentarios,
      };
    } catch (err) {
      logger.error(`Error en getReportComments: ${err.message}`);
      throw err;
    }
  }

  /**
   * Crear comentario (híbrido: zona o reporte)
   */
  async createComment(commentData) {
      try {
         const { usuario_id, zona_id, reporte_id, contenido, etiqueta, parent_id } = commentData;

         let finalZonaId = zona_id;
         let finalReporteId = reporte_id;

         // 1. Lógica de herencia para respuestas
         if (parent_id) {
            const parent = await Comment.findById(parent_id);
            if (parent) {
            finalZonaId = parent.zona_id;
            finalReporteId = parent.reporte_id;
            } else {
            throw new Error("El comentario padre no existe");
            }
         }

         // 2. Crear el nuevo documento
         const newComment = new Comment({
            usuario_id,
            zona_id: finalZonaId || null,
            reporte_id: finalReporteId || null,
            parent_id: parent_id || null,
            contenido,
            etiqueta: etiqueta || null,
            estado: "ACTIVO",
            likes: []
         });

         await newComment.save();

         // 3. SI ES UN REPORTE: También debemos actualizar el documento del Reporte
         if (finalReporteId) {
            const Report = require("../models/Report"); // Importación local si es necesario
            await Report.findByIdAndUpdate(finalReporteId, {
            $push: { comentarios: newComment._id }
            });
         }

         // 4. Devolver con populate para que el Front tenga los datos del autor
         return await Comment.findById(newComment._id)
            .populate("usuario_id", "perfil.nombre");

      } catch (err) {
         logger.error(`Error en createComment: ${err.message}`);
         throw err;
      }
   }

  /**
   * Eliminar comentario 
   */
  async deleteComment(commentId) {
  try {
    // Borrado físico directo
    const result = await Comment.findByIdAndDelete(commentId);
    
    if (!result) {
      throw new Error("Comentario no encontrado");
    }

    logger.info(`Comentario ${commentId} eliminado físicamente de la DB`);
    return { message: "Comentario eliminado" };
  } catch (err) {
    logger.error(`Error en deleteComment: ${err.message}`);
    throw err;
  }
}

  async likeComment(commentId, userId) {
   // $addToSet añade el ID al array solo si no existe ya
   return await Comment.findByIdAndUpdate(
      commentId,
      { $addToSet: { likes: userId } },
      { new: true }
   );
   }

  async unlikeComment(commentId, userId) {
      // $pull elimina el ID del array
      return await Comment.findByIdAndUpdate(
         commentId,
         { $pull: { likes: userId } },
         { new: true }
      );
   }

   async getRepliesByParent(parentId) {
      try {
         const replies = await Comment.find({ 
            parent_id: parentId, 
            estado: "ACTIVO" 
            })
            .populate("usuario_id", "perfil.nombre")
            .sort({ createdAt: 1 }); // Las respuestas suelen ir de la más vieja a la más nueva

         return {
            count: replies.length,
            replies
         };
      } catch (err) {
         logger.error(`Error en getRepliesByParent: ${err.message}`);
         throw err;
      }
   }

}

module.exports = new CommentService();
