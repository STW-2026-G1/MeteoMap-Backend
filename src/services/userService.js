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

      if (user.estado === "ELIMINADO") {
        const error = new Error("Usuario ya eliminado");
        error.status = 400;
        throw error;
      }
      
      user.estado = "ELIMINADO";
      await user.save();
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
