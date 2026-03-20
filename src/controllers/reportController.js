const reportService = require("../services/reportService");
const logger = require("../config/logger");

class ReportController {
  /**
   * GET /api/reports
   */
  async getReports(req, res, next) {
    try {
      const { zonaId, estado, limit } = req.query;
      const filters = {};
      if (zonaId) filters.zonaId = zonaId;
      if (estado) filters.estado = estado;
      if (limit) filters.limit = parseInt(limit);

      const result = await reportService.getReports(filters);
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
      const reportData = req.body;
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
   * PATCH /api/reports/:id/validate
   */
  async validateReport(req, res, next) {
    try {
      const { id } = req.params;
      const { accion } = req.body;

      const report = await reportService.validateReport(id, accion);
      res.json({
        message: "Reporte validado",
        report,
      });
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
      const result = await reportService.deleteReport(id);
      res.json(result);
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new ReportController();
