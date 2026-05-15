const ReportCategory = require("../models/ReportCategory");
const Report = require("../models/Report");
const logger = require("../config/logger");

/**
 * @file Servicio de Categorías de Reportes
 * @module services/categoryService
 * @description Implementa la lógica de negocio para gestión de categorías:
 * - Obtención de categorías activas
 * - CRUD de categorías
 * - Validación de existencia
 * - Cascada de eliminación con reportes
 */
class CategoryService {
  /**
   * Obtener todas las categorías activas
   * @returns {Array} Array de categorías
   */
  async getCategories() {
    try {
      const categories = await ReportCategory.find({}).sort({ nombre: 1 });
      return categories;
    } catch (err) {
      logger.error(`Error en getCategories: ${err.message}`);
      throw err;
    }
  }

  /**
   * Crear nueva categoría
   * @param {object} categoryData - Datos de la categoría (nombre, icono_marcador, etc.)
   * @returns {object} Categoría creada
   */
  async createCategory(categoryData) {
    try {
      const newCategory = new ReportCategory(categoryData);
      await newCategory.save();
      logger.info(`Nueva categoría creada: ${categoryData.nombre}`);
      return newCategory;
    } catch (err) {
      if (err.code === 11000) {
        throw new Error("Ya existe una categoría con ese nombre");
      }
      logger.error(`Error en createCategory: ${err.message}`);
      throw err;
    }
  }

  /**
   * Editar categoría
   * @param {string} id - ID de la categoría
   * @param {object} updateData - Datos a actualizar
   * @returns {object} Categoría actualizada
   */
  async updateCategory(id, updateData) {
    try {
      const category = await ReportCategory.findByIdAndUpdate(id, updateData, {
        new: true,
        runValidators: true,
      });
      if (!category) {
        throw new Error("Categoría no encontrada");
      }
      logger.info(`Categoría actualizada: ${id}`);
      return category;
    } catch (err) {
      logger.error(`Error en updateCategory: ${err.message}`);
      throw err;
    }
  }

  /**
   * Eliminar categoría (Soft delete o desactivar)
   * @param {string} id - ID de la categoría
   * @returns {object} Mensaje con cantidad de reportes asociados eliminados
   */
  async deleteCategory(id) {
    try {
      const reportService = require("./reportService");
      const reports = await Report.find({ categoria_id: id }).select("_id");

      for (const report of reports) {
        await reportService.deleteReport(report._id.toString());
      }

      const category = await ReportCategory.findByIdAndDelete(id);
      if (!category) {
        throw new Error("Categoría no encontrada");
      }
      logger.info(`Categoría eliminada: ${id} y ${reports.length} reporte(s) asociado(s) eliminados`);
      return { message: "Categoría y reportes asociados eliminados", reportsDeleted: reports.length };
    } catch (err) {
      logger.error(`Error en deleteCategory: ${err.message}`);
      throw err;
    }
  }

  /**
   * Obtener categoría por nombre
   * @param {string} nombre - Nombre de la categoría
   * @returns {object} Categoría encontrada o null
   */
  async getCategoryByName(nombre) {
    return await ReportCategory.findOne({ nombre });
  }

  /**
   * Obtener categoría por ID
   * @param {string} id - ID de la categoría
   * @returns {object} Categoría encontrada o null
   */
  async getCategoryById(id) {
    return await ReportCategory.findById(id);
  }

  /**
   * Validar si existe una categoría por nombre
   * @param {string} nombre - Nombre de la categoría
   * @returns {boolean} True si existe, false en caso contrario
   */
  async validateCategoryExists(nombre) {
    const category = await ReportCategory.findOne({ nombre });
    return !!category;
  }
}

module.exports = new CategoryService();
