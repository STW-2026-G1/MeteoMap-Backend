const categoryService = require("../services/categoryService");
const logger = require("../config/logger");

class CategoryController {
  /**
   * GET /api/categories
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
   * POST /api/categories
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
   * PUT /api/categories/:id
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
   * DELETE /api/categories/:id
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
