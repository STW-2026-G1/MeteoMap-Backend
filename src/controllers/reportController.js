/**
 * @file Controlador de reportes
 * @module controllers/ReportController
 * @description Maneja las solicitudes HTTP de reportes meteorológicos y mapea hacia los servicios correspondientes.
 * Gestiona obtención, creación, validación, actualización y eliminación de reportes.
 */

const reportService = require("../services/reportService");
const logger = require("../config/logger");

class ReportController {
  /**
   * Obtiene reportes con filtros opcionales (zona, estado, ubicación, etc.)
   * @async
   * @param {Object} req - Objeto de solicitud HTTP
   * @param {Object} req.query - Parámetros de query: zonaId, estado, limit, lat, lng, radius, usuarioId
   * @param {Object} res - Objeto de respuesta HTTP
   * @param {Function} next - Función middleware para pasar al siguiente controlador
   * @returns {Array} Array de reportes que coinciden con los filtros
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
   * Obtiene un reporte específico por su ID
   * @async
   * @param {Object} req - Objeto de solicitud HTTP
   * @param {string} req.params.id - ID del reporte
   * @param {Object} res - Objeto de respuesta HTTP
   * @param {Function} next - Función middleware para pasar al siguiente controlador
   * @returns {Object} Datos del reporte
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
   * Crea un nuevo reporte meteorológico
   * @async
   * @param {Object} req - Objeto de solicitud HTTP con usuario autenticado en req.user
   * @param {string} req.user.userId - ID del usuario autenticado
   * @param {Object} req.body - Datos del reporte
   * @param {Object} res - Objeto de respuesta HTTP
   * @param {Function} next - Función middleware para pasar al siguiente controlador
   * @returns {Object} Reporte creado
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
   * Valida o rechaza un reporte específico
   * @async
   * @param {Object} req - Objeto de solicitud HTTP con usuario autenticado en req.user
   * @param {string} req.params.id - ID del reporte
   * @param {string} req.body.accion - Acción de validación (aprobar/rechazar)
   * @param {string} req.user.userId - ID del usuario que valida
   * @param {Object} res - Objeto de respuesta HTTP
   * @param {Function} next - Función middleware para pasar al siguiente controlador
   * @returns {Object} Reporte validado
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
   * Actualiza un reporte existente (solo por el propietario)
   * @async
   * @param {Object} req - Objeto de solicitud HTTP con usuario autenticado en req.user
   * @param {string} req.params.id - ID del reporte
   * @param {string} req.body.descripcion - Nueva descripción
   * @param {string} req.body.categoria_id - ID de la nueva categoría
   * @param {string} req.user.userId - ID del usuario autenticado
   * @param {Object} res - Objeto de respuesta HTTP
   * @param {Function} next - Función middleware para pasar al siguiente controlador
   * @returns {Object} Reporte actualizado
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
   * Elimina un reporte existente (solo por el propietario)
   * @async
   * @param {Object} req - Objeto de solicitud HTTP con usuario autenticado en req.user
   * @param {string} req.params.id - ID del reporte a eliminar
   * @param {string} req.user.userId - ID del usuario autenticado
   * @param {Object} res - Objeto de respuesta HTTP
   * @param {Function} next - Función middleware para pasar al siguiente controlador
   * @returns {Object} Resultado de la eliminación
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
