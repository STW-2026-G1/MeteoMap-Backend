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
      zona_horaria: data.timezone,
      ultima_actualizacion: new Date(current.time).toISOString(),
    };
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
