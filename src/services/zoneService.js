const Zone = require("../models/Zone");
const Report = require("../models/Report");
const logger = require("../config/logger");

class ZoneService {
  /**
   * Obtener todas las zonas activas
   */
  async getZones(estado = "ACTIVA") {
    try {
      const zones = await Zone.find({ estado });
      logger.debug("ZoneService.getZones");

      return {
        count: zones.length,
        zones,
      };
    } catch (err) {
      logger.error(`Error en getZones: ${err.message}`);
      throw err;
    }
  }

  /**
   * Obtener zona por ID
   */
  async getZoneById(zoneId) {
    try {
      const zone = await Zone.findById(zoneId);
      if (!zone) {
        throw new Error("Zona no encontrada");
      }

      logger.debug(`ZoneService.getZoneById: ${zoneId}`);

      return zone;
    } catch (err) {
      logger.error(`Error en getZoneById: ${err.message}`);
      throw err;
    }
  }

  /**
   * Obtener datos meteorológicos de una zona
   */
  async getWeatherData(zoneId) {
    try {
      const zone = await Zone.findById(zoneId);
      if (!zone) {
        throw new Error("Zona no encontrada");
      }

      logger.debug(`ZoneService.getWeatherData para zona: ${zoneId}`);

      return {
        zona: zone.nombre,
        geolocalizacion: zone.geolocalizacion,
        cache_meteo: zone.cache_meteo || {},
        nota: "Los datos meteorológicos se actualizan desde la API externa (AEMET/Open-Meteo)",
      };
    } catch (err) {
      logger.error(`Error en getWeatherData: ${err.message}`);
      throw err;
    }
  }

  /**
   * Obtener dashboard de una zona con estadísticas
   */
  async getZoneDashboard(zoneId) {
    try {
      const zone = await Zone.findById(zoneId);
      if (!zone) {
        throw new Error("Zona no encontrada");
      }

      // Estadísticas de reportes para esta zona
      const reportStats = await Report.aggregate([
        { $match: { zona_id: zone._id } },
        {
          $group: {
            _id: "$tipo",
            count: { $sum: 1 },
            avg_confirmaciones: { $avg: "$validaciones.confirmaciones" },
            avg_desmentidos: { $avg: "$validaciones.desmentidos" },
          },
        },
        { $sort: { count: -1 } },
      ]);

      logger.debug(`ZoneService.getZoneDashboard para zona: ${zoneId}`);

      return {
        zona: zone.nombre,
        estadisticas: reportStats,
        nota: "Datos agregados de reportes de la comunidad",
      };
    } catch (err) {
      logger.error(`Error en getZoneDashboard: ${err.message}`);
      throw err;
    }
  }
}

module.exports = new ZoneService();
