const { Router } = require("express");
const { param, query, validationResult } = require("express-validator");
const zoneController = require("../controllers/zoneController");

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
 * /api/zones:
 *   get:
 *     summary: Listado de zonas para el mapa
 *     tags: [Zones]
 */
router.get("/", (req, res, next) => zoneController.getZones(req, res, next));

/**
 * @swagger
 * /api/zones/:id:
 *   get:
 *     summary: Obtener zona por ID
 *     tags: [Zones]
 */
router.get("/:id", [param("id").isMongoId()], validate, (req, res, next) =>
  zoneController.getZoneById(req, res, next)
);

/**
 * @swagger
 * /api/zones/:id/weather:
 *   get:
 *     summary: Datos climáticos actuales y caché
 *     tags: [Zones]
 */
router.get("/:id/weather", [param("id").isMongoId()], validate, (req, res, next) =>
  zoneController.getWeatherData(req, res, next)
);

/**
 * @swagger
 * /api/zones/:id/dashboard:
 *   get:
 *     summary: Gráficos históricos y analíticas
 *     tags: [Zones]
 */
router.get("/:id/dashboard", [param("id").isMongoId()], validate, (req, res, next) =>
  zoneController.getZoneDashboard(req, res, next)
);

module.exports = router;
