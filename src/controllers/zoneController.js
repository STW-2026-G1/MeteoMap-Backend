const zoneService = require("../services/zoneService");
const logger = require("../config/logger");

class ZoneController {
  /**
   * GET /api/zones
   */
  async getZones(req, res, next) {
    try {
      const { estado } = req.query;
      const result = await zoneService.getZones(estado || "ACTIVA");
      res.json(result);
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/zones/:id
   */
  async getZoneById(req, res, next) {
    try {
      const { id } = req.params;
      const zone = await zoneService.getZoneById(id);
      res.json(zone);
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/zones/:id/weather
   */
  async getWeatherData(req, res, next) {
    try {
      const { id } = req.params;
      const weather = await zoneService.getWeatherData(id);
      res.json(weather);
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/zones/:id/dashboard
   */
  async getZoneDashboard(req, res, next) {
    try {
      const { id } = req.params;
      const dashboard = await zoneService.getZoneDashboard(id);
      res.json(dashboard);
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new ZoneController();
