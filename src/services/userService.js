const User = require("../models/User");
const logger = require("../config/logger");
const bcrypt = require("bcrypt");

const BCRYPT_SALT_ROUNDS = 12;

class UserService {
  /**
   * Obtener perfil de usuario
   */
  async getProfile(userId) {
    try {
      const user = await User.findById(userId);
      if (!user) {
        const error = new Error("Usuario no encontrado");
        error.status = 404;
        throw error;
      }

      return {
        message: "Datos del usuario",
        id: user._id,
        email: user.datos_acceso.email,
        perfil: user.perfil,
        preferencias: user.preferencias,
        limites_ia: user.limites_ia,
        estado: user.v,
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

  /**
   * Eliminar usuario
   */
  async deleteUser(userId) {
    try {
      const user = await User.findById(userId);
      if (!user) {
        const error = new Error("Usuario no encontrado");
        error.status = 404;
        throw error;
      }

      await User.findByIdAndDelete(userId);
      logger.info(`Usuario eliminado: ${userId}`);

      return {
        message: "Usuario eliminado exitosamente",
        userId,
      };
    } catch (err) {
      logger.error(`Error en deleteUser: ${err.message}`);
      throw err;
    }
  }

  /**
   * Actualizar perfil del usuario
   */
  async updateUser(userId, updateData) {
    try {
      const user = await User.findById(userId);
      if (!user) {
        const error = new Error("Usuario no encontrado");
        error.status = 404;
        throw error;
      }

      // Actualizar nombre
      if (updateData.nombre !== undefined) {
        user.perfil.nombre = updateData.nombre;
      }

      // Actualizar email (si se proporciona, verificar que no exista)
      if (updateData.email !== undefined) {
        const emailExists = await User.findOne({
          "datos_acceso.email": updateData.email,
          _id: { $ne: userId }, // Excluir el usuario actual
        });

        if (emailExists) {
          const error = new Error("El email ya está registrado");
          error.status = 400;
          throw error;
        }

        user.datos_acceso.email = updateData.email;
        user.perfil.email = updateData.email;
      }

      // Actualizar avatar
      if (updateData.avatar_url !== undefined) {
        user.perfil.avatar_url = updateData.avatar_url;
      }

      // Actualizar biografía
      if (updateData.biografia !== undefined) {
        user.perfil.biografia = updateData.biografia;
      }

      // Actualizar ubicación
      if (updateData.ubicacion !== undefined) {
        user.perfil.ubicacion = updateData.ubicacion;
      }

      await user.save();
      logger.info(`Perfil del usuario actualizado: ${userId}`);

      return {
        message: "Perfil actualizado exitosamente",
        user: {
          id: user._id,
          email: user.datos_acceso.email,
          perfil: user.perfil,
        },
      };
    } catch (err) {
      logger.error(`Error en updateUser: ${err.message}`);
      throw err;
    }
  }

  /**
   * Actualizar contraseña del usuario
   */
  async updatePassword(userId, currentPassword, newPassword) {
    try {
      const user = await User.findById(userId);
      if (!user) {
        const error = new Error("Usuario no encontrado");
        error.status = 404;
        throw error;
      }

      // Verificar que la contraseña actual es correcta
      const passwordMatch = await bcrypt.compare(
        currentPassword,
        user.datos_acceso.password_hash
      );

      if (!passwordMatch) {
        const error = new Error("Contraseña actual incorrecta");
        error.status = 401;
        throw error;
      }

      // Hashear la nueva contraseña
      const newPasswordHash = await bcrypt.hash(newPassword, BCRYPT_SALT_ROUNDS);
      user.datos_acceso.password_hash = newPasswordHash;

      await user.save();
      logger.info(`Contraseña actualizada para usuario: ${userId}`);

      return {
        message: "Contraseña actualizada exitosamente",
      };
    } catch (err) {
      logger.error(`Error en updatePassword: ${err.message}`);
      throw err;
    }
  }
}

module.exports = new UserService();
