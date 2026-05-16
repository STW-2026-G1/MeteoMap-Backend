/**
 * @file Rutas de categorías
 * @module routes/categories
 * @description Define los endpoints para consultar y gestionar las categorías de los reportes.
 * @author MeteoMap Team
 */

const { Router } = require("express");
const { body, param, validationResult } = require("express-validator");
const categoryController = require("../controllers/categoryController");
const isAuth = require("../middleware/auth");
const requireAdmin = require("../middleware/requireAdmin");

const router = Router();

function validate(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      error: "Error de validación",
      errors: errors.array().map((e) => ({ field: e.path, message: e.msg })),
    });
  }
  next();
}

/**
 * @swagger
 * /api/categories:
 *   get:
 *     summary: Obtener todas las categorías activas
 *     tags: [Categories]
 *     responses:
 *       200:
 *         description: Lista de categorías obtenida con éxito
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   _id:
 *                     type: string
 *                     example: "60d5ecb74b24c72b8c8b4567"
 *                   nombre:
 *                     type: string
 *                     example: "Nieve"
 *                   descripcion:
 *                     type: string
 *                     example: "Reportes sobre acumulación de nieve"
 *                   icono_marcador:
 *                     type: string
 *                     example: "snowflake"
 *                   createdAt:
 *                     type: string
 *                     format: date-time
 *                   updatedAt:
 *                     type: string
 *                     format: date-time
 */
router.get("/", async (req, res, next) => {
    // NOTE: no auth validation here
  categoryController.getCategories(req, res, next);
});

/**
 * @swagger
 * /api/categories:
 *   post:
 *     summary: Crear nueva categoría
 *     tags: [Categories]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - nombre
 *             properties:
 *               nombre:
 *                 type: string
 *                 example: "Nieve"
 *               descripcion:
 *                 type: string
 *                 example: "Reportes sobre acumulación de nieve"
 *               icono_marcador:
 *                 type: string
 *                 example: "snowflake"
 *     responses:
 *       201:
 *         description: Categoría creada exitosamente
 */
router.post(
  "/",
  isAuth,
  requireAdmin,
  [
    body("nombre").isString().trim().notEmpty(),
    body("descripcion").optional().isString().trim(),
    body("icono_marcador").optional().isString().trim(),
  ],
  validate,
  (req, res, next) => categoryController.createCategory(req, res, next)
);

/**
 * @swagger
 * /api/categories/{id}:
 *   put:
 *     summary: Actualizar categoría
 *     tags: [Categories]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID de la categoría
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               nombre:
 *                 type: string
 *               descripcion:
 *                 type: string
 *               icono_marcador:
 *                 type: string
 *     responses:
 *       200:
 *         description: Categoría actualizada exitosamente
 */
router.put(
  "/:id",
  isAuth,
  requireAdmin,
  [
    param("id").isMongoId(),
    body("nombre").optional().isString().trim().notEmpty(),
    body("descripcion").optional().isString().trim(),
    body("icono_marcador").optional().isString().trim(),
  ],
  validate,
  (req, res, next) => categoryController.updateCategory(req, res, next)
);

/**
 * @swagger
 * /api/categories/{id}:
 *   delete:
 *     summary: Eliminar categoría
 *     tags: [Categories]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID de la categoría
 *     responses:
 *       200:
 *         description: Categoría eliminada con éxito
 *       404:
 *         description: Categoría no encontrada
 */
router.delete("/:id", isAuth, requireAdmin, [param("id").isMongoId()], validate, (req, res, next) =>
  categoryController.deleteCategory(req, res, next)
);

module.exports = router;
