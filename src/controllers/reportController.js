const reportService = require("../services/reportService");
const logger = require("../config/logger");

class ReportController {
  /**
   * GET /api/reports
   */
  async getReports(req, res, next) {
    try {
      const { zonaId, estado, limit, lat, lng, radius, usuarioId } = req.query;
      const filters = {};
      if (zonaId) filters.zonaId = zonaId;
      if (estado) filters.estado = estado;
      if (limit) filters.limit = parseInt(limit);
      if (usuarioId) filters.usuarioId = usuarioId;
      if (lat && lng) {
        filters.lat = parseFloat(lat);
        filters.lng = parseFloat(lng);
      }
      if (radius) filters.radius = parseInt(radius);

      const result = await reportService.getReports(filters);
      console.log("ReportController.getReports", { filters, results: result });
      res.json(result);
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/reports/:id
   */
  async getReportById(req, res, next) {
    try {
      const { id } = req.params;
      const report = await reportService.getReportById(id);
      res.json(report);
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/reports
   */
  async createReport(req, res, next) {
    try {
      const reportData = {
        ...req.body,
        usuario_id: req.user.userId,
      };
      const report = await reportService.createReport(reportData);
      res.status(201).json({
        message: "Reporte creado exitosamente",
        report,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * PUT /api/reports/:id/validate
   */
  async validateReport(req, res, next) {
    try {
      const { id } = req.params;
      const { accion } = req.body;
      const userId = req.user.userId;

      const report = await reportService.validateReport(id, accion, userId);
      res.json({
        message: "Reporte validado",
        report,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * PUT /api/reports/:id
   */
  async updateReport(req, res, next) {
    try {
      const { id } = req.params;
      const { descripcion, categoria_id } = req.body;

      // Obtener el reporte para validar que pertenece al usuario
      const report = await reportService.getReportById(id);
      if (!report) {
        return res.status(404).json({ error: "Reporte no encontrado" });
      }

      // Validar que el usuario es el propietario
      // report.usuario_id es un documento poblado, acceder a su _id
      const reportOwnerId = report.usuario_id?._id?.toString() || report.usuario_id?.toString();
      const userId = req.user.userId?.toString() || req.user.userId;

      if (reportOwnerId !== userId) {
        return res.status(403).json({ error: "No tienes permiso para editar este reporte" });
      }

      const result = await reportService.updateReport(id, { descripcion, categoria_id });
      res.json(result);
    } catch (err) {
      next(err);
    }
  }

  /**
   * DELETE /api/reports/:id
   */
  async deleteReport(req, res, next) {
    try {
      const { id } = req.params;

      // Obtener el reporte para validar que pertenece al usuario
      const report = await reportService.getReportById(id);
      if (!report) {
        return res.status(404).json({ error: "Reporte no encontrado" });
      }

      // Validar que el usuario es el propietario
      // report.usuario_id es un documento poblado, acceder a su _id
      const reportOwnerId = report.usuario_id?._id?.toString() || report.usuario_id?.toString();
      const userId = req.user.userId?.toString() || req.user.userId;

      if (reportOwnerId !== userId) {
        return res.status(403).json({ error: "No tienes permiso para eliminar este reporte" });
      }

      const result = await reportService.deleteReport(id);
      res.json(result);
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new ReportController();
