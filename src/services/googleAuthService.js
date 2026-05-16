/**
 * @file Servicio de Autenticación con Google OAuth2
 * @module services/googleAuthService
 * @description Implementa la lógica de negocio para autenticación con Google:
 * - Validación de tokens ID de Google
 * - Creación automática de usuarios
 * - Vinculación de cuentas existentes
 * - Gestión de proveedores OAuth
 */

const logger = require("../config/logger");
const User = require("../models/User");

class GoogleAuthService {
  /**
   * Verifica y procesa login con Google
   * @param {object} tokenPayload - Payload decodificado del token de Google (email, name, picture, sub)
   * @returns {object} Objeto con isNewUser y usuario creado o existente
   */
  async handleGoogleLogin(tokenPayload) {
    try {
      const { email, name, picture, sub: googleId } = tokenPayload;

      if (!email || !googleId) {
        throw new Error("Token de Google inválido: faltan email o sub");
      }

      // Buscar usuario existente por email O por google_id
      let user = await User.findOne({
        $or: [
          { "datos_acceso.email": email },
          { "datos_acceso.google_id": googleId },
        ],
      });

      if (user) {
        // Verificar que el usuario no esté eliminado
        if (user.estado === "ELIMINADO") {
          logger.warn(`Intento de login con Google en cuenta eliminada: ${email}`);
          const error = new Error("La cuenta ha sido eliminada. Contacta con soporte para recuperarla");
          error.status = 403;
          throw error;
        }

        // Usuario existe: verificar y actualizar datos de Google
        if (!user.datos_acceso.google_id) {
          // Usuario local que ahora usa Google
          user.datos_acceso.google_id = googleId;
          user.datos_acceso.provider = "google";
          logger.info(`Usuario local vinculado con Google: ${email}`);
        }

        // Actualizar perfil si tiene datos nuevos de Google
        if (name && !user.perfil.nombre) {
          user.perfil.nombre = name;
          user.perfil.avatar_seed = name;
        }

        await user.save();
        logger.info(`Login con Google exitoso: ${email}`);

        return {
          isNewUser: false,
          user,
        };
      }

      // Crear nuevo usuario con Google
      const newUser = new User({
        datos_acceso: {
          email: email.toLowerCase(),
          google_id: googleId,
          provider: "google",
          rol: "USER",
        },
        perfil: {
          nombre: name || "",
          avatar_seed: name || "",
          avatar_style: 'avataaars',
        },
      });

      await newUser.save();
      logger.info(`Nuevo usuario creado con Google: ${email}`);

      return {
        isNewUser: true,
        user: newUser,
      };
    } catch (err) {
      logger.error(`Error en handleGoogleLogin: ${err.message}`);
      throw err;
    }
  }

  /**
   * Valida que un usuario tiene habilitado OAuth con Google
   * @param {string} userId - ID del usuario
   * @returns {object} Usuario validado
   */
  async validateGoogleUser(userId) {
    try {
      const user = await User.findById(userId);
      if (!user) {
        throw new Error("Usuario no encontrado");
      }

      if (!user.datos_acceso.google_id) {
        throw new Error("Usuario no tiene habilitado Google OAuth");
      }

      return user;
    } catch (err) {
      logger.error(`Error en validateGoogleUser: ${err.message}`);
      throw err;
    }
  }
}

module.exports = new GoogleAuthService();
