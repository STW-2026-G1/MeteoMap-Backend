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
      const { zonaId, estado, limit = 100, lat, lng, radius = 5000, usuarioId } = filters;
      const query = {};

      if (zonaId) query.zona_id = zonaId;
      if (estado) query.estado = estado;
      if (usuarioId) query.usuario_id = usuarioId;

      const reports = await Report.find(query)
        .populate("usuario_id", "_id perfil.nombre avatar_seed")
        .populate("zona_id", "nombre")
        .populate("categoria_id", "nombre icono_marcador")
        .limit(limit);

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
      const { usuario_id, zona_id, nombre_categoria, icono_marcador, tipo, descripcion } = reportData;

      // Verificar zona
      const zone = await Zone.findById(zona_id);
      if (!zone) {
        throw new Error("Zona no encontrada");
      }

      // Verificar categoría
      let category = await categoryService.getCategoryByName(nombre_categoria);
      if (!category) {
        logger.info(`La categoría '${nombre_categoria}' no existe. Creando nueva categoría...`);
        category = await categoryService.createCategory({
          nombre: nombre_categoria,
          icono_marcador: icono_marcador || "⚠️",
          descripcion: `Categoría autogenerada para el tipo: ${tipo || "Reporte"}`,
          creado_por: usuario_id
        });
      }

      const newReport = new Report({
        usuario_id,
        zona_id,
        categoria_id: category._id,
        tipo,
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
      
      // Solo permitir actualizar descripción y tipo
      if (updateData.descripcion !== undefined) {
        updateFields["contenido.descripcion"] = updateData.descripcion;
      }
      if (updateData.tipo !== undefined) {
        updateFields["tipo"] = updateData.tipo;
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
        .populate("usuario_id", "_id perfil.nombre avatar_seed")
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
