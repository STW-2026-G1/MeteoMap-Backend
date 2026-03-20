const { Router } = require("express");
const { body, param, validationResult } = require("express-validator");
const commentController = require("../controllers/commentController");

const router = Router();

function validate(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      error: "Validation Error",
      errors: errors.array().map((e) => ({ field: e.path, message: e.msg })),
    });
  }
  next();
}

/**
 * @swagger
 * /api/comments/:zoneId:
 *   get:
 *     summary: Hilos de discusión por zona
 *     tags: [Comments]
 */
router.get("/:zoneId", [param("zoneId").isMongoId()], validate, (req, res, next) =>
  commentController.getCommentsByZone(req, res, next)
);

/**
 * @swagger
 * /api/reports/:reportId/comments:
 *   get:
 *     summary: Obtener comentarios embebidos de un reporte
 *     tags: [Comments]
 */
router.get("/report/:reportId/comments", [param("reportId").isMongoId()], validate, (req, res, next) =>
  commentController.getReportComments(req, res, next)
);

/**
 * @swagger
 * /api/comments:
 *   post:
 *     summary: Publicar comentario
 *     tags: [Comments]
 */
router.post(
  "/",
  [
    body("usuario_id").isMongoId(),
    body("zona_id").isMongoId(),
    body("reporte_id").optional().isMongoId(),
    body("contenido").isString().trim().isLength({ min: 1, max: 5000 }),
    body("etiqueta").optional().isString().trim(),
  ],
  validate,
  (req, res, next) => commentController.createComment(req, res, next)
);

/**
 * @swagger
 * /api/comments/:id:
 *   delete:
 *     summary: Borrar comentario
 *     tags: [Comments]
 */
router.delete("/:id", [param("id").isMongoId()], validate, (req, res, next) =>
  commentController.deleteComment(req, res, next)
);

/**
 * @swagger
 * /api/reports/:reportId/comments/:commentIndex:
 *   delete:
 *     summary: Borrar comentario embebido de un reporte
 *     tags: [Comments]
 */
router.delete(
  "/report/:reportId/comments/:commentIndex",
  [param("reportId").isMongoId(), param("commentIndex").isInt()],
  validate,
  (req, res, next) => commentController.deleteReportComment(req, res, next)
);

module.exports = router;
