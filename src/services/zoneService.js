const Zone = require("../models/Zone");
const Report = require("../models/Report");
const logger = require("../config/logger");
const weatherService = require("./weatherService");

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
   * Verifica caché y actualiza si es necesario desde Open-Meteo
   */
  async getWeatherData(zoneId) {
    try {
      const zone = await Zone.findById(zoneId);
      if (!zone) {
        throw new Error("Zona no encontrada");
      }

      logger.debug(`ZoneService.getWeatherData para zona: ${zoneId}`);

      // Verificar si el caché es válido (menos de 30 minutos)
      const cacheValido = this._isCacheValido(zone.cache_meteo.current, 30);

      let datosMeteo;

      if (cacheValido) {
        logger.debug(`Usando caché para zona: ${zoneId}`);
        datosMeteo = zone.cache_meteo.current.datos_crudos;
      } else {
        logger.debug(`Actualizando datos meteorológicos para zona: ${zoneId}`);

        // Obtener coordenadas
        const [longitud, latitud] = zone.geolocalizacion.coordinates;
        logger.debug(`Coordenadas extraídas - Lat: ${latitud}, Lon: ${longitud}`);

        try {
          // Solicitar datos a Open-Meteo
          const datosNuevos = await weatherService.fetchWeatherData(latitud, longitud);

          // Actualizar caché en la base de datos
          zone.cache_meteo.current = {
            datos_crudos: datosNuevos,
            ultima_actualizacion: new Date(),
          };

          await zone.save();
          logger.info(`Caché current actualizado para zona: ${zoneId}`);

          datosMeteo = datosNuevos;
        } catch (weatherErr) {
          logger.error(`Error al obtener datos de Open-Meteo para zona ${zoneId}: ${weatherErr.message}`);
          
          // Si hay datos en caché antiguo, usarlos como fallback
          if (zone.cache_meteo.current && zone.cache_meteo.current.datos_crudos) {
            logger.warn(`Usando caché antiguo para zona ${zoneId} debido a error de Open-Meteo`);
            datosMeteo = zone.cache_meteo.current.datos_crudos;
          } else {
            // Si no hay fallback, propagar el error
            throw new Error(`No se pudo obtener datos meteorológicos: ${weatherErr.message}`);
          }
        }
      }

      return {
        zona: zone.nombre,
        geolocalizacion: zone.geolocalizacion,
        cache_meteo: {
          current: zone.cache_meteo.current,
          forecast: zone.cache_meteo.forecast,
        },
        datos: datosMeteo,
        nota: "Datos meteorológicos actualizados desde Open-Meteo",
      };
    } catch (err) {
      logger.error(`Error en getWeatherData: ${err.message}`);
      throw err;
    }
  }


  /**
   * Obtener predicción de temperatura de una zona
   * Verifica caché y actualiza si es necesario desde Open-Meteo
   */
  async getWeatherForecast(zoneId) {
    try {
      const zone = await Zone.findById(zoneId);
      if (!zone) {
        throw new Error("Zona no encontrada");
      }

      logger.debug(`ZoneService.getWeatherForecast para zona: ${zoneId}`);

      // Verificar si el caché es válido (menos de 6 horas = 360 minutos)
      const cacheValido = this._isCacheValido(zone.cache_meteo.forecast, 360);

      let datosMeteo;

      if (cacheValido) {
        logger.debug(`Usando caché para zona: ${zoneId}`);
        datosMeteo = zone.cache_meteo.forecast.datos_crudos;
      } else {
        logger.debug(`Actualizando predicción de temperatura para zona: ${zoneId}`);

        // Obtener coordenadas
        const [longitud, latitud] = zone.geolocalizacion.coordinates;
        logger.debug(`Coordenadas extraídas - Lat: ${latitud}, Lon: ${longitud}`);

        try {
          // Solicitar datos a Open-Meteo
          const datosNuevos = await weatherService.fetchWeatherForecast(latitud, longitud);

          // Actualizar caché en la base de datos
          zone.cache_meteo.forecast = {
            datos_crudos: datosNuevos,
            ultima_actualizacion: new Date(),
          };

          await zone.save();
          logger.info(`Caché forecast actualizado para zona: ${zoneId}`);

          datosMeteo = datosNuevos;
        } catch (weatherErr) {
          logger.error(`Error al obtener predicción de Open-Meteo para zona ${zoneId}: ${weatherErr.message}`);
          
          // Si hay datos en caché antiguo, usarlos como fallback
          if (zone.cache_meteo.forecast && zone.cache_meteo.forecast.datos_crudos) {
            logger.warn(`Usando caché antiguo para zona ${zoneId} debido a error de Open-Meteo`);
            datosMeteo = zone.cache_meteo.forecast.datos_crudos;
          } else {
            // Si no hay fallback, propagar el error
            throw new Error(`No se pudo obtener predicción meteorológica: ${weatherErr.message}`);
          }
        }
      }

      return {
        zona: zone.nombre,
        geolocalizacion: zone.geolocalizacion,
        cache_meteo: {
          current: zone.cache_meteo.current,
          forecast: zone.cache_meteo.forecast,
        },
        datos: datosMeteo,
        nota: "Predicción de temperatura actualizada desde Open-Meteo",
      };
    } catch (err) {
      logger.error(`Error en getWeatherForecast: ${err.message}`);
      throw err;
    }
  }



  /**
   * Verificar si el caché es válido (menos de X minutos)
   * @private
   * @param {Object} cache - Objeto con datos_crudos y ultima_actualizacion
   * @param {number} tiempoValido - Minutos para considerar válido el caché
   */
  _isCacheValido(cache, tiempoValido) {
    if (!cache || !cache.ultima_actualizacion) {
      return false;
    }

    const minutosTranscurridos =
      (new Date() - new Date(cache.ultima_actualizacion)) / (1000 * 60);

    return minutosTranscurridos < tiempoValido;
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
              avg_confirmaciones: { $avg: { $size: { $ifNull: ["$validaciones.usuarios_confirmaron", []] } } },
              avg_desmentidos: { $avg: { $size: { $ifNull: ["$validaciones.usuarios_desmintieron", []] } } },
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

  /**
   * Crear una nueva zona
   */
  async createZone(zoneData) {
    try {
      // Validaciones básicas
      if (!zoneData.nombre) {
        throw new Error("El nombre de la zona es requerido");
      }
      if (!zoneData.geolocalizacion || !zoneData.geolocalizacion.coordinates) {
        throw new Error("La geolocalización con coordenadas es requerida");
      }

      // Crear nueva zona
      const newZone = new Zone({
        nombre: zoneData.nombre,
        descripcion: zoneData.descripcion || "",
        geolocalizacion: {
          type: "Point",
          coordinates: zoneData.geolocalizacion.coordinates,
        },
        estado: zoneData.estado || "ACTIVA",
        cache_meteo: {
          datos_crudos: null,
          ultima_actualizacion: null,
        },
      });

      // Guardar en la base de datos
      await newZone.save();

      logger.info(`ZoneService.createZone: Nueva zona creada con ID ${newZone._id}`);

      return newZone;
    } catch (err) {
      logger.error(`Error en createZone: ${err.message}`);
      throw err;
    }
  }

  /**
   * Eliminar una zona por ID
   */
  async deleteZone(zoneId) {
    try {
      const deletedZone = await Zone.findByIdAndDelete(zoneId);
      
      if (!deletedZone) {
        throw new Error("Zona no encontrada");
      }

      logger.info(`ZoneService.deleteZone: Zona eliminada con ID ${zoneId}`);

      return deletedZone;
    } catch (err) {
      logger.error(`Error en deleteZone: ${err.message}`);
      throw err;
    }
  }
}

module.exports = new ZoneService();
