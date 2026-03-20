const { Router } = require("express");
const { body, param, query, validationResult } = require("express-validator");
const reportController = require("../controllers/reportController");

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
 * /api/reports:
 *   get:
 *     summary: Obtener reportes cercanos o por zona
 *     tags: [Reports]
 */
router.get("/", async (req, res, next) => {
  reportController.getReports(req, res, next);
});

/**
 * @swagger
 * /api/reports/:id:
 *   get:
 *     summary: Obtener reporte por ID
 *     tags: [Reports]
 */
router.get("/:id", [param("id").isMongoId()], validate, (req, res, next) =>
  reportController.getReportById(req, res, next)
);

/**
 * @swagger
 * /api/reports:
 *   post:
 *     summary: Crear nuevo reporte con geolocalización
 *     tags: [Reports]
 */
router.post(
  "/",
  [
    body("usuario_id").isMongoId(),
    body("zona_id").isMongoId(),
    body("nombre_categoria").isString().trim(),
    body("icono_marcador").isString().trim(),
    body("tipo").isString().trim(),
    body("descripcion").isString().trim().isLength({ min: 5 }),
    body("coordinates").isArray({ min: 2, max: 2 }),
  ],
  validate,
  (req, res, next) => reportController.createReport(req, res, next)
);

/**
 * @swagger
 * /api/reports/:id/validate:
 *   patch:
 *     summary: Confirmar o desmentir un reporte
 *     tags: [Reports]
 */
router.patch(
  "/:id/validate",
  [param("id").isMongoId(), body("accion").isIn(["confirmar", "desmentir"])],
  validate,
  (req, res, next) => reportController.validateReport(req, res, next)
);

/**
 * @swagger
 * /api/reports/:id:
 *   delete:
 *     summary: Borrar reporte (moderación)
 *     tags: [Reports]
 */
router.delete("/:id", [param("id").isMongoId()], validate, (req, res, next) =>
  reportController.deleteReport(req, res, next)
);

module.exports = router;
