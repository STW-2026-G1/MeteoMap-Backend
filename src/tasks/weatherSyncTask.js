const cron = require("node-cron");
const logger = require("../config/logger");
const weatherService = require("../services/weatherService");

/**
 * Tarea cron para sincronizar datos meteorológicos cada 3 horas
 * También se ejecuta al iniciar la aplicación
 */
class WeatherSyncTask {
  constructor() {
    this.task = null;
  }

  /**
   * Iniciar la tarea cron
   * Ejecuta: al iniciar la app + cada 3 horas (0:00, 3:00, 6:00, 9:00, 12:00, 15:00, 18:00, 21:00)
   */
  start() {
    logger.info("Iniciando tarea de sincronización de datos meteorológicos");

    try {
      // Ejecutar inmediatamente al iniciar la app
      this._runSync();

      // Programar para cada 3 horas (cron: "0 */3 * * *" = cada 3 horas)
      this.task = cron.schedule("0 */3 * * *", () => {
        this._runSync();
      });

      logger.info("Tarea de sincronización meteorológica iniciada correctamente");
    } catch (err) {
      logger.error(`Error al iniciar WeatherSyncTask: ${err.message}`);
      throw err;
    }
  }

  /**
   * Ejecutar sincronización
   * @private
   */
  async _runSync() {
    try {
      const timestamp = new Date().toISOString();
      logger.info(`[${timestamp}] Ejecutando sincronización de datos meteorológicos...`);

      const result = await weatherService.syncAllZonesWeather();

      logger.info(
        `[${timestamp}] Sincronización completada: ${result.success}/${result.success + result.failed} zonas actualizadas`
      );

      // Loguear errores si los hay
      if (result.errors.length > 0) {
        logger.warn(`Errores durante sincronización: ${result.errors.join(", ")}`);
      }
    } catch (err) {
      logger.error(`Error durante sincronización de datos meteorológicos: ${err.message}`);
      logger.debug(`Stack trace: ${err.stack}`);
    }
  }

  /**
   * Detener la tarea cron
   */
  stop() {
    if (this.task) {
      this.task.stop();
      logger.info("Tarea de sincronización meteorológica detenida");
    }
  }
}

module.exports = new WeatherSyncTask();
