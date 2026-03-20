const Report = require("../models/Report");
const User = require("../models/User");
const Zone = require("../models/Zone");
const logger = require("../config/logger");

class ReportService {
  /**
   * Obtener reportes con filtros
   */
  async getReports(filters = {}) {
    try {
      const { zonaId, estado, limit = 100 } = filters;
      const query = { estado: "ACTIVO" };

      if (zonaId) query.zona_id = zonaId;
      if (estado) query.estado = estado;

      const reports = await Report.find(query)
        .populate("usuario_id", "perfil.nombre reputacion")
        .populate("zona_id", "nombre")
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
      const { usuario_id, zona_id, nombre_categoria, icono_marcador, tipo, descripcion, foto_url, coordinates } = reportData;

      // Verificar usuario
      const user = await User.findById(usuario_id);
      if (!user) {
        throw new Error("Usuario no encontrado");
      }

      // Verificar zona
      const zone = await Zone.findById(zona_id);
      if (!zone) {
        throw new Error("Zona no encontrada");
      }

      const newReport = new Report({
        usuario_id,
        zona_id,
        categoria: {
          nombre: nombre_categoria,
          icono_marcador,
        },
        tipo,
        contenido: {
          descripcion,
          foto_url,
        },
        geolocalizacion: {
          type: "Point",
          coordinates,
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
  async validateReport(reportId, accion) {
    try {
      if (!["confirmar", "desmentir"].includes(accion)) {
        throw new Error("Acción no válida. Use 'confirmar' o 'desmentir'");
      }

      const report = await Report.findById(reportId);
      if (!report) {
        throw new Error("Reporte no encontrado");
      }

      if (accion === "confirmar") {
        report.validaciones.confirmaciones += 1;
      } else if (accion === "desmentir") {
        report.validaciones.desmentidos += 1;
      }

      // Calcular valoración global
      report.valoracion_global = report.validaciones.confirmaciones - report.validaciones.desmentidos;

      // Si baja de -3, marcar como OCULTO
      if (report.valoracion_global < -3) {
        report.estado = "OCULTO";
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
   * Eliminar reporte
   */
  async deleteReport(reportId) {
    try {
      const report = await Report.findByIdAndDelete(reportId);
      if (!report) {
        throw new Error("Reporte no encontrado");
      }

      logger.info(`Reporte ${reportId} eliminado`);

      return { message: "Reporte eliminado" };
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
        .populate("usuario_id", "perfil.nombre reputacion")
        .populate("zona_id", "nombre");

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
