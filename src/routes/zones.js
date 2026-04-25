const { Router } = require("express");
const { param, query, body, validationResult } = require("express-validator");
const zoneController = require("../controllers/zoneController");

const router = Router();

function validate(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const validationErrors = errors.array();

    // Buscar si hay errores de ID de MongoDB inválido
    const invalidIdErrors = validationErrors.filter(
      (e) => e.msg === "Invalid value" && e.path === "id"
    );

    // Si hay errores de ID inválido, retornar 400 con mensaje específico
    if (invalidIdErrors.length > 0) {
      return res.status(400).json({
        error: "ID inválido",
        message: "El ID proporcionado no es un MongoDB ObjectId válido (debe ser 24 caracteres hexadecimales)",
        errors: [
          {
            field: "id",
            message: "El ID debe ser un MongoDB ObjectId válido",
            example: "507f1f77bcf86cd799439011",
          },
        ],
      });
    }

    // Para otros errores de validación (body, query, etc.)
    return res.status(400).json({
      error: "Datos inválidos o faltantes",
      message: "Por favor, verifica los datos proporcionados",
      errors: validationErrors.map((e) => ({
        field: e.path,
        message: e.msg,
        value: e.value || undefined,
        location: e.location, // Indica si es 'body', 'params', 'query', etc.
      })),
    });
  }
  next();
}

/**
 * @swagger
 * /api/zones:
 *   get:
 *     summary: Listado de zonas para el mapa
 *     description: Obtiene todas las zonas registradas en el sistema, filtradas por estado (ACTIVA/INACTIVA por defecto)
 *     tags: [Zones]
 *     parameters:
 *       - in: query
 *         name: estado
 *         schema:
 *           type: string
 *           enum: [ACTIVA, INACTIVA]
 *         description: Filtrar por estado de la zona (default ACTIVA)
 *     responses:
 *       200:
 *         description: Lista de zonas obtenida exitosamente
 *       500:
 *         description: Error interno del servidor
 */
router.get("/", (req, res, next) => zoneController.getZones(req, res, next));

/**
 * @swagger
 * /api/zones/{id}:
 *   get:
 *     summary: Obtener zona por ID
 *     description: Obtiene los detalles completos de una zona específica por su ID de MongoDB
 *     tags: [Zones]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID de MongoDB de la zona (24 caracteres hexadecimales)
 *         example: "69c1170c67ab1cff0dd1e53e"
 *     responses:
 *       200:
 *         description: Zona obtenida exitosamente
 *       400:
 *         description: ID inválido (no es un MongoDB ObjectId válido)
 *       404:
 *         description: Zona no encontrada
 *       500:
 *         description: Error interno del servidor
 */
router.get("/:id", [param("id").isMongoId()], validate, (req, res, next) =>
  zoneController.getZoneById(req, res, next)
);

/**
 * @swagger
 * /api/zones/{id}/weather:
 *   get:
 *     summary: Datos climáticos actuales y caché
 *     description: Obtiene los datos meteorológicos actuales de una zona específica desde Open-Meteo. Los datos se cachean por 30 minutos
 *     tags: [Zones]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID de MongoDB de la zona
 *         example: "69dd1aa7882082402ca106b2"
 *     responses:
 *       200:
 *         description: Datos meteorológicos obtenidos exitosamente
 *       400:
 *         description: ID inválido
 *       404:
 *         description: Zona no encontrada
 *       500:
 *         description: Error interno del servidor
 */
router.get("/:id/weather", [param("id").isMongoId()], validate, (req, res, next) =>
  zoneController.getWeatherData(req, res, next)
);

/**
 * @swagger
 * /api/zones/{id}/forecast:
 *   get:
 *     summary: Predicción de temperatura de una zona para las proximas 12 horas
 *     description: Obtiene los datos meteorológicos actuales de una zona específica desde Open-Meteo. Los datos se cachean por 30 minutos
 *     tags: [Zones]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID de MongoDB de la zona
 *         example: "69dd1aa7882082402ca106b1"
 *     responses:
 *       200:
 *         description: Datos meteorológicos obtenidos exitosamente
 *       400:
 *         description: ID inválido
 *       404:
 *         description: Zona no encontrada
 *       500:
 *         description: Error interno del servidor
 */

router.get('/:id/forecast',  [param("id").isMongoId()], validate, (req, res, next) => {
  zoneController.getWeatherForecast(req, res, next)
});

/**
 * @swagger
 * /api/zones/{id}/dashboard:
 *   get:
 *     summary: Gráficos históricos y analíticas
 *     description: Obtiene estadísticas y analíticas de reportes de la comunidad para una zona específica. Incluye información sobre tipos de reportes, confirmaciones y desmentidos
 *     tags: [Zones]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID de MongoDB de la zona
 *         example: "507f1f77bcf86cd799439011"
 *     responses:
 *       200:
 *         description: Dashboard obtenido exitosamente
 *       400:
 *         description: ID inválido
 *       404:
 *         description: Zona no encontrada
 *       500:
 *         description: Error interno del servidor
 */
router.get("/:id/dashboard", [param("id").isMongoId()], validate, (req, res, next) =>
  zoneController.getZoneDashboard(req, res, next)
);

/**
 * @swagger
 * /api/zones:
 *   post:
 *     summary: Crear una nueva zona
 *     description: Crea una nueva zona en el sistema. Se requieren los datos básicos de la zona incluyendo nombre, descripción y geolocalización
 *     tags: [Zones]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - nombre
 *               - geolocalizacion
 *             properties:
 *               nombre:
 *                 type: string
 *                 example: "Sierra de Guadarrama"
 *               descripcion:
 *                 type: string
 *                 example: "Cordillera montañosa en la región central de España"
 *               geolocalizacion:
 *                 type: object
 *                 required:
 *                   - type
 *                   - coordinates
 *                 properties:
 *                   type:
 *                     type: string
 *                     enum: [Point]
 *                     example: "Point"
 *                   coordinates:
 *                     type: array
 *                     minItems: 2
 *                     maxItems: 2
 *                     items:
 *                       type: number
 *                     example: [-3.8, 40.7]
 *                     description: "[Longitud, Latitud]"
 *               estado:
 *                 type: string
 *                 enum: [ACTIVA, INACTIVA]
 *                 default: "ACTIVA"
 *                 example: "ACTIVA"
 *     responses:
 *       201:
 *         description: Zona creada exitosamente
 *       400:
 *         description: Datos inválidos o faltantes
 *       500:
 *         description: Error interno del servidor
 */
router.post(
  "/",
  [
    body("nombre")
      .trim()
      .notEmpty()
      .withMessage("El nombre de la zona es requerido")
      .isLength({ min: 3 })
      .withMessage("El nombre debe tener al menos 3 caracteres"),
    body("descripcion")
      .optional({ checkFalsy: true })
      .trim()
      .isLength({ min: 10 })
      .withMessage("La descripción debe tener al menos 10 caracteres"),
    body("geolocalizacion").notEmpty().withMessage("La geolocalización es requerida"),
    body("geolocalizacion.type")
      .notEmpty()
      .withMessage("El tipo de geolocalización es requerido")
      .equals("Point")
      .withMessage("El tipo debe ser 'Point'"),
    body("geolocalizacion.coordinates")
      .notEmpty()
      .withMessage("Las coordenadas son requeridas")
      .isArray({ min: 2, max: 2 })
      .withMessage("Las coordenadas deben ser un array de exactamente 2 números")
      .custom((value) => {
        if (!Array.isArray(value) || value.length !== 2) return false;
        return value.every((v) => typeof v === "number" && !isNaN(v));
      })
      .withMessage("Las coordenadas deben ser números válidos [Longitud, Latitud]"),
    body("estado")
      .optional({ checkFalsy: true })
      .trim()
      .isIn(["ACTIVA", "INACTIVA"])
      .withMessage("El estado debe ser 'ACTIVA' o 'INACTIVA'"),
  ],
  validate,
  (req, res, next) => zoneController.createZone(req, res, next)
);

/**
 * @swagger
 * /api/zones/{id}:
 *   delete:
 *     summary: Eliminar una zona
 *     description: Elimina una zona específica del sistema. Esta operación es permanente
 *     tags: [Zones]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID de MongoDB de la zona a eliminar
 *     responses:
 *       200:
 *         description: Zona eliminada exitosamente
 *       400:
 *         description: ID inválido
 *       404:
 *         description: Zona no encontrada
 *       500:
 *         description: Error interno del servidor
 */
router.delete("/:id", 
  [param("id").isMongoId()],
  validate, (req, res, next) =>
  zoneController.deleteZone(req, res, next)
);

module.exports = router;
