const logger = require("../config/logger");
const User = require("../models/User");

/**
 * @file Servicio de Autenticación con GitHub OAuth2
 * @module services/githubAuthService
 * @description Implementa la lógica de negocio para autenticación con GitHub:
 * - Validación de datos de usuario de GitHub API
 * - Creación automática de usuarios
 * - Vinculación de cuentas existentes
 * - Gestión de proveedores OAuth
 */
class GithubAuthService {
  /**
   * Verifica y procesa login con GitHub
   * @param {object} githubUser - Datos del usuario obtenidos de GitHub API (email, name, login, id, avatar_url)
   * @returns {object} Objeto con isNewUser y usuario creado o existente
   */
  async handleGithubLogin(githubUser) {
    try {
      const { email, name, login, id: githubId, avatar_url } = githubUser;
      
      const userEmail = email || `${login}@users.noreply.github.com`;
      const displayName = name || login;

      if (!githubId) {
        throw new Error("Datos de GitHub inválidos: falta el ID");
      }

      // Buscar usuario existente por email O por github_id
      let user = await User.findOne({
        $or: [
          { "datos_acceso.email": userEmail },
          { "datos_acceso.github_id": githubId.toString() },
        ],
      });

      if (user) {
        // Verificar que el usuario no esté eliminado
        if (user.estado === "ELIMINADO") {
          logger.warn(`Intento de login con GitHub en cuenta eliminada: ${userEmail}`);
          const error = new Error("La cuenta ha sido eliminada. Contacta con soporte para recuperarla");
          error.status = 403;
          throw error;
        }

        // Usuario existe: verificar y actualizar datos de GitHub
        if (!user.datos_acceso.github_id) {
          // Usuario local que ahora usa GitHub
          user.datos_acceso.github_id = githubId.toString();
          user.datos_acceso.provider = "github";
          logger.info(`Usuario local vinculado con GitHub: ${userEmail}`);
        }

        // Actualizar perfil si no tiene nombre
        if (displayName && !user.perfil.nombre) {
          user.perfil.nombre = displayName;
          user.perfil.avatar_seed = displayName;
        }

        await user.save();
        logger.info(`Login con GitHub exitoso: ${userEmail}`);

        return {
          isNewUser: false,
          user,
        };
      }

      // Crear nuevo usuario con GitHub
      const newUser = new User({
        datos_acceso: {
          email: userEmail.toLowerCase(),
          github_id: githubId.toString(),
          provider: "github",
          rol: "USER",
        },
        perfil: {
          nombre: displayName,
          avatar_seed: displayName,
          avatar_style: 'avataaars',
        },
      });

      await newUser.save();
      logger.info(`Nuevo usuario creado con GitHub: ${userEmail}`);

      return {
        isNewUser: true,
        user: newUser,
      };
    } catch (err) {
      logger.error(`Error en handleGithubLogin: ${err.message}`);
      throw err;
    }
  }

  /**
   * Valida que un usuario tiene habilitado OAuth con GitHub
   * @param {string} userId - ID del usuario
   * @returns {object} Usuario validado
   */
  async validateGithubUser(userId) {
    try {
      const user = await User.findById(userId);
      if (!user) {
        throw new Error("Usuario no encontrado");
      }

      if (!user.datos_acceso.github_id) {
        throw new Error("Usuario no tiene habilitado GitHub OAuth");
      }

      return user;
    } catch (err) {
      logger.error(`Error en validateGithubUser: ${err.message}`);
      throw err;
    }
  }
}

module.exports = new GithubAuthService();
