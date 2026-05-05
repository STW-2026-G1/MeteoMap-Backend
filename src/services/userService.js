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
        user: {
          id: user._id.toString(),
          email: user.datos_acceso.email,
          nombre: user.perfil.nombre,
          biografia: user.perfil.biografia,
          ubicacion: user.perfil.ubicacion,
          avatar_style: user.perfil.avatar_style,
          avatar_seed: user.perfil.avatar_seed,
          createdAt: user.createdAt,
        },
        perfil: user.perfil,
        preferencias: user.preferencias,
        limites_ia: user.limites_ia,
        estado: user.estado,
      };
    } catch (err) {
      logger.error(`Error en getProfile: ${err.message}`);
      throw err;
    }
  }

  /**
   * Agregar o remover zona favorita
   */
  async updateFavorites(userId, zonaId, accion) {
    try {
      const user = await User.findById(userId);
      if (!user) {
        throw new Error("Usuario no encontrado");
      }

      if (accion === "add") {
        // Verificar que no existe ya
        const existe = user.preferencias.some((p) => p.toString() === zonaId);
        if (!existe) {
          user.preferencias.push(zonaId);
        }
      } else if (accion === "remove") {
        user.preferencias = user.preferencias.filter((p) => p.toString() !== zonaId);
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
   * Eliminar usuario (soft delete)
   */
  async deleteUser(userId) {
    try {
      const user = await User.findById(userId);
      if (!user) {
        const error = new Error("Usuario no encontrado");
        error.status = 404;
        throw error;
      }

      if (user.estado === "ELIMINADO") {
        const error = new Error("Esta cuenta ya fue eliminada anteriormente");
        error.status = 400;
        throw error;
      }
      
      user.estado = "ELIMINADO";
      user.fechaEliminacion = new Date();
      await user.save();
      
      logger.info(`Cuenta de usuario eliminada: ${userId} (${user.datos_acceso.email})`, {
        userId,
        email: user.datos_acceso.email,
        timestamp: new Date().toISOString(),
      });

      return {
        message: "Cuenta eliminada exitosamente. Tu cuenta estará disponible para recuperar durante 30 días",
        userId,
        fechaEliminacion: user.fechaEliminacion,
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
      }

      // Actualizar avatar_seed
      if (updateData.avatar_seed !== undefined) {
        user.perfil.avatar_seed = updateData.avatar_seed;
      }

      // Actualizar avatar_style
      if (updateData.avatar_style !== undefined) {
        user.perfil.avatar_style = updateData.avatar_style;
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
          id: user._id.toString(),
          email: user.datos_acceso.email,
          nombre: user.perfil.nombre,
          biografia: user.perfil.biografia,
          ubicacion: user.perfil.ubicacion,
          avatar_style: user.perfil.avatar_style,
          avatar_seed: user.perfil.avatar_seed,
          createdAt: user.createdAt,
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

      // Verificar que el usuario no esté eliminado
      if (user.estado === "ELIMINADO") {
        const error = new Error("No puedes cambiar la contraseña de una cuenta eliminada");
        error.status = 403;
        throw error;
      }

      // Verificar que la contraseña actual es correcta
      const passwordMatch = await bcrypt.compare(
        currentPassword,
        user.datos_acceso.password_hash
      );

      if (!passwordMatch) {
        logger.warn(`Intento fallido de cambiar contraseña - contraseña incorrecta: ${userId}`);
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

  /**
   * Obtener información de límites de IA del usuario
   */
  async getLimitesIA(userId) {
    try {
      const user = await User.findById(userId);
      if (!user) {
        const error = new Error("Usuario no encontrado");
        error.status = 404;
        throw error;
      }

      const limitePorDia = 10;
      const usoDia = user.limites_ia?.peticiones_hoy || 0;
      const disponibles = Math.max(0, limitePorDia - usoDia);

      return {
        limite_diario: limitePorDia,
        peticiones_usadas: usoDia,
        peticiones_disponibles: disponibles,
        ultimo_reset: user.limites_ia?.ultimo_reset,
        reajuste_en: this._calcularTiempoReajuste(user.limites_ia?.ultimo_reset)
      };
    } catch (err) {
      logger.error(`Error en getLimitesIA: ${err.message}`);
      throw err;
    }
  }

  /**
   * Calcular cuánto tiempo falta para el próximo reajuste de cuota
   * @private
   */
  _calcularTiempoReajuste(ultimoReset) {
    if (!ultimoReset) return null;

    const ahora = new Date();
    const proximoReset = new Date(ultimoReset.getTime() + 24 * 60 * 60 * 1000);
    
    if (proximoReset <= ahora) {
      return 0; // Ya se puede resetear
    }

    const diferencia = proximoReset - ahora;
    const horas = Math.floor(diferencia / (1000 * 60 * 60));
    const minutos = Math.floor((diferencia % (1000 * 60 * 60)) / (1000 * 60));
    
    return {
      horas,
      minutos,
      proxima_fecha: proximoReset
    };
  }
}

module.exports = new UserService();
