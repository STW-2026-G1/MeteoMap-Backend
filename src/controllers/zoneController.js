/**
 * @file Controlador de zonas
 * @module controllers/ZoneController
 * @description Maneja las solicitudes HTTP de zonas meteorológicas y mapea hacia los servicios correspondientes.
 * Gestiona obtención, creación, actualización, eliminación, búsqueda de zonas y sincronización de datos meteorológicos.
 */

const zoneService = require("../services/zoneService");
const logger = require("../config/logger");

class ZoneController {
  /**
   * Obtiene todas las zonas con estado opcional
   * @async
   * @param {Object} req - Objeto de solicitud HTTP
   * @param {string} req.query.estado - Estado de las zonas a obtener (default: ACTIVA)
   * @param {Object} res - Objeto de respuesta HTTP
   * @param {Function} next - Función middleware para pasar al siguiente controlador
   * @returns {Object} Objeto con array de zonas y conteo
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
   * Obtiene una zona específica por su ID
   * @async
   * @param {Object} req - Objeto de solicitud HTTP
   * @param {string} req.params.id - ID de la zona
   * @param {Object} res - Objeto de respuesta HTTP
   * @param {Function} next - Función middleware para pasar al siguiente controlador
   * @returns {Object} Datos de la zona con información meteorológica
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
   * Obtiene datos meteorológicos actuales de una zona
   * @async
   * @param {Object} req - Objeto de solicitud HTTP
   * @param {string} req.params.id - ID de la zona
   * @param {Object} res - Objeto de respuesta HTTP
   * @param {Function} next - Función middleware para pasar al siguiente controlador
   * @returns {Object} Datos meteorológicos actuales y caché
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
   * Obtiene el panel de control de una zona con estadísticas
   * @async
   * @param {Object} req - Objeto de solicitud HTTP
   * @param {string} req.params.id - ID de la zona
   * @param {Object} res - Objeto de respuesta HTTP
   * @param {Function} next - Función middleware para pasar al siguiente controlador
   * @returns {Object} Estadísticas y datos del dashboard de la zona
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
   * Crea una nueva zona
   * @async
   * @param {Object} req - Objeto de solicitud HTTP
   * @param {string} req.body.nombre - Nombre de la zona
   * @param {string} req.body.descripcion - Descripción
   * @param {Object} req.body.geolocalizacion - Coordenadas geográficas
   * @param {string} req.body.estado - Estado de la zona
   * @param {Object} res - Objeto de respuesta HTTP
   * @param {Function} next - Función middleware para pasar al siguiente controlador
   * @returns {Object} Zona creada
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
   * Actualiza una zona existente
   * @async
   * @param {Object} req - Objeto de solicitud HTTP
   * @param {string} req.params.id - ID de la zona
   * @param {string} req.body.nombre - Nuevo nombre
   * @param {string} req.body.descripcion - Nueva descripción
   * @param {Object} req.body.geolocalizacion - Nuevas coordenadas
   * @param {string} req.body.estado - Nuevo estado
   * @param {Object} res - Objeto de respuesta HTTP
   * @param {Function} next - Función middleware para pasar al siguiente controlador
   * @returns {Object} Zona actualizada
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
   * Elimina una zona existente
   * @async
   * @param {Object} req - Objeto de solicitud HTTP
   * @param {string} req.params.id - ID de la zona a eliminar
   * @param {Object} res - Objeto de respuesta HTTP
   * @param {Function} next - Función middleware para pasar al siguiente controlador
   * @returns {Object} Resultado de la eliminación con datos de la zona eliminada
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
   * Busca zonas por query, estado y límite
   * @async
   * @param {Object} req - Objeto de solicitud HTTP
   * @param {string} req.query.query - Término de búsqueda (requerido)
   * @param {string} req.query.estado - Estado a filtrar (default: ACTIVA)
   * @param {number} req.query.limit - Límite de resultados (default: 20)
   * @param {Object} res - Objeto de respuesta HTTP
   * @param {Function} next - Función middleware para pasar al siguiente controlador
   * @returns {Object} Array de zonas que coinciden con la búsqueda
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
   * Sincroniza datos meteorológicos de todas las zonas activas
   * @async
   * @param {Object} req - Objeto de solicitud HTTP
   * @param {Object} res - Objeto de respuesta HTTP
   * @param {Function} next - Función middleware para pasar al siguiente controlador
   * @returns {Object} Resultado de sincronización con estadísticas de éxito/error
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
