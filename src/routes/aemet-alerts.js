/**
 * @file Rutas de alertas AEMET
 * @module routes/aemet-alerts
 * @description Define los endpoints para la obtención de avisos y alertas meteorológicas desde AEMET.
 * @author MeteoMap Team
 */

const { Router } = require("express");
const aemetAlertsController = require("../controllers/aemetAlertsController");
const logger = require("../config/logger");

const router = Router();

/**
 * @swagger
 * /api/aemet-alerts:
 *   get:
 *     summary: Obtener todas las alertas meteorológicas activas
 *     description: Retorna un array de alertas de AEMET con ubicación geográfica
 *     tags: [AEMET Alerts]
 *     responses:
 *       200:
 *         description: Alertas obtenidas correctamente
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: "success"
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                       zona:
 *                         type: string
 *                       tipo:
 *                         type: string
 *                       nivel:
 *                         type: string
 *                       nivelNumerico:
 *                         type: number
 *                       coordenadas:
 *                         type: object
 *                         properties:
 *                           latitud:
 *                             type: number
 *                           longitud:
 *                             type: number
 *                       color:
 *                         type: string
 *                       descripcion:
 *                         type: string
 *                 total:
 *                   type: number
 *       500:
 *         description: Error al obtener alertas
 */
router.get("/", aemetAlertsController.getAlerts.bind(aemetAlertsController));

/**
 * @swagger
 * /api/aemet-alerts/zone/{zoneId}:
 *   get:
 *     summary: Obtener alertas para una zona específica
 *     description: Retorna alertas que afectan a una zona determinada
 *     tags: [AEMET Alerts]
 *     parameters:
 *       - in: path
 *         name: zoneId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID de la zona en MongoDB
 *     responses:
 *       200:
 *         description: Alertas por zona obtenidas
 *       500:
 *         description: Error al obtener alertas
 */
router.get(
  "/zone/:zoneId",
  aemetAlertsController.getAlertsByZone.bind(aemetAlertsController)
);

// /**
//  * @swagger
//  * /api/aemet-alerts/area:
//  *   post:
//  *     summary: Obtener alertas en un área geográfica
//  *     description: Retorna alertas dentro de un radio especificado
//  *     tags: [AEMET Alerts]
//  *     requestBody:
//  *       required: true
//  *       content:
//  *         application/json:
//  *           schema:
//  *             type: object
//  *             properties:
//  *               latitude:
//  *                 type: number
//  *                 example: 43.2
//  *               longitude:
//  *                 type: number
//  *                 example: -4.85
//  *               radiusKm:
//  *                 type: number
//  *                 example: 50
//  *             required: [latitude, longitude]
//  *     responses:
//  *       200:
//  *         description: Alertas por área obtenidas
//  *       400:
//  *         description: Parámetros faltantes
//  *       500:
//  *         description: Error al obtener alertas
//  */
// router.post(
//   "/area",
//   aemetAlertsController.getAlertsByArea.bind(aemetAlertsController)
// );

logger.debug("AEMET Alerts routes loaded");

module.exports = router;
