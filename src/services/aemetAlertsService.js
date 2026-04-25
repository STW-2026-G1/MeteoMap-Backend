const logger = require("../config/logger");
const tar = require("tar");
const { Readable } = require("stream");
const xml2js = require("xml2js");

/**
 * Servicio para obtener alertas meteorológicas de AEMET
 * API de AEMET - Avisos de Riesgo Meteorológico
 * Documentación: https://www.aemet.es/documentos_d/iantd/salud/Avisos_en_vigor_API_26022018.pdf
 */

class aemetAlertsService {
  constructor() {
    // URL de la API de AEMET para obtener avisos
    this.AEMET_ALERTS_URL = "https://opendata.aemet.es/opendata/api/avisos_cap/ultimoelaborado/area/esp";
    this.AEMET_API_KEY = process.env.AEMET_API_KEY;
  }

  /**
   * Obtener alertas meteorológicas de AEMET
   * @returns {Promise<Array>} Array de alertas procesadas con coordenadas
   */
  async fetchAlerts() {
    try {
      if (!this.AEMET_API_KEY) {
        logger.warn(
          "AEMET_API_KEY no configurada. Usando datos de demo para alertas."
        );
        return 
      }

      logger.debug(
        `Obteniendo alertas de AEMET desde: ${this.AEMET_ALERTS_URL}`
      );

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000);

      const response = await fetch(`${this.AEMET_ALERTS_URL}`, {
        signal: controller.signal,
        headers: {
          "api_key":
            this.AEMET_API_KEY,
        },
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        logger.error(
          `AEMET API error: ${response.status} ${response.statusText}`
        );
        return ;
      }

      const data = await response.json();
      logger.debug(
        `Datos recibidos de AEMET: ${ data.datos} `
      );

      // Procesar y transformar alertas
      return this._processAlerts(data);
    } catch (err) {
      logger.error(
        `Error obteniendo alertas de AEMET: ${err.name} - ${err.message}`
      );
      logger.debug(`Stack trace: ${err.stack}`);

      // Retornar datos de demo si hay error
      return ;
    }
  }

  /**
   * Procesar alertas crudas de AEMET a formato estándar
   * @private
   */
async _processAlerts(data) {
    if (!data || !data.datos) {
      logger.error("No se recibió la URL de descarga en el campo 'datos'");
      return [];
    }

    try {
      // 1. Descargar el archivo TAR (usando la lógica de buffer de tu ejemplo)
      const tarBuffer = await this._downloadTar(data.datos);
      
      // 2. Descomprimir y parsear los XMLs
      const rawAlerts = await this._unpackAndParse(tarBuffer);
      
      // 3. Normalizar al formato de tu Swagger
      return this._normalizeAlerts(rawAlerts);
    } catch (error) {
      logger.error(`Error en el pipeline de procesamiento: ${error.message}`);
      return [];
    }
  }

  /**
   * Descarga el archivo binario (.tar)
   * Adaptado de la función 'download' de tu script IMDb
   */
  async _downloadTar(url) {
    logger.debug(`Descargando archivo comprimido desde: ${url}`);
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Falló la descarga: ${response.statusText}`);
    
    // Lo bajamos como arrayBuffer (equivalente a los chunks de IMDb pero en memoria)
    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  }
  /**
   * Descomprime el TAR en memoria y parsea los XML (CAP)
   */
async _unpackAndParse(buffer) {
  
  }
/**
   * Normalización específica para el formato CAP v1.2 de AEMET
   */
  _normalizeAlerts(rawAlerts) {
    
  }

  /**
   * Parsea el string "lat,long lat,long" y devuelve el primer punto como marcador
   */
  _parseAemetPolygon(polygonStr) {
    if (!polygonStr) return { latitud: 40.41, longitud: -3.70 };

    // Separamos por espacios para obtener los pares "lat,long"
    const points = polygonStr.trim().split(" ");
    
    // Tomamos el primer punto para el marcador del mapa
    const firstPoint = points[0].split(",");
    
    return {
      latitud: parseFloat(firstPoint[0]),
      longitud: parseFloat(firstPoint[1])
    };
  }

  _getNivelNumerico(nivel) {
    const niveles = { 'amarillo': 1, 'naranja': 2, 'rojo': 3 };
    return niveles[nivel] || 0;
  }

  _mapColorByNivel(nivel) {
    const colores = {
      'amarillo': '#f1c40f',
      'naranja': '#e67e22',
      'rojo': '#e74c3c'
    };
    return colores[nivel] || '#95a5a6';
  }
}
module.exports = new aemetAlertsService();