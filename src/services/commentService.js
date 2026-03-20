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
      const comments = await Comment.find({ zona_id: zoneId, estado: "ACTIVO" })
        .populate("usuario_id", "perfil.nombre reputacion")
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
      const { usuario_id, zona_id, reporte_id, contenido, etiqueta } = commentData;

      // Obtener nombre del usuario para desnormalizar
      const user = await User.findById(usuario_id).select("perfil.nombre");
      if (!user) {
        throw new Error("Usuario no encontrado");
      }

      // Si hay reporte_id, agregar comentario embebido en el reporte
      if (reporte_id) {
        const report = await Report.findById(reporte_id);
        if (!report) {
          throw new Error("Reporte no encontrado");
        }

        const nuevoComentario = {
          usuario_id,
          autor_nombre: user.perfil.nombre,
          contenido,
          etiqueta: etiqueta || null,
          estado: "ACTIVO",
          fecha: new Date(),
        };

        report.comentarios.push(nuevoComentario);
        await report.save();
        logger.info(`Comentario añadido a reporte ${reporte_id} por usuario ${usuario_id}`);

        return {
          type: "embedded",
          message: "Comentario publicado en reporte",
          comment: nuevoComentario,
        };
      } else {
        // Comentario de zona - usar colección separada
        const newComment = new Comment({
          usuario_id,
          zona_id,
          reporte_id: null,
          contenido,
          etiqueta: etiqueta || null,
          estado: "ACTIVO",
        });

        await newComment.save();
        await newComment.populate("usuario_id", "perfil.nombre");

        logger.info(`Nuevo comentario de zona creado por usuario ${usuario_id}`);

        return {
          type: "zone",
          message: "Comentario publicado",
          comment: newComment,
        };
      }
    } catch (err) {
      logger.error(`Error en createComment: ${err.message}`);
      throw err;
    }
  }

  /**
   * Eliminar comentario (solo de zona, los embebidos requieren actualización de reporte)
   */
  async deleteComment(commentId) {
    try {
      const comment = await Comment.findById(commentId);
      if (!comment) {
        throw new Error("Comentario no encontrado");
      }

      comment.estado = "ELIMINADO";
      await comment.save();

      logger.info(`Comentario ${commentId} marcado como eliminado`);

      return { message: "Comentario eliminado" };
    } catch (err) {
      logger.error(`Error en deleteComment: ${err.message}`);
      throw err;
    }
  }

  /**
   * Eliminar comentario embebido de un reporte
   */
  async deleteReportComment(reportId, commentIndex) {
    try {
      const report = await Report.findById(reportId);
      if (!report) {
        throw new Error("Reporte no encontrado");
      }

      if (commentIndex < 0 || commentIndex >= report.comentarios.length) {
        throw new Error("Índice de comentario no válido");
      }

      report.comentarios[commentIndex].estado = "ELIMINADO";
      await report.save();

      logger.info(`Comentario embebido en reporte ${reportId} marcado como eliminado`);

      return { message: "Comentario eliminado del reporte" };
    } catch (err) {
      logger.error(`Error en deleteReportComment: ${err.message}`);
      throw err;
    }
  }
}

module.exports = new CommentService();
