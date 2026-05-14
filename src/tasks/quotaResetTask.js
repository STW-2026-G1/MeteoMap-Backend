const cron = require("node-cron");
const logger = require("../config/logger");
const User = require("../models/User");

/**
 * Tarea cron para resetear la cuota de IA de todos los usuarios cada 24 horas
 * Ejecuta: al iniciar la aplicación + diariamente a medianoche (00:00 UTC)
 */
class QuotaResetTask {
  constructor() {
    this.task = null;
  }

  /**
   * Iniciar la tarea cron
   * Ejecuta: al iniciar la app + cada día a medianoche
   */
  start() {
    logger.info("Iniciando tarea de reset de cuota de IA");

    try {
      // Ejecutar inmediatamente al iniciar la app
      this._runReset();

      // Programar para cada día a medianoche (cron: "0 0 * * *" = 00:00 cada día)
      this.task = cron.schedule("0 0 * * *", () => {
        this._runReset();
      });

      logger.info("Tarea de reset de cuota de IA iniciada correctamente");
    } catch (err) {
      logger.error(`Error al iniciar QuotaResetTask: ${err.message}`);
      throw err;
    }
  }

  /**
   * Ejecutar reset de cuotas
   * Resetea peticiones_hoy y actualiza ultimo_reset para todos los usuarios
   * @private
   */
  async _runReset() {
    try {
      const timestamp = new Date().toISOString();
      logger.info(`[${timestamp}] Ejecutando reset de cuota de IA para todos los usuarios...`);

      const now = new Date();
      const hace24Horas = new Date(now.getTime() - 24 * 60 * 60 * 1000);

      // Actualizar todos los usuarios cuyo último reset fue hace más de 24 horas
      const result = await User.updateMany(
        {
          "limites_ia.ultimo_reset": { $lt: hace24Horas }
        },
        {
          $set: {
            "limites_ia.peticiones_hoy": 0,
            "limites_ia.ultimo_reset": now
          }
        }
      );

      logger.info(
        `[${timestamp}] Reset de cuota completado: ${result.modifiedCount} usuarios actualizados`
      );

      if (result.matchedCount === 0 && result.modifiedCount === 0) {
        logger.debug(
          `[${timestamp}] No hay usuarios con cuota vencida para resetear`
        );
      }
    } catch (err) {
      logger.error(
        `Error durante reset de cuota de IA: ${err.message}`
      );
      logger.debug(`Stack trace: ${err.stack}`);
    }
  }

  /**
   * Detener la tarea cron
   */
  stop() {
    if (this.task) {
      this.task.stop();
      logger.info("Tarea de reset de cuota de IA detenida");
    }
  }
}

module.exports = new QuotaResetTask();
