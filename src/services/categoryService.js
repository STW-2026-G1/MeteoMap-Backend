const ReportCategory = require("../models/ReportCategory");
const logger = require("../config/logger");

class CategoryService {
  /**
   * Obtener todas las categorías activas
   */
  async getCategories() {
    try {
      const categories = await ReportCategory.find({});
      return categories;
    } catch (err) {
      logger.error(`Error en getCategories: ${err.message}`);
      throw err;
    }
  }

  /**
   * Crear nueva categoría
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
   */
  async deleteCategory(id) {
    try {
      const category = await ReportCategory.findByIdAndDelete(id);
      if (!category) {
        throw new Error("Categoría no encontrada");
      }
      logger.info(`Categoría eliminada: ${id}`);
      return { message: "Categoría eliminada" };
    } catch (err) {
      logger.error(`Error en deleteCategory: ${err.message}`);
      throw err;
    }
  }

  /**
   * Obtener categoría por nombre
   */
  async getCategoryByName(nombre) {
    return await ReportCategory.findOne({ nombre });
  }

  /**
   * Obtener categoría por ID
   */
  async getCategoryById(id) {
    return await ReportCategory.findById(id);
  }

  /**
   * Validar si existe una categoría por nombre
   */
  async validateCategoryExists(nombre) {
    const category = await ReportCategory.findOne({ nombre });
    return !!category;
  }
}

module.exports = new CategoryService();
