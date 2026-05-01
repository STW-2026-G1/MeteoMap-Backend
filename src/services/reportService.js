const Report = require("../models/Report");
const User = require("../models/User");
const Zone = require("../models/Zone");
const categoryService = require("./categoryService");
const logger = require("../config/logger");

class ReportService {
  /**
   * Obtener reportes con filtros
   */
  async getReports(filters = {}) {
    try {
      const { zonaId, estado, limit, lat, lng, radius = 5000, usuarioId } = filters;
      const query = {};

      if (zonaId) query.zona_id = zonaId;
      if (estado) query.estado = estado;
      if (usuarioId) query.usuario_id = usuarioId;

      let reportsQuery = Report.find(query)
        .populate("usuario_id", "_id perfil.nombre perfil.avatar_seed perfil.avatar_style")
        .populate("zona_id", "nombre")
        .populate("categoria_id", "nombre icono_marcador");

      if (Number.isFinite(limit) && limit > 0) {
        reportsQuery = reportsQuery.limit(limit);
      }

      const reports = await reportsQuery;

      logger.debug("ReportService.getReports", { filter: query });

      return {
        count: reports.length,
        reports,
      };
    } catch (err) {
      logger.error(`Error en getReports: ${err.message}`);
      throw err;
    }
  }

  /**
   * Crear nuevo reporte
   */
  async createReport(reportData) {
    try {
      const { usuario_id, zona_id, categoria_id, descripcion } = reportData;

      // Verificar zona
      const zone = await Zone.findById(zona_id);
      if (!zone) {
        throw new Error("Zona no encontrada");
      }

      // Verificar categoría por ID
      const category = await categoryService.getCategoryById(categoria_id);
      if (!category) {
        const error = new Error(`La categoría con ID '${categoria_id}' no existe.`);
        error.status = 400;
        throw error;
      }

      const newReport = new Report({
        usuario_id,
        zona_id,
        categoria_id: category._id,
        contenido: {
          descripcion,
        },
      });

      await newReport.save();
      logger.info(`Nuevo reporte creado por usuario ${usuario_id}`);

      return newReport;
    } catch (err) {
      logger.error(`Error en createReport: ${err.message}`);
      throw err;
    }
  }

  /**
   * Validar reporte (confirmar/desmentir)
   */
  async validateReport(reportId, accion, userId) {
    try {
      if (!["confirmar", "desmentir"].includes(accion)) {
        throw new Error("Acción no válida. Use 'confirmar' o 'desmentir'");
      }

      const report = await Report.findById(reportId);
      if (!report) {
        throw new Error("Reporte no encontrado");
      }

      // Arrays para registrar votos y prevenir votos múltiples
      const confirmaron = report.validaciones.usuarios_confirmaron || [];
      const desmintieron = report.validaciones.usuarios_desmintieron || [];

      const hasConfirmed = confirmaron.includes(userId);
      const hasDenied = desmintieron.includes(userId);

      if (accion === "confirmar") {
        if (hasConfirmed) {
          // Toggle off
          report.validaciones.usuarios_confirmaron.pull(userId);
        } else {
          if (hasDenied) {
            report.validaciones.usuarios_desmintieron.pull(userId);
          }
          report.validaciones.usuarios_confirmaron.push(userId);
        }
      } else if (accion === "desmentir") {
        if (hasDenied) {
          // Toggle off
          report.validaciones.usuarios_desmintieron.pull(userId);
        } else {
          if (hasConfirmed) {
            report.validaciones.usuarios_confirmaron.pull(userId);
          }
          report.validaciones.usuarios_desmintieron.push(userId);
        }
      }

      await report.save();
      logger.info(`Reporte ${reportId} validado: ${accion}`);

      return report;
    } catch (err) {
      logger.error(`Error en validateReport: ${err.message}`);
      throw err;
    }
  }

  /**
   * Actualizar reporte
   */
  async updateReport(reportId, updateData) {
    try {
      const updateFields = {};

      // Solo permitir actualizar descripción y categoría
      if (updateData.descripcion !== undefined) {
        updateFields["contenido.descripcion"] = updateData.descripcion;
      }

      if (updateData.categoria_id !== undefined) {
        // Validar que la nueva categoría existe
        const category = await categoryService.getCategoryById(updateData.categoria_id);
        if (!category) {
          const error = new Error(`La categoría con ID '${updateData.categoria_id}' no existe.`);
          error.status = 400;
          throw error;
        }
        updateFields["categoria_id"] = updateData.categoria_id;
      }

      const report = await Report.findByIdAndUpdate(
        reportId,
        { $set: updateFields },
        { new: true, runValidators: true }
      ).populate("usuario_id categoria_id zona_id");

      if (!report) {
        throw new Error("Reporte no encontrado");
      }

      logger.info(`Reporte ${reportId} actualizado`);

      return report;
    } catch (err) {
      logger.error(`Error en updateReport: ${err.message}`);
      throw err;
    }
  }

  /**
   * Eliminar reporte (y sus comentarios asociados)
   */
  async deleteReport(reportId) {
    try {
      const Comment = require("../models/Comment");

      const report = await Report.findByIdAndDelete(reportId);
      if (!report) {
        throw new Error("Reporte no encontrado");
      }

      // Eliminar comentarios asociados a este reporte
      await Comment.deleteMany({ reporte_id: reportId });

      logger.info(`Reporte ${reportId} y sus comentarios eliminados`);

      return { message: "Reporte y comentarios asociados eliminados" };
    } catch (err) {
      logger.error(`Error en deleteReport: ${err.message}`);
      throw err;
    }
  }

  /**
   * Obtener reporte por ID
   */
  async getReportById(reportId) {
    try {
      const report = await Report.findById(reportId)
        .populate("usuario_id", "_id perfil.nombre perfil.avatar_seed perfil.avatar_style")
        .populate("zona_id", "nombre")
        .populate("categoria_id", "nombre icono_marcador");

      if (!report) {
        throw new Error("Reporte no encontrado");
      }

      return report;
    } catch (err) {
      logger.error(`Error en getReportById: ${err.message}`);
      throw err;
    }
  }
}

module.exports = new ReportService();
