const User = require("../models/User");
const logger = require("../config/logger");

class UserService {
  /**
   * Obtener perfil de usuario
   */
  async getProfile(userId) {
    try {
      const user = await User.findById(userId);
      if (!user) {
        throw new Error("Usuario no encontrado");
      }

      return {
        id: user._id,
        email: user.datos_acceso.email,
        perfil: user.perfil,
        reputacion: user.reputacion,
        preferencias: user.preferencias,
      };
    } catch (err) {
      logger.error(`Error en getProfile: ${err.message}`);
      throw err;
    }
  }

  /**
   * Agregar o remover zona favorita
   */
  async updateFavorites(userId, zonaId, accion, configuracion) {
    try {
      const user = await User.findById(userId);
      if (!user) {
        throw new Error("Usuario no encontrado");
      }

      if (accion === "add") {
        // Verificar que no existe ya
        const existe = user.preferencias.some((p) => p.zona_id.toString() === zonaId);
        if (!existe) {
          // Agregar nueva preferencia con configuración
          user.preferencias.push({
            zona_id: zonaId,
            configuracion_alertas: configuracion?.configuracion_alertas || {
              aludes: { activo: false },
              viento: { activo: false },
              reportes_comunidad: { activo: false, tipos_suscritos: [] },
            },
            metodo_notificacion: configuracion?.metodo_notificacion || "PUSH",
          });
        }
      } else if (accion === "remove") {
        user.preferencias = user.preferencias.filter((p) => p.zona_id.toString() !== zonaId);
      } else {
        throw new Error("Acción no válida. Use 'add' o 'remove'");
      }

      await user.save();
      logger.info(`Usuario ${userId}: zona favorita ${accion === "add" ? "añadida" : "removida"}`);

      return {
        message: `Zona ${accion === "add" ? "añadida" : "removida"} de favoritos`,
        preferencias: user.preferencias,
      };
    } catch (err) {
      logger.error(`Error en updateFavorites: ${err.message}`);
      throw err;
    }
  }

  /**
   * Actualizar configuración de alertas para una zona favorita
   */
  async updateAlertConfig(userId, zonaId, configuracion_alertas) {
    try {
      const user = await User.findById(userId);
      if (!user) {
        throw new Error("Usuario no encontrado");
      }

      const preferencia = user.preferencias.find((p) => p.zona_id.toString() === zonaId);
      if (!preferencia) {
        throw new Error("Zona no está en favoritos");
      }

      preferencia.configuracion_alertas = configuracion_alertas;
      await user.save();

      logger.info(`Configuración de alertas actualizada para ${userId} en zona ${zonaId}`);

      return preferencia;
    } catch (err) {
      logger.error(`Error en updateAlertConfig: ${err.message}`);
      throw err;
    }
  }
}

module.exports = new UserService();
