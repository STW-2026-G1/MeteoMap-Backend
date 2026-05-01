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
      
      // Transformar el formato de respuesta - solo campos válidos
      res.json({
        status: "success",
        count: result.count,
        data: result.zones.map((zone) => ({
          _id: zone._id,
          nombre: zone.nombre,
          descripcion: zone.descripcion,
          estado: zone.estado,
          geolocalizacion: zone.geolocalizacion,
          cache_meteo: {
            current: zone.cache_meteo?.current || null,
            forecast: zone.cache_meteo?.forecast || null,
          },
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
      
      // Transformar el formato de respuesta - solo campos válidos
      res.json({
        status: "success",
        data: {
          _id: zone._id,
          nombre: zone.nombre,
          descripcion: zone.descripcion,
          estado: zone.estado,
          geolocalizacion: zone.geolocalizacion,
          cache_meteo: {
            current: zone.cache_meteo?.current || null,
            forecast: zone.cache_meteo?.forecast || null,
          },
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
          cache_meteo: {
            current: weather.cache_meteo?.current || null,
            forecast: weather.cache_meteo?.forecast || null,
          },
          nota: weather.nota,
        },
      });
    } catch (err) {
      next(err);
    }
  }

    /**
   * GET /api/zones/:Id/forecast
   */
  async getWeatherForecast(req, res, next) {
    try {
      const { id } = req.params;
      const weather = await zoneService.getWeatherForecast(id);
      
      // Transformar el formato de respuesta
      res.json({
        status: "success",
        data: {
          _id: id,
          zona: weather.zona,
          geolocalizacion: weather.geolocalizacion,
          datos_crudos: weather.datos,
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
          cache_meteo: {
            current: newZone.cache_meteo?.current || null,
            forecast: newZone.cache_meteo?.forecast || null,
          },
        },
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * PUT /api/zones/:id
   */
  async updateZone(req, res, next) {
    try {
      const { id } = req.params;
      const { nombre, descripcion, geolocalizacion, estado } = req.body;
      const updatedZone = await zoneService.updateZone(id, {
        nombre,
        descripcion,
        geolocalizacion,
        estado,
      });

      res.json({
        status: "success",
        message: "Zona actualizada exitosamente",
        data: {
          _id: updatedZone._id,
          nombre: updatedZone.nombre,
          descripcion: updatedZone.descripcion,
          estado: updatedZone.estado,
          geolocalizacion: updatedZone.geolocalizacion,
          cache_meteo: {
            current: updatedZone.cache_meteo?.current || null,
            forecast: updatedZone.cache_meteo?.forecast || null,
          },
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
          cache_meteo: {
            current: deletedZone.cache_meteo?.current || null,
            forecast: deletedZone.cache_meteo?.forecast || null,
          },
        },
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/zones/search
   */
  async searchZones(req, res, next) {
    try {
      const { query, estado, limit } = req.query;
      
      if (!query) {
        return res.status(400).json({
          status: "error",
          message: "El parámetro 'query' es requerido"
        });
      }

      const result = await zoneService.searchZones(
        query,
        estado || "ACTIVA",
        limit ? parseInt(limit) : 20
      );
      
      res.json({
        status: "success",
        count: result.count,
        query: result.query,
        data: result.zones.map((zone) => ({
          _id: zone._id,
          nombre: zone.nombre,
          descripcion: zone.descripcion,
          estado: zone.estado,
          geolocalizacion: zone.geolocalizacion,
          cache_meteo: {
            current: zone.cache_meteo?.current || null,
            forecast: zone.cache_meteo?.forecast || null,
          },
        })),
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/zones/weather
   * Sincronizar datos meteorológicos de todas las zonas activas
   */
  async syncWeatherData(req, res, next) {
    try {
      const weatherService = require("../services/weatherService");
      const result = await weatherService.syncAllZonesWeather();

      // Determinar status HTTP basado en tasa de éxito
      const total = result.success + result.failed;
      const successRate = total > 0 ? (result.success / total) * 100 : 0;

      let statusCode = 200;
      if (successRate < 80 && successRate > 0) {
        statusCode = 206; // Partial Content
      } else if (successRate === 0) {
        statusCode = 500;
      }

      return res.status(statusCode).json({
        status: statusCode === 200 ? "success" : statusCode === 206 ? "partial" : "error",
        success: result.success,
        failed: result.failed,
        errors: result.errors,
        message: result.message,
        timestamp: result.timestamp,
      });
    } catch (err) {
      logger.error(`Error en syncWeatherData: ${err.message}`);
      return res.status(500).json({
        status: "error",
        error: "Error sincronizando datos meteorológicos",
        message: err.message,
        timestamp: new Date().toISOString(),
      });
    }
  }
}

module.exports = new ZoneController();
