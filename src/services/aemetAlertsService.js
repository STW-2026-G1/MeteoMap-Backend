const logger = require("../config/logger");
const tar = require("tar");
const { Readable } = require("stream");
const xml2js = require("xml2js");
const AemetAlert = require("../models/AemetAlert");
const { editComment } = require("./commentService");

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
      // Recargar caché desde BD solo cuando esté vacía o caducada.
      let preCacheValid = this._isCacheValid();
      if (!preCacheValid) {
        logger.debug('[AEMET] Cache inválida o vacía, recargando desde BD...');
        await this._refreshCacheFromDatabase();
      }
      let cacheValid = this._isCacheValid();
      logger.debug(
        `[AEMET] fetchAlerts iniciado. forceRefresh=${forceRefresh}, PrecacheValid=${preCacheValid}, cacheValid=${cacheValid}`
      );

      // Verificar caché válido. Filtrar la caché para no devolver alertas ya caducadas
      if (cacheValid && !forceRefresh) { 
        const edadCache = Date.now() - this.cacheTimestamp;
        const edadSegundos = Math.round(edadCache / 1000);
        const alertCount = this.cache ? this.cache.length : 0;
        logger.info(
          `[AEMET] Usando alertas en caché: ${alertCount} alertas, ` +
          `edad=${edadSegundos}s, TTL=1800s (caché fresca)`
        );
        return this.cache;
      }

      if (forceRefresh) {
        logger.info(`[AEMET] forceRefresh=true, ignorando caché. Refreshing desde AEMET API...`);
      } else {
        logger.info(`[AEMET] Cache expirada. Refreshing desde AEMET API...`);
      }

      if (!this.AEMET_API_KEY) {
        logger.warn(
          "[AEMET] AEMET_API_KEY no configurada. Usando alertas desde BD/caché."
        );
        return this.cache || [];
      }

      logger.debug(`[AEMET] Iniciando petición a: ${this.AEMET_ALERTS_URL}`);
      const fetchStart = Date.now();
      
      let response;
      try {
        // Envolvemos el fetch en un try-catch para capturar errores de red puros 
        // (ej. DNS caídos, no hay internet, timeout de conexión)
        response = await fetch(`${this.AEMET_ALERTS_URL}`, {
          headers: {
            "api_key": this.AEMET_API_KEY,
            "Accept": "application/json" // Buena práctica
          },
        });
      } catch (networkError) {
        // Si falla aquí, la petición ni siquiera llegó a la AEMET
        const causeCode = networkError?.cause?.code;
        const causeMessage = networkError?.cause?.message;
        logger.error(
          `[AEMET API] Error crítico de red intentando contactar a AEMET: ${networkError.message}` +
          (causeCode ? ` | cause.code=${causeCode}` : "") +
          (causeMessage ? ` | cause.message=${causeMessage}` : "")
        );
        throw networkError; // Lanzamos el error para 'catch' principal use el fallback de caché
      }

      const fetchDuration = Date.now() - fetchStart;
      logger.info(`[AEMET API] Respuesta recibida en ${fetchDuration}ms (status=${response.status})`);

      if (!response.ok) {
        // 1. Intentar leer el cuerpo de la respuesta por si AEMET envía JSON con detalles
        let errorDetails = "";
        try {
          const rawText = await response.text();
          // Solo lo añadimos si hay texto
          if (rawText) {
            errorDetails = ` - Detalles API: ${rawText.substring(0, 500)}`; // Limitamos a 500 chars por si es un HTML gigante
          }
        } catch (e) {
          logger.debug(`[AEMET API] No se pudo leer el cuerpo del error: ${e.message}`);
        }

        // 2. Loggear el error completo con los detalles
        if (response.status === 429) {
          logger.warn(`[AEMET API] 429 Too Many Requests: Límite de peticiones alcanzado.${errorDetails}`);
        } else {
          logger.error(`[AEMET API] Error HTTP ${response.status} ${response.statusText}${errorDetails}`);
        }

        // Fallback a caché
        if (Array.isArray(this.cache) && this.cache.length > 0) {
          logger.warn('[AEMET] Fallback: usando caché existente por error en API');
          const now = new Date();
          const filteredCache = Array.isArray(this.cache)
            ? this.cache.filter(a => {
                try { return new Date(a.validez_fin) >= now; } catch (e) { return false; }
              })
            : [];
          this.cache = filteredCache;
          this.cacheTimestamp = Date.now();
          logger.info(`[AEMET] Devolviendo ${filteredCache.length} alertas desde caché de respaldo`);
          return filteredCache;
        }

        try {
          logger.info('[AEMET] Intentando recuperar desde BD...');
          const dbAlerts = await this._refreshCacheFromDatabase();
          logger.info(`[AEMET] Recuperadas ${dbAlerts.length} alertas desde BD`);
          return dbAlerts;
        } catch (dbErr) {
          logger.error(`[AEMET] Fallo total: No se pudo recuperar desde BD tras error API: ${dbErr.message}`);
          return [];
        }
    
      }

      const data = await response.json();
      logger.debug(
        `[AEMET] Datos recibidos: URL de descarga en campo datos`
      );

      // Procesar y transformar alertas
      logger.debug(`[AEMET] Iniciando procesamiento de alertas...`);
      const alerts = await this._processAlerts(data);
      logger.info(`[AEMET] Alertas procesadas: ${alerts.length}`);
      
      // Filtrar alertas ya procesadas anteriormente
      const newAlerts = await this._filterNewAlerts(alerts);
      logger.info(`[AEMET] Nuevas alertas después de dedup: ${newAlerts.length}`);
      
      // Guardar en BD las nuevas alertas
      if (newAlerts.length > 0) {
        await this._saveAlertsToDatabase(newAlerts);
        logger.info(`[AEMET] ${newAlerts.length} alertas guardadas en BD`);
      } else {
        logger.info(`[AEMET] Sin alertas nuevas para guardar (ya estaban en BD)`);
      }
      
      // Consultar TODAS las alertas activas de la Base de Datos
      // Filtramos por fecha de validez_fin para no enviar alertas caducadas
      logger.debug(`[AEMET] Reloadquerying todos los datos activos desde BD...`);
      const formattedAlerts = await this._refreshCacheFromDatabase();

      logger.info(`[AEMET] Servicio finalizado: devolviendo ${formattedAlerts.length} alertas activas desde BD`);
      logger.debug(`[AEMET] fetchAlerts completado en ${Date.now() - startedAt}ms`);
      return formattedAlerts;
    } catch (err) {
      const elapsed = Date.now() - startedAt;
      logger.error(
        `[AEMET] Error crítico en fetchAlerts: ${err.name} - ${err.message} (${elapsed}ms)`
      );
      logger.debug(`[AEMET] Stack trace: ${err.stack}`);

      // Retornar caché si está disponible como último recurso
      if (Array.isArray(this.cache) && this.cache.length > 0) {
        logger.warn(
          `[AEMET] Fallback a caché de emergencia: devolviendo ${this.cache.length} alertas`
        );
        return this.cache;
      }
      
      logger.error(`[AEMET] No hay caché disponible. Devolviendo array vacío.`);
      throw err;
    }
  }

  /**
   * Recarga la caché desde la base de datos con alertas activas.
   * Usa el timestamp más reciente del campo updatedAt de los documentos como referencia de validez.
   * @private
   */
  async _refreshCacheFromDatabase() {
    const startRefresh = Date.now();

    try {
      logger.debug('[Cache] Iniciando recarga desde BD...');
      
      const activeAlertsFromDb = await AemetAlert.find({
        validez_fin: { $gte: new Date() }
      }).lean();

      logger.debug(`[Cache] Consulta a BD completada: encontrados ${activeAlertsFromDb.length} documentos activos`);

      const formattedAlerts = activeAlertsFromDb.map(doc => ({
        ...doc,
        id: doc.aemet_id,
        _id: doc._id.toString(),
      }));

      this.cache = formattedAlerts;

      // Extraer timestamp del documento más reciente
      if (activeAlertsFromDb.length > 0) {
        try {
          // Intentamos usar updatedAt primero (más confiable), luego createdAt
          const timestamps = activeAlertsFromDb.map(doc => {
            const timestamp = doc.updatedAt || doc.createdAt || doc.fecha_procesamiento;
            if (!timestamp) {
              return null;
            }
            const ts = new Date(timestamp).getTime();
            return ts;
          }).filter(ts => ts !== null);

          if (timestamps.length > 0) {
            this.cacheTimestamp = Math.max(...timestamps);
            const age = Date.now() - this.cacheTimestamp;
            logger.info(
              `[Cache] Recargada desde BD: ${activeAlertsFromDb.length} alertas, ` +
              `timestamp más reciente: ${new Date(this.cacheTimestamp).toISOString()} ` +
              `(edad de datos: ${age}ms, ${Math.round(age / 1000)}s)`
            );
            logger.debug(`[Cache] Recarga completada en ${Date.now() - startRefresh}ms`);
          } else {
            // Ningún documento tiene timestamp válido
            logger.warn('[Cache] Alertas encontradas pero ninguna tiene timestamp válido (updatedAt, createdAt, fecha_procesamiento)');
            this.cacheTimestamp = null; // Marcar como invalida
            logger.info(`[Cache] Usando timestamp fallback: ${new Date(this.cacheTimestamp).toISOString()}`);
          }
        } catch (timestampError) {
          logger.error(`[Cache] Error extrayendo timestamps: ${timestampError.message}`);
          logger.debug(`[Cache] Stack: ${timestampError.stack}`);
          // Fallback: usar Date.now()
          this.cacheTimestamp = null;
          logger.warn(`[Cache] Usando timestamp fallback por error: ${new Date(this.cacheTimestamp).toISOString()}`);
        }
      } else {
        // No hay alertas activas en BD
        logger.warn('[Cache] No hay alertas activas en BD (validez_fin >= ahora)');
        this.cacheTimestamp = null;
        logger.info('[Cache] Caché vacía - requiere refresh desde AEMET API');
      }

      return formattedAlerts;
    } catch (err) {
      logger.error(`[Cache] Error crítico recargando desde BD: ${err.name} - ${err.message}`);
      logger.debug(`[Cache] Stack trace: ${err.stack}`);
      
      // En caso de error, mantener caché actual pero marcar como no válida
      this.cacheTimestamp = null;
      logger.warn('[Cache] Caché marcada como no válida por error en BD. Se forzará refresh desde AEMET API.');
      
      throw err;
    }
  }

  /**
   * Verifica si la caché es válida (menos de 30 minutos)
   * @private
   */
  _isCacheValid() {
    // Validaciones básicas
    if (!Array.isArray(this.cache) || this.cache.length === 0) {
      logger.debug('[Cache] Cache inválido: no hay datos en caché o no es array');
      return false;
    }
    
    if (!this.cacheTimestamp) {
      logger.debug('[Cache] Cache inválido: cacheTimestamp es null/undefined');
      return false;
    }

    // Verificar TTL
    const age = Date.now() - this.cacheTimestamp;
    const isValid = age < this.CACHE_TTL_MS;

    if (!isValid) {
      const ageSeconds = Math.round(age / 1000);
      const ttlSeconds = Math.round(this.CACHE_TTL_MS / 1000);
      logger.debug(
        `[Cache] Cache EXPIRADA: edad=${ageSeconds}s > TTL=${ttlSeconds}s ` +
        `(${this.cache.length} alertas)`
      );
    }

    return isValid;
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
   * Adaptado de la función 'download' de script IMDb
   */
  async _downloadTar(url) {
    logger.debug(`Descargando archivo comprimido desde: ${url}`);
    
    const response = await fetch(url);
    
    if (!response.ok) throw new Error(`Falló la descarga: ${response.status} ${response.statusText}`);
    
    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
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
    
      return fallbackCoords;
    }

    // 2. Normalizar la entrada a un único String
    let polygonStr = '';
    if (Array.isArray(polygonData)) {
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
        logger.info(`Todas las alertas ya han sido procesadas anteriormente`);
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
      logger.info(`${alerts.length} alertas totales. ${result.length} alertas guardadas en BD`);
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