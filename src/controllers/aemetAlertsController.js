/**
 * @file Controlador de alertas meteorológicas AEMET
 * @module controllers/AemetAlertsController
 * @description Maneja las solicitudes HTTP de alertas meteorológicas de la AEMET (Agencia Estatal de Meteorología).
 * Gestiona obtención de alertas globales, filtrado por zona y por área geográfica con cálculo de distancias.
 */

const logger = require("../config/logger");
const aemetAlertsService = require("../services/aemetAlertsService");

/**
 * Controlador para gestionar alertas meteorológicas de AEMET
 */
class AemetAlertsController {
  /**
   * Obtiene todas las alertas activas desde la AEMET
   * @async
   * @param {Object} req - Objeto de solicitud HTTP
   * @param {boolean} req.query.refresh - Fuerza actualización de datos (default: false)
   * @param {boolean} req.query.withPolygons - Incluye polígonos GeoJSON en respuesta (default: false)
   * @param {Object} res - Objeto de respuesta HTTP
   * @returns {Object} Array de alertas con metadatos
   */
  async getAlerts(req, res) {
    try {
      // Leer el parámetro 'refresh' de la query string
      const forceRefresh = req.query.refresh === 'true';
      // Control opcional para incluir polígonos en la respuesta
      const withPolygons = req.query.withPolygons === 'true';
      logger.debug("AemetAlertsController.getAlerts - Solicitando alertas AEMET");

      const alerts = await aemetAlertsService.fetchAlerts(forceRefresh);

      // Si el cliente no pide polígonos, los eliminamos para ahorrar payload
      const responseAlerts = withPolygons ? alerts : alerts.map(a => {
        const copy = { ...a };
        delete copy.poligono_geojson;
        delete copy.poligono_raw;
        return copy;
      });

      logger.info(`Alertas AEMET obtenidas: ${alerts.length} alertas activas`);

      res.status(200).json({
        status: "success",
        data: responseAlerts,
        total: responseAlerts.length,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error(`Error en getAlerts: ${error.message}`);
      res.status(500).json({

        status: "error",
        error: "Error al obtener alertas",
        message: error.message,


      });
    }
  }

  /**
   * Obtiene alertas filtradas por zona específica
   * @async
   * @param {Object} req - Objeto de solicitud HTTP
   * @param {string} req.params.zoneId - ID de la zona
   * @param {Object} res - Objeto de respuesta HTTP
   * @returns {Object} Array de alertas cercanas a la zona especificada
   */
  async getAlertsByZone(req, res) {
    try {
      const { zoneId } = req.params;

      logger.debug(
        `AemetAlertsController.getAlertsByZone - Zona: ${zoneId}`
      );

      const allAlerts = await aemetAlertsService.fetchAlerts();

      // Filtrar alertas que están cerca de la zona (dentro de 50 km aproximadamente)
      const zoneAlerts = allAlerts.filter((alert) => {
        // En producción, obtener las coordenadas reales de la zona
        // y calcular distancia con Haversine
        return true; // Por ahora retornar todas las alertas
      });

      res.status(200).json({
        status: "success",
        data: zoneAlerts,
        zoneId,
        total: zoneAlerts.length,
      });
    } catch (error) {

      logger.error(
        `Error en getAlertsByZone: ${error.message}`
      );
      res.status(500).json({
        status: "error",
        error: "Error al obtener alertas por zona",
        message: error.message,


      });
    }
  }

  /**
   * Obtiene alertas activas en un área geográfica específica
   * @async
   * @param {Object} req - Objeto de solicitud HTTP
   * @param {number} req.body.latitude - Latitud del centro del área
   * @param {number} req.body.longitude - Longitud del centro del área
   * @param {number} req.body.radiusKm - Radio en kilómetros (default: 50)
   * @param {Object} res - Objeto de respuesta HTTP
   * @returns {Object} Array de alertas dentro del área especificada
   */
  async getAlertsByArea(req, res) {
    try {
      const { latitude, longitude, radiusKm = 50 } = req.body;

      if (!latitude || !longitude) {
        return res.status(400).json({
          status: "error",
          error: "Latitud y longitud requeridas",
        });
      }

      logger.debug(
        `AemetAlertsController.getAlertsByArea - [${latitude}, ${longitude}], radio: ${radiusKm}km`
      );

      const allAlerts = await aemetAlertsService.fetchAlerts();

      // Filtrar alertas dentro del área especificada
      const areaAlerts = allAlerts.filter((alert) => {
        const distance = this._calculateDistance(
          latitude,
          longitude,
          alert.coordenadas.latitud,
          alert.coordenadas.longitud
        );
        return distance <= radiusKm;
      });

      res.status(200).json({
        status: "success",
        data: areaAlerts,
        area: { latitude, longitude, radiusKm },
        total: areaAlerts.length,
      });
    } catch (error) {

      logger.error(
        `Error en getAlertsByArea: ${error.message}`
      );
      res.status(500).json({
        status: "error",
        error: "Error al obtener alertas por área",
        message: error.message,


      });
    }
  }

  /**
   * Calcula la distancia entre dos puntos geográficos usando la fórmula de Haversine
   * @private
   * @param {number} lat1 - Latitud del primer punto
   * @param {number} lon1 - Longitud del primer punto
   * @param {number} lat2 - Latitud del segundo punto
   * @param {number} lon2 - Longitud del segundo punto
   * @returns {number} Distancia en kilómetros
   */
  _calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // Radio de la Tierra en km
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }
}

module.exports = new AemetAlertsController();