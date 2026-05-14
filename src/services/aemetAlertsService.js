const logger = require("../config/logger");
const tar = require("tar");
const { Readable } = require("stream");
const xml2js = require("xml2js");
const AemetAlert = require("../models/AemetAlert");

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
    
    // Sistema de caché con TTL de 30 minutos
    this.cache = null;
    this.cacheTimestamp = null;
    this.CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutos en milisegundos
  }

  /**
   * Obtener alertas meteorológicas de AEMET (con caché de 30 minutos)
   * @returns {Promise<Array>} Array de alertas procesadas con coordenadas
   */
  async fetchAlerts(forceRefresh = false) {
    const startedAt = Date.now();

    try {
      logger.debug(
        `AEMET fetchAlerts iniciado. forceRefresh=${forceRefresh}, cacheValida=${this._isCacheValid()}`
      );

      // Verificar caché válido. Filtrar la caché para no devolver alertas ya caducadas
      if (this._isCacheValid() && !forceRefresh) {
        logger.info(`Usando alertas en caché (edad: ${this._getCacheAge()}ms)`);
        const now = new Date();
        const filteredCache = Array.isArray(this.cache)
          ? this.cache.filter(a => {
              try {
                return new Date(a.validez_fin) >= now;
              } catch (e) {
                return false;
              }
            })
          : [];

        if (filteredCache.length !== (this.cache ? this.cache.length : 0)) {
          logger.info(`Caché: eliminadas ${ (this.cache ? this.cache.length - filteredCache.length : 0) } alertas expiradas`);
          this.cache = filteredCache;
          this.cacheTimestamp = Date.now();
        }

        return filteredCache;
      }

      if (!this.AEMET_API_KEY) {
        logger.warn(
          "AEMET_API_KEY no configurada. Usando datos de demo para alertas."
        );
        return [];
      }

      logger.debug(`Obteniendo alertas de AEMET desde: ${this.AEMET_ALERTS_URL}`);

      const controller = new AbortController();
      const timeoutMs = 30000;
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
      const requestStartedAt = Date.now();

      logger.debug(`AEMET request 1 iniciado con timeout=${timeoutMs}ms`);

      let response;
      try {
        response = await fetch(`${this.AEMET_ALERTS_URL}`, {
          signal: controller.signal,
          headers: {
            "api_key": this.AEMET_API_KEY,
          },
        });
      } catch (fetchErr) {
        const duration = Date.now() - requestStartedAt;
        logger.error(
          `AEMET request 1 falló tras ${duration}ms: ${fetchErr.name} - ${fetchErr.message}`
        );
        logger.debug(`AEMET request 1 stack: ${fetchErr.stack}`);
        throw fetchErr;
      } finally {
        clearTimeout(timeoutId);
      }

      logger.debug(
        `AEMET request 1 completado en ${Date.now() - requestStartedAt}ms con status=${response.status}`
      );

      if (!response.ok) {
        logger.error(
          `AEMET API error: ${response.status} ${response.statusText}`
        );
        // Si hay caché en memoria, devolverla (filtrada por validez)
        if (this.cache) {
          logger.warn('Usando caché obsoleto por error en API');
          const now = new Date();
          const filteredCache = Array.isArray(this.cache)
            ? this.cache.filter(a => {
                try { return new Date(a.validez_fin) >= now; } catch (e) { return false; }
              })
            : [];
          this.cache = filteredCache;
          this.cacheTimestamp = Date.now();
          return filteredCache;
        }

        // Si no hay caché, recuperar alertas activas directamente desde la BD
        try {
          const activeAlertsFromDb = await AemetAlert.find({ validez_fin: { $gte: new Date() } }).lean();
          const formattedAlerts = activeAlertsFromDb.map(doc => ({
            ...doc,
            id: doc.aemet_id,
            _id: doc._id.toString(),
          }));
          // Actualizar caché con los datos de la BD
          this.cache = formattedAlerts;
          this.cacheTimestamp = Date.now();
          return formattedAlerts;
        } catch (dbErr) {
          logger.error(`Error recuperando alertas desde BD tras fallo AEMET: ${dbErr.message}`);
          return [];
        }
      }

      const data = await response.json();
      logger.debug(
        `Datos recibidos de AEMET: ${data.datos}`
      );

      // Procesar y transformar alertas
      const alerts = await this._processAlerts(data);
      logger.info(`alertas procesadas: ${alerts.length}`);
      // Filtrar alertas ya procesadas anteriormente
      const newAlerts = await this._filterNewAlerts(alerts);
      logger.info(`alertas filtradas: ${newAlerts.length}`);
      // Guardar en BD las nuevas alertas
      if (newAlerts.length > 0) {
        await this._saveAlertsToDatabase(newAlerts);
         logger.info(`alertas guardadas`);
      }
      
      // Consultar TODAS las alertas activas de la Base de Datos
      // Filtramos por fecha de validez_fin para no enviar alertas caducadas
      const activeAlertsFromDb = await AemetAlert.find({
        validez_fin: { $gte: new Date() }
      }).lean();

      // 3. Importante: Mapear 'aemet_id' de vuelta a 'id' para que el frontend no rompa
      const formattedAlerts = activeAlertsFromDb.map(doc => ({
        ...doc,
        id: doc.aemet_id,             // Id de la aemet
        _id: doc._id.toString(),      // Mantenemos el ID de Mongo
      }));

      // 4. Actualizar caché con los datos reales de la BD
      this.cache = formattedAlerts;
      this.cacheTimestamp = Date.now();

      logger.info(`Servicio: Devolviendo ${formattedAlerts.length} alertas desde la Base de Datos.`);
      logger.debug(`AEMET fetchAlerts completado en ${Date.now() - startedAt}ms`);
      return formattedAlerts;
    } catch (err) {
      logger.error(`Error obteniendo alertas de AEMET: ${err.name} - ${err.message}`);
      logger.error(
        `AEMET fetchAlerts fallback after ${Date.now() - startedAt}ms`
      );
      logger.debug(`Stack trace: ${err.stack}`);

      // Retornar caché si está disponible
      if (this.cache) {
        logger.warn('Usando caché por error en obtención');
        return this.cache;
      }
      return [];
    }
  }

  /**
   * Verifica si la caché es válida (menos de 30 minutos)
   * @private
   */
  _isCacheValid() {
    if (!this.cache || !this.cacheTimestamp) return false;
    return (Date.now() - this.cacheTimestamp) < this.CACHE_TTL_MS;
  }

  /**
   * Obtiene la antigüedad de la caché en milisegundos
   * @private
   */
  _getCacheAge() {
    if (!this.cacheTimestamp) return -1;
    return Date.now() - this.cacheTimestamp;
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
      // 1. Descargar el archivo TAR
      const tarBuffer = await this._downloadTar(data.datos);
      
      // 2. Descomprimir y parsear los XMLs
      const rawAlerts = await this._unpackAndParse(tarBuffer);
      
      // 3. Normalizar al formato de Swagger
      const normalizedAlerts = this._normalizeAlerts(rawAlerts);
      
      // 4. Deduplicar alertas (mantener la más reciente por zona+tipo)
      return this._deduplicateAlerts(normalizedAlerts);
    } catch (error) {
      logger.error(`Error en el pipeline de procesamiento: ${error.message}`);
      // Lanzar el error para que fetchAlerts pueda manejar el fallback a la caché
      throw error;
    }
  }

  /**
   * Descarga el archivo binario (.tar)
   * Adaptado de la función 'download' de tu script IMDb
   */
  async _downloadTar(url) {
    logger.debug(`Descargando archivo comprimido desde: ${url}`);
    
    const controller = new AbortController();
    const timeoutMs = 30000;
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    const startedAt = Date.now();

    logger.debug(`AEMET download TAR iniciado con timeout=${timeoutMs}ms`);

    try {
      const response = await fetch(url, { signal: controller.signal });
      logger.debug(
        `AEMET download TAR completado en ${Date.now() - startedAt}ms con status=${response.status}`
      );
      if (!response.ok) throw new Error(`Falló la descarga: ${response.status} ${response.statusText}`);
      
      const arrayBuffer = await response.arrayBuffer();
      return Buffer.from(arrayBuffer);
    } catch (error) {
      if (error.name === 'AbortError') {
        throw new Error(`Timeout descargando el archivo de alertas de AEMET tras ${timeoutMs}ms`);
      }
      throw error;
    } finally {
      clearTimeout(timeoutId);
    }
  }
  /**
   * Descomprime el TAR en memoria y parsea los XML (CAP)
   * @param {Buffer} buffer - Buffer del archivo TAR
   * @returns {Promise<Array>} Array de objetos parseados desde XMLs
   */
  async _unpackAndParse(buffer) {
    try {
      const rawAlerts = [];
      const xmlParser = new xml2js.Parser({
        explicitArray: false,
        charkey: 'value',
        ignoreAttrs: false,
      });

      return new Promise((resolve, reject) => {
        // Crear stream legible desde el buffer
        const readableStream = Readable.from(buffer);

        // Usar Parser de tar para procesar el stream
        const tarParser = new tar.Parser();

        tarParser.on('entry', async (entry) => {
          // Solo procesar archivos .xml
          if (entry.type !== 'File' || !entry.path.endsWith('.xml')) {
            entry.resume();
            return;
          }

          let xmlContent = '';

          entry.on('data', (chunk) => {
            xmlContent += chunk.toString('utf8');
          });

          entry.on('end', async () => {
            try {
              logger.debug(`Parseando XML: ${entry.path}`);
              const parsed = await xmlParser.parseStringPromise(xmlContent);
              rawAlerts.push(parsed);
            } catch (xmlError) {
              logger.error(
                `Error parseando XML ${entry.path}: ${xmlError.message}`
              );
            }
          });

          entry.on('error', (error) => {
            logger.error(`Error en entrada ${entry.path}: ${error.message}`);
          });
        });

        tarParser.on('end', () => {
          logger.info(`Total de XMLs procesados: ${rawAlerts.length}`);
          resolve(rawAlerts);
        });

        tarParser.on('error', (error) => {
          logger.error(`Error en stream TAR: ${error.message}`);
          reject(error);
        });

        readableStream.pipe(tarParser);
      });
    } catch (error) {
      logger.error(`Error en _unpackAndParse: ${error.message}`);
      throw error;
    }
  }

  /**
   * Normalización específica para el formato CAP v1.2 de AEMET
   * Mapea estructura XML CAP al esquema AemetAlert de Swagger
   * @param {Array} rawAlerts - Array de objetos parseados desde XML
   * @returns {Array} Array de alertas normalizadas
   */
_normalizeAlerts(rawAlerts) {
    const normalizedAlerts = [];

    for (const rawAlert of rawAlerts) {
      try {
        // Navegar por la estructura XML parseada
        const alert = rawAlert.alert || {};

        // info es un ARRAY con múltiples idiomas
        const infoArray = Array.isArray(alert.info) ? alert.info : [alert.info];
        
        // Seleccionar el primer info (preferentemente es-ES)
        const info = infoArray[0] || {};

        // Extraer campos CAP base
        const identifier = alert.identifier || 'unknown';
        const sent = alert.sent || new Date().toISOString(); // FECHA DE EMISIÓN
        
        // El tipo real está en eventCode.value (ej: "PR;Lluvias") o en event
        let tipoReal = info.event || 'Evento desconocido';
        if (info.eventCode && info.eventCode.value) {
          const eventCodeValue = info.eventCode.value;
          const partes = eventCodeValue.split(';');
          if (partes.length > 1) {
            tipoReal = partes[1]; // Ej: "Lluvias" de "PR;Lluvias"
          }
        }
        tipoReal = this._cleanText(tipoReal);

        // El nivel está en parameters con valueName "AEMET-Meteoalerta nivel"
        let severityLevel = info.severity || 'Moderate';
        const paramArray = Array.isArray(info.parameter) ? info.parameter : [info.parameter];
        const nivelParam = paramArray.find(p => p.valueName === 'AEMET-Meteoalerta nivel');
        if (nivelParam && nivelParam.value) {
          // Convertir valor como "amarillo" → "Moderate"
          const nivelSpanish = nivelParam.value.toLowerCase();
          const nivelMap = {
            'amarillo': 'Moderate',
            'naranja': 'Severe',
            'rojo': 'Extreme'
          };
          severityLevel = nivelMap[nivelSpanish] || 'Moderate';
        }

        const severity = severityLevel;
        
        // Extraer nuevos campos: Probabilidad, Instrucciones, Certidumbre, etc.
        const probParam = paramArray.find(p => p.valueName === 'AEMET-Meteoalerta probabilidad');
        let probabilidad = probParam && probParam.value ? probParam.value : null; // null si no existe
        probabilidad = this._cleanText(probabilidad);

        const instruction = info.instruction || null;
        const web = info.web || null;
        const certainty = info.certainty || null;
        const urgency = info.urgency || null;
        
        // No cortamos la descripción a 200 caracteres para tenerla completa en el popup
        const description = info.description || info.headline || 'Sin descripción';
        const onset = info.onset || info.effective || new Date().toISOString();
        let expires = info.expires;
        if (!expires) {
            // Si no hay expires, le sumamos 24 horas a la fecha actual
            const tomorrow = new Date();
            tomorrow.setHours(tomorrow.getHours() + 24);
            expires = tomorrow.toISOString();
        }

        // Mapear severity CAP a nivel de alerta español
        let nivel = 'amarillo'; // Valor por defecto por precaución
        if (nivelParam && nivelParam.value) {
          nivel = nivelParam.value.toLowerCase(); // Extraemos el valor del XML (ej: "verde", "amarillo")
        }
        nivel = this._cleanText(nivel);

        // =========================================================
        //  Logica para recoger la primera zona afectada
        // =========================================================
        const rawAreas = info.area;
        if (!rawAreas) {
          logger.warn(`Sin área definida en alerta ${identifier}`);
          continue; // Si el XML no tiene zonas, lo saltamos
        }

        // Si es un Array de varias zonas, cogemos la posición [0]. Si es un objeto único, lo usamos tal cual.
        // No es viable coger todas porque se pasa de tener 100 a 1600 alertas
        const primeraZona = Array.isArray(rawAreas) ? rawAreas[0] : rawAreas;

        // Extraer zonaId
        let zonaId = 'unknown';
        if (primeraZona.geocode && primeraZona.geocode.value) {
          zonaId = primeraZona.geocode.value;
        }

        // Extraer nombre de la primera zona (a veces xml2js mete los textos en arrays, por eso la comprobación)
        let rawAreaDesc = primeraZona.areaDesc;
        if (Array.isArray(rawAreaDesc)) rawAreaDesc = rawAreaDesc[0]; 
        const areaDesc = rawAreaDesc || `Zona ${zonaId}`;

        // Extraer el polígono de esta primera zona exclusivamente
        const polygon = primeraZona.polygon || '';

        // Extraer coordenadas del polígono
        const coordenadas = this._parseAemetPolygon(polygon, identifier, nivel);
        // Guardar raw polygon y convertir a GeoJSON si es posible
        const poligono_raw = Array.isArray(polygon) ? polygon.join(' | ') : (typeof polygon === 'string' ? polygon : null);
        const poligono_geojson = this._convertPolygonToGeoJSON(polygon);

        // Construir alerta normalizada con TODOS los campos
        const normalizedAlert = {
          id: identifier, // Se mantiene el ID de AEMET original (sin sub-versiones)
          zona: this._cleanText(areaDesc), // Limpiamos el texto de la zona por si acaso
          tipo: tipoReal,
          nivel: nivel,
          nivelNumerico: this._getNivelNumerico(nivel.toLowerCase()),
          descripcion: description, 
          instrucciones: instruction,
          probabilidad: probabilidad,
          certidumbre: certainty,
          urgencia: urgency,
          enlace: web,
          emision: this._parseISO8601(sent),
          validez_inicio: this._parseISO8601(onset),
          validez_fin: this._parseISO8601(expires),
          coordenadas: {
            latitud: coordenadas.latitud,
            longitud: coordenadas.longitud
          },
          color: this._mapColorByNivel(nivel.toLowerCase()),
          poligono_raw,
          poligono_geojson,
        };

        logger.debug(
          `Alerta normalizada: ${normalizedAlert.zona} - ${normalizedAlert.tipo} (${normalizedAlert.nivel})`
        );
        normalizedAlerts.push(normalizedAlert);
      } catch (error) {
        logger.error(
          `Error normalizando alerta: ${error.message}. Saltando...`
        );
        logger.debug(`Error stack: ${error.stack}`);
        continue;
      }
    }

    logger.info(
      `Total de alertas normalizadas: ${normalizedAlerts.length}`
    );
    return normalizedAlerts;
  }
  /**
   * Parsea el string "lat,long lat,long" y devuelve un punto medio estimado del polígono
   */
  _parseAemetPolygon(polygonData, id,nivel) {
    // 1. Fallback seguro por si todo falla
    const fallbackCoords = { latitud: null, longitud: null };

    if (!polygonData) {
      logger.debug(`No hay datos de polígono. ID:${id} Nivel:${nivel} Usando coordenadas por defecto.`);
      return fallbackCoords;
    }

    // 2. Normalizar la entrada a un único String
    let polygonStr = '';
    if (Array.isArray(polygonData)) {
      if (polygonData.length > 1) {
        logger.debug(`Se recibieron ${polygonData.length} polígonos para ID:${id}. Usando el primero.`);
      }
      // Si hay múltiples polígonos, cogemos el primero para tener una aproximación
      polygonStr = polygonData[0]; 
    } else if (typeof polygonData === 'string') {
      polygonStr = polygonData;
    } else {
      logger.debug(`Formato de polígono desconocido: ${typeof polygonData}`);
      return fallbackCoords;
    }

    // 3. Extraer y validar todos los puntos del polígono (separados por espacios)
    const points = polygonStr.trim().split(/\s+/); // Evita fallos con dobles espacios
    const validPoints = [];

    for (const point of points) {
      const coords = point.split(",");
      if (coords.length < 2) continue;

      const lat = parseFloat(coords[0]);
      const lon = parseFloat(coords[1]);

      if (this._isValidCoordinate(lat, lon)) {
        validPoints.push({ lat, lon });
      }
    }

    logger.debug(
      `Polígono ID:${id} Nivel:${nivel} -> puntos válidos ${validPoints.length}/${points.length}`
    );

    // 4. Calcular centroide simple (punto medio estimado)
    const centroid = this._calculatePolygonCentroid(validPoints);
    if (centroid) {
      return centroid;
    }

    // 5. Si no hay puntos válidos, devolvemos fallback
    logger.debug(`No se pudo calcular centroide válido para ID:${id}.`);
    return fallbackCoords;
  }

  /**
   * Valida que una coordenada sea numérica y esté en rangos geográficos válidos
   * @private
   */
  _isValidCoordinate(lat, lon) {
    return Number.isFinite(lat)
      && Number.isFinite(lon)
      && lat >= -90
      && lat <= 90
      && lon >= -180
      && lon <= 180;
  }

  /**
   * Calcula un centroide simple (media aritmética) de los vértices válidos
   * @private
   */
  _calculatePolygonCentroid(points) {
    if (!Array.isArray(points) || points.length === 0) {
      return null;
    }

    let sumLat = 0;
    let sumLon = 0;

    for (const point of points) {
      sumLat += point.lat;
      sumLon += point.lon;
    }

    const latitud = sumLat / points.length;
    const longitud = sumLon / points.length;

    if (!this._isValidCoordinate(latitud, longitud)) {
      return null;
    }

    return { latitud, longitud };
  }


  /**
   * Convierte el polígono en formato AEMET ("lat,lon lat,lon ..." o array de esos strings)
   * a GeoJSON Polygon o MultiPolygon. Retorna null si no es posible.
   * @private
   */
  _convertPolygonToGeoJSON(polygonData) {
    try {
      if (!polygonData) return null;

      const parseSingle = (polygonStr) => {
        const points = polygonStr.trim().split(/\s+/);
        const coords = [];
        for (const p of points) {
          const [latStr, lonStr] = p.split(',');
          const lat = parseFloat(latStr);
          const lon = parseFloat(lonStr);
          if (!this._isValidCoordinate(lat, lon)) continue;
          // GeoJSON espera [lon, lat]
          coords.push([lon, lat]);
        }
        return coords.length >= 3 ? coords : null; // un polígono válido necesita al menos 3 vértices
      };

      // Si viene un array con varios polígonos, construir MultiPolygon
      if (Array.isArray(polygonData)) {
        const polygons = [];
        for (const poly of polygonData) {
          const coords = parseSingle(poly);
          if (coords) polygons.push([coords]); // GeoJSON MultiPolygon: [ [ [lon,lat], ... ] ]
        }
        if (polygons.length === 0) return null;
        if (polygons.length === 1) {
          return { type: 'Polygon', coordinates: polygons[0] };
        }
        return { type: 'MultiPolygon', coordinates: polygons };
      }

      // Si es string
      if (typeof polygonData === 'string') {
        const coords = parseSingle(polygonData);
        if (!coords) return null;
        return { type: 'Polygon', coordinates: [coords] };
      }

      return null;
    } catch (err) {
      logger.debug(`Error convirtiendo polígono a GeoJSON: ${err.message}`);
      return null;
    }
  }



  /**
   * Parsea una fecha ISO 8601 y la retorna como string ISO
   * @param {string} dateString - Fecha en formato ISO 8601
   * @returns {string} Fecha en formato ISO 8601 válido
   */
  _parseISO8601(dateString) {
    try {
      if (!dateString) {
        return new Date().toISOString();
      }
      // Validar que sea ISO 8601 válido
      const date = new Date(dateString);
      if (isNaN(date.getTime())) {
        logger.warn(`Fecha inválida: ${dateString}. Usando fecha actual.`);
        return new Date().toISOString();
      }
      return date.toISOString();
    } catch (error) {
      logger.warn(
        `Error parseando fecha ${dateString}: ${error.message}. Usando fecha actual.`
      );
      return new Date().toISOString();
    }
  }

  _getNivelNumerico(nivel) {
    const niveles = { 'amarillo': 1, 'naranja': 2, 'rojo': 3 };
    return niveles[nivel] || 0;
  }

 _mapColorByNivel(nivel) {
    const colores = {
      'verde': '#26b94b', // Amarillo Tailwind (Moderado)
      'amarillo': '#ffc869', // Amarillo Tailwind (Moderado)
      'naranja': '#f97316',  // Naranja Tailwind (Importante)
      'rojo': '#ef4444'      // Rojo Tailwind (Crítico)
    };
    // Si no hay nivel reconocido, devolvemos el amarillo por precaución
    return colores[nivel] || '#4e4a4d'; 
  }

  /**
   * Deduplica alertas manteniendo la más reciente por zona + tipo
   * @private
   */
  _deduplicateAlerts(alerts) {
    const alertMap = new Map();

    for (const alert of alerts) {
      // Clave única: zona + tipo de evento
      const key = `${alert.zona}|${alert.tipo}`;

      // Si ya existe, comparar por fecha de inicio (más reciente gana)
      if (alertMap.has(key)) {
        const existing = alertMap.get(key);
        const newDate = new Date(alert.validez_inicio);
        const existingDate = new Date(existing.validez_inicio);

        if (newDate > existingDate) {
          logger.debug(
            `Reemplazando alerta duplicada: ${key} ` +
            `(${existingDate.toISOString()} → ${newDate.toISOString()})`
          );
          alertMap.set(key, alert);
        }
      } else {
        alertMap.set(key, alert);
      }
    }

    const deduped = Array.from(alertMap.values());
    if (deduped.length < alerts.length) {
      logger.info(
        `Duplicados eliminados: ${alerts.length} → ${deduped.length} alertas`
      );
    }
    return deduped;
  }

  /**
   * Filtra alertas nuevas que no han sido procesadas anteriormente
   * @private
   */
  async _filterNewAlerts(alerts) {
    try {
      const alertIds = alerts.map(a => a.id);
      const existingAlerts = await AemetAlert.find(
        { aemet_id: { $in: alertIds } },
        { aemet_id: 1 }
      );
      
      const existingIds = new Set(existingAlerts.map(a => a.aemet_id));
      const newAlerts = alerts.filter(a => !existingIds.has(a.id));
      
      if (newAlerts.length > 0) {
        logger.info(
          `🆕 Alertas nuevas: ${newAlerts.length}/${alerts.length} ` +
          `(${alerts.length - newAlerts.length} ya procesadas)`
        );
      } else {
        logger.info(`ℹ️  Todas las alertas ya han sido procesadas anteriormente`);
      }
      
      return newAlerts;
    } catch (error) {
      logger.error(`Error filtrando alertas nuevas: ${error.message}`);
      // Si hay error en BD, procesar todas las alertas
      return alerts;
    }
  }

  /**
   * Limpia strings que vienen con saltos de línea, comas y espacios extra del XML
   * @private
   */
  _cleanText(text) {
    if (!text || typeof text !== 'string') return text;
    return text
      .replace(/[\n\r\t]/g, ' ')       // 1. Cambia saltos de línea y tabulaciones por espacios
      .replace(/\s+/g, ' ')            // 2. Colapsa múltiples espacios en uno solo
      .replace(/^[\s,]+|[\s,]+$/g, '') // 3. Elimina comas y espacios al principio y al final
      .trim();                         // 4. Asegura que no queden espacios en los bordes
  }

  /**
   * Guarda alertas nuevas en la base de datos
   * @private
   */
  async _saveAlertsToDatabase(alerts) {
    try {
      const alertsForDb = alerts.map(alert => ({
        aemet_id: alert.id,
        zona: alert.zona,
        tipo: alert.tipo,
        nivel: alert.nivel,
        nivelNumerico: alert.nivelNumerico,
        descripcion: alert.descripcion,
        instrucciones: alert.instrucciones,
        probabilidad: alert.probabilidad,
        certidumbre: alert.certidumbre,
        urgencia: alert.urgencia,
        enlace: alert.enlace,
        coordenadas: alert.coordenadas,
        poligono_raw: alert.poligono_raw || null,
        poligono_geojson: alert.poligono_geojson || null,
        color: alert.color,
        emision: new Date(alert.emision),
        validez_inicio: new Date(alert.validez_inicio),
        validez_fin: new Date(alert.validez_fin),
        fecha_procesamiento: new Date()
      }));

      const result = await AemetAlert.insertMany(alertsForDb, { ordered: false });
      logger.info(`✅ ${result.length} alertas guardadas en BD`);
    } catch (error) {
      // Si algunos documentos duplicados existen, ignorar ese error
      if (error.code === 11000) {
        logger.debug('Algunos IDs de alertas ya existen en BD (esperado)');
      } else {
        logger.error(`Error guardando alertas en BD: ${error.message}`);
      }
    }
  }
}
module.exports = new aemetAlertsService();