const { Router } = require("express");
const { body, param, query, validationResult } = require("express-validator");
const reportController = require("../controllers/reportController");
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
 * /api/reports:
 *   get:
 *     summary: Obtener reportes cercanos o por zona
 *     tags: [Reports]
 *     parameters:
 *       - in: query
 *         name: lat
 *         schema:
 *           type: number
 *         description: Latitud
 *       - in: query
 *         name: lng
 *         schema:
 *           type: number
 *         description: Longitud
 *       - in: query
 *         name: radius
 *         schema:
 *           type: number
 *         description: Radio de búsqueda en metros (por defecto 5000)
 *       - in: query
 *         name: zonaId
 *         schema:
 *           type: string
 *         description: ID de la zona
 *     responses:
 *       200:
 *         description: Lista de reportes obtenida con éxito
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 count:
 *                   type: integer
 *                 reports:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Report'
 */
router.get(
  "/",
  [
    query("lat").optional().isFloat(),
    query("lng").optional().isFloat(),
    query("radius").optional().isInt(),
    query("zonaId").optional().isMongoId(),
  ],
  validate,
  async (req, res, next) => {
    reportController.getReports(req, res, next);
  }
);

/**
 * @swagger
 * /api/reports/{id}:
 *   get:
 *     summary: Obtener reporte por ID
 *     tags: [Reports]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID del reporte
 *     responses:
 *       200:
 *         description: Reporte obtenido con éxito
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Report'
 *       404:
 *         description: Reporte no encontrado
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
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - zona_id
 *               - categoria_id
 *               - descripcion
 *             properties:
 *               zona_id:
 *                 type: string
 *               categoria_id:
 *                 type: string
 *               descripcion:
 *                 type: string
 *     responses:
 *       201:
 *         description: Reporte creado exitosamente
 *       401:
 *         description: No autorizado
 */
router.post(
  "/",
  isAuth,
  [
    body("zona_id").isMongoId(),
    body("categoria_id").isMongoId(),
    body("descripcion").isString().trim().isLength({ min: 5 }),
  ],
  validate,
  (req, res, next) => reportController.createReport(req, res, next)
);

/**
 * @swagger
 * /api/reports/{id}:
 *   put:
 *     summary: Actualizar reporte
 *     tags: [Reports]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID del reporte
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               descripcion:
 *                 type: string
 *               categoria_id:
 *                 type: string
 *     responses:
 *       200:
 *         description: Reporte actualizado con éxito
 *       404:
 *         description: Reporte no encontrado
 */
router.put(
  "/:id",
  isAuth,
  [param("id").isMongoId(), body("descripcion").optional().isString().trim().isLength({ min: 5 })],
  validate,
  (req, res, next) => reportController.updateReport(req, res, next)
);

/**
 * @swagger
 * /api/reports/{id}/validate:
 *   put:
 *     summary: Confirmar o desmentir un reporte
 *     tags: [Reports]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID del reporte
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - accion
 *             properties:
 *               accion:
 *                 type: string
 *                 enum: [confirmar, desmentir]
 *     responses:
 *       200:
 *         description: Reporte validado con éxito
 *       404:
 *         description: Reporte no encontrado
 */
router.put(
  "/:id/validate",
  isAuth,
  [param("id").isMongoId(), body("accion").isIn(["confirmar", "desmentir"])],
  validate,
  (req, res, next) => reportController.validateReport(req, res, next)
);

/**
 * @swagger
 * /api/reports/{id}:
 *   delete:
 *     summary: Borrar reporte (moderación)
 *     tags: [Reports]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID del reporte
 *     responses:
 *       200:
 *         description: Reporte eliminado con éxito
 *       404:
 *         description: Reporte no encontrado
 */
router.delete(
  "/:id",
  isAuth,
  [param("id").isMongoId()],
  validate,
  (req, res, next) => reportController.deleteReport(req, res, next)
);

module.exports = router;
