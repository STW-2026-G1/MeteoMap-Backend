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
      
      // Transformar el formato de respuesta
      res.json({
        status: "success",
        count: result.count,
        data: result.zones.map((zone) => ({
          _id: zone._id,
          nombre: zone.nombre,
          descripcion: zone.descripcion,
          estado: zone.estado,
          geolocalizacion: zone.geolocalizacion,
          cache_meteo: zone.cache_meteo,
        })),
      });
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
      
      // Transformar el formato de respuesta
      /*
      IMPORTANTE: HE CAMBIADO EL FORMATO DE LA RESPUESTA PORQUE ME PARECIA MÁS COMODO
      SEGURAMENTE SEA INNECESARIO Y ES MEJOR DEJARLO COMO RES.JSON(RESULT) PERO ME VIENE 
      MUY BIEN PARA DEBUGEAR
      */
      res.json({
        status: "success",
        data: {
          _id: zone._id,
          nombre: zone.nombre,
          descripcion: zone.descripcion,
          estado: zone.estado,
          geolocalizacion: zone.geolocalizacion,
          cache_meteo: zone.cache_meteo,
        },
      });
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
      
      // Transformar el formato de respuesta
      res.json({
        status: "success",
        data: {
          _id: id,
          zona: weather.zona,
          geolocalizacion: weather.geolocalizacion,
          datos_meteorologicos: weather.datos,
          cache_meteo: weather.cache_meteo,
          nota: weather.nota,
        },
      });
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
      
      // Transformar el formato de respuesta
      res.json({
        status: "success",
        data: {
          _id: id,
          zona: dashboard.zona,
          estadisticas: dashboard.estadisticas,
          nota: dashboard.nota,
        },
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/zones
   */
  async createZone(req, res, next) {
    try {
      const { nombre, descripcion, geolocalizacion, estado } = req.body;
      const newZone = await zoneService.createZone({
        nombre,
        descripcion,
        geolocalizacion,
        estado,
      });
      
      // Transformar el formato de respuesta
      res.status(201).json({
        status: "success",
        message: "Zona creada exitosamente",
        data: {
          _id: newZone._id,
          nombre: newZone.nombre,
          descripcion: newZone.descripcion,
          estado: newZone.estado,
          geolocalizacion: newZone.geolocalizacion,
          cache_meteo: newZone.cache_meteo,
        },
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * DELETE /api/zones/:id
   */
  async deleteZone(req, res, next) {
    try {
      const { id } = req.params;
      const deletedZone = await zoneService.deleteZone(id);
      
      // Transformar el formato de respuesta
      res.json({
        status: "success",
        message: "Zona eliminada correctamente",
        data: {
          _id: deletedZone._id,
          nombre: deletedZone.nombre,
          descripcion: deletedZone.descripcion,
          estado: deletedZone.estado,
          geolocalizacion: deletedZone.geolocalizacion,
          cache_meteo: deletedZone.cache_meteo,
        },
      });
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new ZoneController();
