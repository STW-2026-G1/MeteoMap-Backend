/**
 * @file Controlador de administración
 * @module controllers/AdminController
 * @description Maneja las solicitudes HTTP de administración y mapea hacia los servicios correspondientes.
 * Gestiona usuarios, reportes, dashboard y operaciones administrativas del sistema.
 */

const adminService = require("../services/adminService");
const reportService = require("../services/reportService");

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
}

module.exports = new AdminController();