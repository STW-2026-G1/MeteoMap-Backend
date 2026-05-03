const logger = require("../config/logger");
const aemetAlertsService = require("../services/aemetAlertsService");

/**
 * Controlador para gestionar alertas meteorológicas de AEMET
 */
class AemetAlertsController {
  /**
   * Obtener todas las alertas activas
   * GET /api/aemet-alerts
   */
  async getAlerts(req, res) {
    try {
      // Leer el parámetro 'refresh' de la query string
      const forceRefresh = req.query.refresh === 'true';
      logger.debug("AemetAlertsController.getAlerts - Solicitando alertas AEMET");

      const alerts = await aemetAlertsService.fetchAlerts(forceRefresh);

      logger.info(`Alertas AEMET obtenidas: ${alerts.length} alertas activas`);

      res.status(200).json({
        status: "success",
        data: alerts,
        total: alerts.length,
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
   * Obtener alertas filtradas por zona
   * GET /api/aemet-alerts/zone/:zoneId
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
   * Obtener alertas activas en área geográfica
   * POST /api/aemet-alerts/area
   * Body: { latitude, longitude, radiusKm }
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
   * Calcular distancia entre dos puntos usando Haversine
   * @private
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
