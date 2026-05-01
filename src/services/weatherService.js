const logger = require("../config/logger");

/**
 * Servicio para obtener datos meteorológicos de Open-Meteo
 * API gratuita, sin requiere API key
 * Documentación: https://open-meteo.com/
 */

class WeatherService {
  /**
   * Obtener datos meteorológicos de Open-Meteo
   * @param {number} latitude - Latitud
   * @param {number} longitude - Longitud
   * @returns {Promise<Object>} Datos meteorológicos
   */
  async fetchWeatherData(latitude, longitude) {
    try {
      const url = new URL("https://api.open-meteo.com/v1/forecast");
      url.searchParams.append("latitude", latitude);
      url.searchParams.append("longitude", longitude);
      url.searchParams.append("current", "temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m,wind_direction_10m,precipitation,rain,showers,snowfall,visibility");
      url.searchParams.append("timezone", "Europe/Madrid");

      logger.debug(`Solicitando datos meteorológicos a Open-Meteo para [${latitude}, ${longitude}]`);

      // Agregar timeout de 10 segundos
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      const response = await fetch(url.toString(), {
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        logger.error(`Open-Meteo API error: ${response.status} ${response.statusText}`);
        throw new Error(`Open-Meteo API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();

      logger.debug("Datos recibidos de Open-Meteo");

      // Transformar respuesta de Open-Meteo a formato estándar
      return this._transformOpenMeteoData(data);
    } catch (err) {
      logger.error(`Error obteniendo datos de Open-Meteo: ${err.name} - ${err.message}`);
      // Loguear el stack trace completo en debug
      logger.debug(`Stack trace: ${err.stack}`);
      throw new Error(`Error de conexión con Open-Meteo: ${err.message}`);
    }
  }

  /**
   * Obtener predicción de temperatura para las próximas 6 horas
   * @param {number} latitude - Latitud
   * @param {number} longitude - Longitud
   * @returns {Promise<Array>} Array con predicción horaria
   */
  async fetchWeatherForecast(latitude, longitude) {
    try {
      const url = new URL("https://api.open-meteo.com/v1/forecast");
      url.searchParams.append("latitude", latitude);
      url.searchParams.append("longitude", longitude);
      url.searchParams.append("hourly", "temperature_2m");
      url.searchParams.append("forecast_hours", "12");
      url.searchParams.append("timezone", "Europe/Madrid");

      logger.debug(`Solicitando predicción de temperatura para [${latitude}, ${longitude}]`);

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      const response = await fetch(url.toString(), {
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        logger.error(`Open-Meteo API error: ${response.status} ${response.statusText}`);
        throw new Error(`Open-Meteo API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();

      logger.debug("Predicción de temperatura recibida de Open-Meteo");

      // Transformar respuesta a formato estándar
      return data.hourly.time.map((time, index) => ({
        hora: new Date(time).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }),
        temperatura: Math.round(data.hourly.temperature_2m[index])
      }));
    } catch (err) {
      logger.error(`Error obteniendo predicción de Open-Meteo: ${err.name} - ${err.message}`);
      logger.debug(`Stack trace: ${err.stack}`);
      throw new Error(`Error de conexión con Open-Meteo: ${err.message}`);
    }
  }

  /**
   * Sincronizar datos meteorológicos de todas las zonas activas
   * Realiza UNA sola petición a Open-Meteo con todas las coordenadas
   * @returns {Promise<Object>} {success, failed, errors, timestamp}
   */
  async syncAllZonesWeather() {
    const Zone = require("../models/Zone");
    const SystemMetric = require("../models/SystemMetric");
    
    const startTime = Date.now();
    let success = 0;
    let failed = 0;
    const errors = [];

    try {
      // 1. Obtener todas las zonas activas
      const zones = await Zone.find({ estado: "ACTIVA" });
      
      if (zones.length === 0) {
        logger.warn("No hay zonas activas para sincronizar");
        return { success: 0, failed: 0, errors: [], message: "No hay zonas activas" };
      }

      logger.info(`Iniciando sincronización de ${zones.length} zonas`);

      // 2. Construir arrays de latitudes y longitudes
      const latitudes = zones.map(z => z.geolocalizacion.coordinates[1]).join(",");
      const longitudes = zones.map(z => z.geolocalizacion.coordinates[0]).join(",");

      // 3. Hacer UNA petición a Open-Meteo con todas las coordenadas (current + forecast)
      const weatherData = await this._fetchWeatherDataBatch(latitudes, longitudes);

      // 4. Actualizar cache de cada zona
      for (let i = 0; i < zones.length; i++) {
        try {
          // Transformar datos current
          const transformedData = this._transformOpenMeteoData(weatherData[i]);
          
          zones[i].cache_meteo.current = {
            datos_crudos: transformedData,
            ultima_actualizacion: new Date(),
          };

          // Transformar datos forecast (12 horas)
          const forecastData = this._transformForecastData(weatherData[i]);
          zones[i].cache_meteo.forecast = {
            datos_crudos: forecastData,
            ultima_actualizacion: new Date(),
          };

          await zones[i].save();
          success++;

          logger.debug(`Zona "${zones[i].nombre}" actualizada correctamente (current + forecast)`);
        } catch (zoneErr) {
          failed++;
          const errorMsg = `Error actualizando zona ${zones[i].nombre}: ${zoneErr.message}`;
          errors.push(errorMsg);
          logger.error(errorMsg);
        }
      }

      const duration = Date.now() - startTime;
      const successRate = Math.round((success / zones.length) * 100);

      // 5. Registrar métrica en SystemMetric ¿Necesario?
      await SystemMetric.create({
        origen: "API_METEO",
        tipo: "LATENCIA",
        valor: duration,
        detalles: {
          zonas_totales: zones.length,
          zonas_actualizadas: success,
          zonas_fallidas: failed,
          tasa_exito: `${successRate}%`,
          timestamp: new Date().toISOString(),
        },
      });

      logger.info(`Sincronización completada: ${success}/${zones.length} zonas actualizadas (current + forecast 12h) en ${duration}ms (${successRate}%)`);

      return {
        success,
        failed,
        errors,
        message: `${success} de ${zones.length} zonas actualizadas correctamente (current + forecast)`,
        timestamp: new Date().toISOString(),
      };
    } catch (err) {
      logger.error(`Error crítico en syncAllZonesWeather: ${err.message}`);
      
      // Registrar error en SystemMetric
      await SystemMetric.create({
        origen: "API_METEO",
        tipo: "ERROR",
        valor: 0,
        detalles: {
          error: err.message,
          timestamp: new Date().toISOString(),
        },
      });

      throw err;
    }
  }

  /**
   * Obtener datos meteorológicos y forecast de múltiples ubicaciones en una sola petición
   * @private
   * @param {string} latitudes - Latitudes separadas por comas (ej: "40.1,41.5")
   * @param {string} longitudes - Longitudes separadas por comas (ej: "-3.7,-2.3")
   * @returns {Promise<Array>} Array de datos meteorológicos (uno por ubicación)
   */
  async _fetchWeatherDataBatch(latitudes, longitudes) {
    try {
      const url = new URL("https://api.open-meteo.com/v1/forecast");
      url.searchParams.append("latitude", latitudes);
      url.searchParams.append("longitude", longitudes);
      url.searchParams.append("current", "temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m,wind_direction_10m,precipitation,rain,showers,snowfall,visibility");
      url.searchParams.append("hourly", "temperature_2m");
      url.searchParams.append("forecast_hours", "12");
      url.searchParams.append("timezone", "Europe/Madrid");

      logger.debug(`Solicitando datos meteorológicos y forecast (12h) de Open-Meteo para ${latitudes.split(",").length} ubicaciones`);

      // Timeout de 15 segundos para petición batch
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000);

      const response = await fetch(url.toString(), {
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        logger.error(`Open-Meteo API error: ${response.status} ${response.statusText}`);
        throw new Error(`Open-Meteo API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();

      // Cuando se envían múltiples coords separadas por comas, Open-Meteo retorna un array directo
      // [{"latitude": ..., "current": {...}}, {"latitude": ..., "current": {...}}]
      // Cuando es una sola coord, retorna un objeto directo
      // {"latitude": ..., "current": {...}}
      
      if (Array.isArray(data)) {
        logger.debug(`Datos de ${data.length} ubicaciones recibidos de Open-Meteo (array)`);
        return data;
      } else {
        logger.debug("Dato de una única ubicación recibido de Open-Meteo (objeto)");
        return [data];
      }
    } catch (err) {
      logger.error(`Error en _fetchWeatherDataBatch: ${err.name} - ${err.message}`);
      logger.debug(`Stack trace: ${err.stack}`);
      throw new Error(`Error sincronizando datos meteorológicos: ${err.message}`);
    }
  }

  /**
   * Transformar datos de Open-Meteo a formato estándar
   * @private
   */
  _transformOpenMeteoData(data) {
    const current = data.current;

    return {
      temperatura: current.temperature_2m,
      temperatura_aparente: current.apparent_temperature,
      humedad: current.relative_humidity_2m,
      codigo_clima: current.weather_code,
      descripcion: this._getWeatherDescription(current.weather_code),
      velocidad_viento: current.wind_speed_10m,
      direccion_viento: current.wind_direction_10m,
      precipitacion: current.precipitation,
      lluvia: current.rain,
      nieve: current.snowfall,
      visibilidad: current.visibility,
    };
  }

  /**
   * Transformar datos de forecast (horarios) de Open-Meteo a formato estándar
   * @private
   */
  _transformForecastData(data) {
    if (!data.hourly || !data.hourly.time || !data.hourly.temperature_2m) {
      logger.warn("Datos de forecast incompletos");
      return [];
    }

    return data.hourly.time.map((time, index) => ({
      hora: new Date(time).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }),
      temperatura: Math.round(data.hourly.temperature_2m[index]),
    }));
  }

  /**
   * Obtener descripción del clima basada en código WMO
   * @private
   */
  _getWeatherDescription(code) {
    const descriptions = {
      0: "Despejado",
      1: "Principalmente despejado",
      2: "Parcialmente nublado",
      3: "Nublado",
      45: "Brumoso",
      48: "Brumoso con depósito de escarcha",
      51: "Llovizna ligera",
      53: "Llovizna moderada",
      55: "Llovizna densa",
      61: "Lluvia ligera",
      63: "Lluvia moderada",
      65: "Lluvia fuerte",
      71: "Nieve ligera",
      73: "Nieve moderada",
      75: "Nieve fuerte",
      77: "Granos de nieve",
      80: "Chubascos ligeros",
      81: "Chubascos moderados",
      82: "Chubascos violentos",
      85: "Chubascos de nieve ligeros",
      86: "Chubascos de nieve fuertes",
      95: "Tormenta",
      96: "Tormenta con granizo ligero",
      99: "Tormenta con granizo fuerte",
    };

    return descriptions[code] || "Desconocido";
  }
}

module.exports = new WeatherService();
