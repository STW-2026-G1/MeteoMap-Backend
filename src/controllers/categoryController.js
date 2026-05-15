/**
 * @file Controlador de categorías
 * @module controllers/CategoryController
 * @description Maneja las solicitudes HTTP de categorías y mapea hacia los servicios correspondientes.
 * Gestiona obtención, creación, actualización y eliminación de categorías de reportes.
 */

const categoryService = require("../services/categoryService");
const logger = require("../config/logger");

class CategoryController {
  /**
   * Obtiene todas las categorías disponibles
   * @async
   * @param {Object} req - Objeto de solicitud HTTP
   * @param {Object} res - Objeto de respuesta HTTP
   * @param {Function} next - Función middleware para pasar al siguiente controlador
   * @returns {Array} Array de categorías
   */
  async getCategories(req, res, next) {
    try {
      const result = await categoryService.getCategories();
      res.json(result);
    } catch (err) {
      next(err);
    }
  }

  /**
   * Crea una nueva categoría
   * @async
   * @param {Object} req - Objeto de solicitud HTTP
   * @param {Object} req.body - Datos de la categoría a crear
   * @param {Object} res - Objeto de respuesta HTTP
   * @param {Function} next - Función middleware para pasar al siguiente controlador
   * @returns {Object} Categoría creada
   */
  async createCategory(req, res, next) {
    try {
      const categoryData = req.body;
      const category = await categoryService.createCategory(categoryData);
      res.status(201).json({
        message: "Categoría creada exitosamente",
        category,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Actualiza una categoría existente
   * @async
   * @param {Object} req - Objeto de solicitud HTTP
   * @param {string} req.params.id - ID de la categoría
   * @param {Object} req.body - Datos actualizados
   * @param {Object} res - Objeto de respuesta HTTP
   * @param {Function} next - Función middleware para pasar al siguiente controlador
   * @returns {Object} Categoría actualizada
   */
  async updateCategory(req, res, next) {
    try {
      const { id } = req.params;
      const category = await categoryService.updateCategory(id, req.body);
      res.json({
        message: "Categoría actualizada exitosamente",
        category,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Elimina una categoría
   * @async
   * @param {Object} req - Objeto de solicitud HTTP
   * @param {string} req.params.id - ID de la categoría a eliminar
   * @param {Object} res - Objeto de respuesta HTTP
   * @param {Function} next - Función middleware para pasar al siguiente controlador
   * @returns {Object} Resultado de la eliminación
   */
  async deleteCategory(req, res, next) {
    try {
      const { id } = req.params;
      const result = await categoryService.deleteCategory(id);
      res.json(result);
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new CategoryController();
