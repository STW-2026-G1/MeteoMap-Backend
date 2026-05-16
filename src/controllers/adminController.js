/**
 * @file Controlador de administración
 * @module controllers/AdminController
 * @description Maneja las solicitudes HTTP de administración y mapea hacia los servicios correspondientes.
 * Gestiona usuarios, reportes, dashboard y operaciones administrativas del sistema.
 */

const adminService = require("../services/adminService");
const reportService = require("../services/reportService");
const logger = require("../config/logger");

class AdminController {
  /**
   * Obtiene lista de todos los usuarios del sistema
   * @async
   * @param {Object} req - Objeto de solicitud HTTP
   * @param {Object} res - Objeto de respuesta HTTP
   * @param {Function} next - Función middleware para pasar al siguiente controlador
   * @returns {Array} Array de usuarios
   */
  async getUsers(req, res, next) {
    try {
      const result = await adminService.getUsers();
      res.json(result);
    } catch (err) {
      logger.error("Error al obtener usuarios:", err);
      next(err);
    }
  }

  /**
   * Actualiza datos de un usuario específico
   * @async
   * @param {Object} req - Objeto de solicitud HTTP
   * @param {string} req.params.id - ID del usuario
   * @param {Object} req.body - Campos a actualizar
   * @param {Object} res - Objeto de respuesta HTTP
   * @param {Function} next - Función middleware para pasar al siguiente controlador
   * @returns {Object} Datos del usuario actualizado
   */
  async updateUser(req, res, next) {
    try {
      const { id } = req.params;
      const result = await adminService.updateUser(id, req.body);
      res.json(result);
    } catch (err) {
      next(err);
    }
  }

  /**
   * Elimina un usuario del sistema
   * @async
   * @param {Object} req - Objeto de solicitud HTTP
   * @param {string} req.params.id - ID del usuario a eliminar
   * @param {Object} res - Objeto de respuesta HTTP
   * @param {Function} next - Función middleware para pasar al siguiente controlador
   * @returns {Object} Resultado de la eliminación
   */
  async deleteUser(req, res, next) {
    try {
      const { id } = req.params;
      const result = await adminService.deleteUser(id);
      res.json(result);
    } catch (err) {
      next(err);
    }
  }

  /**
   * Restaura un usuario eliminado
   * @async
   * @param {Object} req - Objeto de solicitud HTTP
   * @param {string} req.params.id - ID del usuario a restaurar
   * @param {Object} res - Objeto de respuesta HTTP
   * @param {Function} next - Función middleware para pasar al siguiente controlador
   * @returns {Object} Datos del usuario restaurado
   */
  async restoreUser(req, res, next) {
    try {
      const { id } = req.params;
      const result = await adminService.restoreUser(id);
      res.json(result);
    } catch (err) {
      next(err);
    }
  }

  /**
   * Elimina un reporte específico
   * @async
   * @param {Object} req - Objeto de solicitud HTTP
   * @param {string} req.params.id - ID del reporte a eliminar
   * @param {Object} res - Objeto de respuesta HTTP
   * @param {Function} next - Función middleware para pasar al siguiente controlador
   * @returns {Object} Resultado de la eliminación
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

  /**
   * Obtiene el dashboard administrativo con estadísticas del sistema
   * @async
   * @param {Object} req - Objeto de solicitud HTTP
   * @param {Object} res - Objeto de respuesta HTTP
   * @param {Function} next - Función middleware para pasar al siguiente controlador
   * @returns {Object} Estadísticas y datos del dashboard administrativo
   */
  async getDashboard(req, res, next) {
    try {
      const result = await adminService.getDashboard();
      res.json(result);
    } catch (err) {
      next(err);
    }
  }

  /**
   * Obtiene el recuento de reportes no visualizados por el administrador actual
   * @async
   */
  async getUnreadReportsCount(req, res, next) {
    try {
      const adminId = req.user.userId;
      logger.debug(`AdminController.getUnreadReportsCount para admin: ${adminId}`);
      // Contamos aquellos reportes donde el ID de este admin NO esté en la lista `visto_por_admins`
      const Report = require("../models/Report");
      const count = await Report.countDocuments({ visto_por_admins: { $ne: adminId } });
      res.json({ count });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Marca los reportes no leídos como leídos para el administrador actual
   * @async
   */
  async markReportsAsSeen(req, res, next) {
    try {
      const adminId = req.user.userId;

      const Report = require("../models/Report");
      logger.debug(`AdminController.markReportsAsSeen para admin: ${JSON.stringify(req.user)}`);
      
      // Agregar el ID de este admin al array visto_por_admins de todos los reportes donde aún no esté
      await Report.updateMany(
        { visto_por_admins: { $ne: adminId } },
        { $addToSet: { visto_por_admins: adminId } }
      );
      
      res.json({ message: "Reportes marcados como vistos por el admin", success: true });
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new AdminController();