const { Router } = require("express");
const { body, param, validationResult } = require("express-validator");
const commentController = require("../controllers/commentController");
const isAuth = require("../middleware/auth");

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
 * /api/comments/zone/{zoneId}:
 *   get:
 *     summary: Hilos de discusión por zona
 *     tags: [Comments]
 *     parameters:
 *       - in: path
 *         name: zoneId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID de la zona de MongoDB
 *     responses:
 *       200:
 *         description: Lista de comentarios de la zona
 *       400:
 *         description: ID de zona inválido
 */
router.get(
  "/zone/:zoneId",
  [param("zoneId").isMongoId()],
  validate,
  (req, res, next) => commentController.getCommentsByZone(req, res, next)
);

/**
 * @swagger
 * /api/comments/report/{reportId}:
 *   get:
 *     summary: Obtener comentarios de un reporte
 *     tags: [Comments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: reportId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID del reporte meteorológico
 *     responses:
 *       200:
 *         description: Lista de comentarios del reporte
 *       400:
 *         description: ID de reporte inválido
 */
router.get(
  "/report/:reportId",
   isAuth,
  [param("reportId").isMongoId()],
  validate,
  (req, res, next) => commentController.getReportComments(req, res, next)
);

/**
 * @swagger
 * /api/comments/zone/{zoneId}:
 *   post:
 *     summary: Publicar comentario zona
 *     tags: [Comments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: zoneId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [contenido]
 *             properties:
 *               contenido:
 *                 type: string
 *     responses:
 *       201:
 *         description: Comentario creado exitosamente
 *       400:
 *         description: Datos inválidos
 */
router.post(
  "/zone/:zoneId",
   isAuth,
  [
    param("zoneId").isMongoId(),
    body("contenido").isString().trim().isLength({ min: 1, max: 5000 }),
    body("etiqueta").optional().isString().trim(),
  ],
  validate,
  (req, res, next) => commentController.createZoneComment(req, res, next)
);

/**
 * @swagger
 * /api/comments/report/{reportId}:
 *   post:
 *     summary: Publicar comentario reporte
 *     tags: [Comments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: reportId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [contenido]
 *             properties:
 *               contenido:
 *                 type: string
 *     responses:
 *       201:
 *         description: Comentario añadido a reporte exitosamente
 *       400:
 *         description: Datos inválidos
 */
router.post(
  "/report/:reportId",
  isAuth,
  [
    param("reportId").isMongoId(),
    body("contenido").isString().trim().isLength({ min: 1, max: 5000 }),
    body("etiqueta").optional().isString().trim(),
  ],
  validate,
  (req, res, next) => commentController.createReportComment(req, res, next)
);

/**
 * @swagger
 * /api/comments/{id}:
 *   delete:
 *     summary: Borrar comentario (Zona o Reporte)
 *     tags: [Comments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID único del comentario a borrar
 *     responses:
 *       200:
 *         description: Comentario marcado como eliminado
 *       404:
 *         description: No se encontró el comentario
 */
router.delete(
  "/:id",
   isAuth,
  [param("id").isMongoId()],
  validate,
  (req, res, next) => commentController.deleteComment(req, res, next)
);

module.exports = router;