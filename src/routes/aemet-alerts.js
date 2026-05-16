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
 *     parameters:
 *       - in: query
 *         name: forceRefresh
 *         required: false
 *         schema:
 *           type: boolean
 *           default: false
 *         description: Fuerza ignorar la caché y consultar AEMET directamente
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


logger.debug("AEMET Alerts routes loaded");

module.exports = router;
