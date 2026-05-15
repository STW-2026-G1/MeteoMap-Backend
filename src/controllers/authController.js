/**
 * @file Controlador de autenticación
 * @module controllers/AuthController
 * @description Maneja las solicitudes HTTP de autenticación y mapea hacia los servicios correspondientes.
 * Gestiona registro, login, OAuth (Google y GitHub), recuperación de contraseña, y logout.
 */

const authService = require("../services/authService");
const googleAuthService = require("../services/googleAuthService");
const githubAuthService = require("../services/githubAuthService");
const tokenService = require("../services/tokenService");
const { verifyGoogleToken, verifyGithubCode } = require("../utils/oauthValidator");
const logger = require("../config/logger");
const chatService = require("../services/chatService");

/**
 * Controlador de autenticación
 * Maneja mapeo HTTP → servicios
 */
class AuthController {
  /**
   * POST /api/auth/register
   * Registrar nuevo usuario
   */
  async register(req, res, next) {
    try {
      const { email, password, nombre, avatar_style } = req.body;

      const result = await authService.register(email, password, nombre, avatar_style);

      res.status(201).json(result);
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/auth/login
   * Iniciar sesión con email y contraseña
   */
  async login(req, res, next) {
    try {
      const { email, password } = req.body;

      const result = await authService.loginWithEmail(email, password);

      res.json(result);
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/auth/logout
   * Cerrar sesión
   */
  logout(req, res, next) {
    try {
      const userId = req.user.userId;
      // Limpiar historial de chat del usuario al cerrar sesión
      chatService.limpiarHistorial(userId);
      
      const result = authService.logout();
      res.json(result);
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/auth/login-google
   * Iniciar sesión con Google OAuth2
   */
  async loginGoogle(req, res, next) {
    try {
      const { idToken } = req.body;

      if (!idToken) {
        return res.status(400).json({
          error: "idToken requerido",
        });
      }

      const clientId = process.env.GOOGLE_CLIENT_ID;
      if (!clientId) {
        logger.error("GOOGLE_CLIENT_ID no configurado");
        return res.status(500).json({
          error: "Configuración de servidor incompleta",
        });
      }

      // Verificar y decodificar token de Google
      const tokenPayload = await verifyGoogleToken(idToken, clientId);

      // Procesar login con Google (crear o actualizar usuario)
      const { user } = await googleAuthService.handleGoogleLogin(tokenPayload);

      // Generar JWT
      const accessToken = tokenService.generateSingleJWT({
        userId: user._id.toString(),
        email: user.datos_acceso.email,
        rol: user.datos_acceso.rol,
      });

      logger.info(`Login exitoso con Google: ${user.datos_acceso.email}`);

      res.json({
        message: "Login con Google exitoso",
        accessToken,
        user: {
          id: user._id.toString(),
          email: user.datos_acceso.email,
          nombre: user.perfil.nombre,
          avatar_style: user.perfil.avatar_style,
          avatar_seed: user.perfil.avatar_seed,
          biografia: user.perfil.biografia,
          ubicacion: user.perfil.ubicacion,
          avatar_url: user.perfil.avatar_url,
          rol: user.datos_acceso.rol,
          createdAt: user.createdAt,
        },
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/auth/login-github
   * Iniciar sesión con GitHub OAuth2
   */
  async loginGithub(req, res, next) {
    try {
      const { code } = req.body;

      if (!code) {
        return res.status(400).json({
          error: "código de autorización requerido",
        });
      }

      const clientId = process.env.GITHUB_CLIENT_ID;
      const clientSecret = process.env.GITHUB_CLIENT_SECRET;
      if (!clientId || !clientSecret) {
        logger.error("GITHUB_CLIENT_ID o GITHUB_CLIENT_SECRET no configurado");
        return res.status(500).json({
          error: "Configuración de servidor incompleta",
        });
      }

      // Intercambiar código por token y obtener datos de GitHub
      const githubUser = await verifyGithubCode(code, clientId, clientSecret);

      // Procesar login con GitHub (crear o actualizar usuario)
      const { user } = await githubAuthService.handleGithubLogin(githubUser);

      // Generar JWT
      const accessToken = tokenService.generateSingleJWT({
        userId: user._id.toString(),
        email: user.datos_acceso.email,
        rol: user.datos_acceso.rol,
      });

      logger.info(`Login exitoso con GitHub: ${user.datos_acceso.email}`);

      res.json({
        message: "Login con GitHub exitoso",
        accessToken,
        user: {
          id: user._id.toString(),
          email: user.datos_acceso.email,
          nombre: user.perfil.nombre,
          avatar_style: user.perfil.avatar_style,
          avatar_seed: user.perfil.avatar_seed,
          biografia: user.perfil.biografia,
          ubicacion: user.perfil.ubicacion,
          avatar_url: user.perfil.avatar_url,
          rol: user.datos_acceso.rol,
          createdAt: user.createdAt,
        },
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/auth/forgot-password
   * Solicitar recuperación de contraseña
   */
  async forgotPassword(req, res, next) {
    try {
      const { email } = req.body;

      const result = await authService.forgotPassword(email);

      res.json(result);
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/auth/reset-password
   * Restablecer contraseña con token
   */
  async resetPassword(req, res, next) {
    try {
      const { token, newPassword } = req.body;

      const result = await authService.resetPassword(token, newPassword);

      res.json(result);
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new AuthController();
