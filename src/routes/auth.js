const { Router } = require("express");
const bcrypt = require("bcrypt");
const User = require("../models/User");
const logger = require("../config/logger");
const tokenService = require("../services/tokenService");
const { validateRequest, loginSchema, registerSchema } = require("../utils/validation");

const router = Router();

const BCRYPT_SALT_ROUNDS = 12;
const REFRESH_TOKEN_COOKIE_NAME = "refreshToken";

// ============================================================================
// POST /api/auth/register - Registro de usuario
// ============================================================================
/**
 * @swagger
 * /api/auth/register:
 *   post:
 *     summary: Registro de usuario
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               email: { type: string }
 *               password: { type: string }
 *               nombre: { type: string }
 *     responses:
 *       201:
 *         description: Usuario registrado exitosamente
 *       400:
 *         description: Datos inválidos o email duplicado
 *       429:
 *         description: Demasiados intentos de registro
 */
router.post(
  "/register",
  validateRequest(registerSchema),
  async (req, res, next) => {
    try {
      const { email, password, nombre } = req.body;

      // Verificar si el usuario ya existe
      const existingUser = await User.findOne({ "datos_acceso.email": email });
      if (existingUser) {
        logger.warn(`Registro fallido: email duplicado`, { email });
        return res.status(400).json({
          error: "El email ya está registrado",
        });
      }

      // Hashear la contraseña usando bcrypt con saltRounds = 12
      let passwordHash;
      try {
        passwordHash = await bcrypt.hash(password, BCRYPT_SALT_ROUNDS);
      } catch (err) {
        logger.error("Error hashing password during registration", { error: err.message });
        throw new Error("Error en el proceso de registro");
      }

      // Crear nuevo usuario
      const newUser = new User({
        datos_acceso: {
          email,
          password_hash: passwordHash,
          rol: "USER",
        },
        perfil: {
          nombre: nombre || "",
        },
      });

      await newUser.save();
      logger.info(`Usuario registrado exitosamente`, { email, userId: newUser._id });

      res.status(201).json({
        message: "Usuario registrado exitosamente",
        user: {
          id: newUser._id,
          email: newUser.datos_acceso.email,
          nombre: newUser.perfil.nombre,
        },
      });
    } catch (err) {
      next(err);
    }
  }
);

// ============================================================================
// POST /api/auth/login - Inicio de sesión
// ============================================================================
/**
 * @swagger
 * /api/auth/login:
 *   post:
 *     summary: Inicio de sesión
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               email: { type: string, example: user@example.com }
 *               password: { type: string, minLength: 8 }
 *     responses:
 *       200:
 *         description: Login exitoso. El Refresh Token se envía como cookie HttpOnly
 *         headers:
 *           Set-Cookie:
 *             schema:
 *               type: string
 *               example: refreshToken=abc123...; HttpOnly; Secure; SameSite=Strict; Path=/
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message: { type: string }
 *                 accessToken: { type: string }
 *                 user: { type: object }
 *       401:
 *         description: Credenciales inválidas (email o password incorrecto)
 *       403:
 *         description: Usuario bloqueado
 *       429:
 *         description: Demasiados intentos de login (rate limit)
 */
router.post(
  "/login",
  validateRequest(loginSchema),
  async (req, res, next) => {
    try {
      const { email, password } = req.body;

      // Buscar usuario por email
      const user = await User.findOne({ "datos_acceso.email": email });
      if (!user) {
        logger.warn(`Login fallido: usuario no encontrado`, { email });
        // Devolver mensaje genérico para no revelar si el email existe
        return res.status(401).json({
          error: "Credenciales inválidas",
        });
      }

      // Verificar que el usuario no esté bloqueado
      if (user.estado === "BLOQUEADO") {
        logger.warn(`Intento de login de usuario bloqueado`, { email, userId: user._id });
        return res.status(403).json({
          error: "Usuario bloqueado",
        });
      }

      // Comparar la contraseña con bcrypt
      const passwordMatch = await bcrypt.compare(password, user.datos_acceso.password_hash);
      if (!passwordMatch) {
        logger.warn(`Login fallido: contraseña incorrecta`, { email });
        // Devolver mensaje genérico
        return res.status(401).json({
          error: "Credenciales inválidas",
        });
      }

      // Generar tokens JWT (Access + Refresh)
      const { accessToken, refreshToken } = tokenService.generateTokenPair({
        userId: user._id.toString(),
        email: user.datos_acceso.email,
        rol: user.datos_acceso.rol,
      });

      // Configurar cookie HttpOnly y Secure para el Refresh Token
      // Secure: solo se envía por HTTPS (en producción)
      // HttpOnly: no puede ser accedido por JavaScript (previene XSS)
      // SameSite: previene CSRF
      res.cookie(REFRESH_TOKEN_COOKIE_NAME, refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 días en milisegundos
        path: "/",
      });

      logger.info(`Login exitoso`, { email, userId: user._id });

      // Devolver Access Token en el cuerpo (no el Refresh Token)
      res.json({
        message: "Login exitoso",
        accessToken,
        refreshToken,
        user: {
          id: user._id,
          email: user.datos_acceso.email,
          nombre: user.perfil.nombre,
          rol: user.datos_acceso.rol,
        },
      });
    } catch (err) {
      next(err);
    }
  }
);

// ============================================================================
// POST /api/auth/refresh - Refrescar Access Token
// ============================================================================
/**
 * @swagger
 * /api/auth/refresh:
 *   post:
 *     summary: Refrescar Access Token usando el Refresh Token (cookie HttpOnly)
 *     tags: [Auth]
 *     responses:
 *       200:
 *         description: Nuevo Access Token generado
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message: { type: string }
 *                 accessToken: { type: string }
 *       401:
 *         description: Refresh Token inválido o expirado
 */
router.post("/refresh", async (req, res, next) => {
  try {
    // Obtener el Refresh Token de las cookies
    const refreshToken = req.cookies[REFRESH_TOKEN_COOKIE_NAME];

    if (!refreshToken) {
      logger.warn("Refresh fallido: no se encontró refresh token en cookies", {
        ip: req.ip,
      });
      return res.status(401).json({
        error: "Refresh token no encontrado",
      });
    }

    // Verificar y decodificar el Refresh Token
    const decoded = tokenService.verifyRefreshToken(refreshToken);

    // Obtener datos adicionales del usuario (email, rol) de la BD
    const user = await User.findById(decoded.userId);
    if (!user) {
      logger.warn("Refresh fallido: usuario no encontrado", { userId: decoded.userId });
      return res.status(401).json({
        error: "Usuario no encontrado",
      });
    }

    if (user.estado === "BLOQUEADO") {
      logger.warn("Refresh fallido: usuario bloqueado", { userId: decoded.userId });
      return res.status(403).json({
        error: "Usuario bloqueado",
      });
    }

    // Generar nuevo Access Token (el Refresh Token sigue siendo válido)
    const newAccessToken = tokenService.generateNewAccessToken(refreshToken);

    // Opcionalmente, obtener datos completos del usuario para incluir en la respuesta
    // (Sin incluir el password_hash)
    const userData = {
      id: user._id,
      email: user.datos_acceso.email,
      nombre: user.perfil.nombre,
      rol: user.datos_acceso.rol,
    };

    logger.info(`Access token refrescado`, { userId: decoded.userId });

    res.json({
      message: "Access token refrescado exitosamente",
      accessToken: newAccessToken,
      user: userData,
    });
  } catch (err) {
    if (err.name === "TokenExpiredError") {
      logger.warn("Refresh fallido: refresh token expirado", { ip: req.ip });
      return res.status(401).json({
        error: "Refresh token expirado. Por favor, inicia sesión nuevamente.",
      });
    }

    if (err.name === "JsonWebTokenError") {
      logger.warn("Refresh fallido: refresh token inválido", { ip: req.ip });
      return res.status(401).json({
        error: "Refresh token inválido",
      });
    }

    next(err);
  }
});

// ============================================================================
// POST /api/auth/logout - Cerrar sesión
// ============================================================================
/**
 * @swagger
 * /api/auth/logout:
 *   post:
 *     summary: Cerrar sesión y limpiar cookies
 *     tags: [Auth]
 *     responses:
 *       200:
 *         description: Sesión cerrada exitosamente
 */
router.post("/logout", (req, res) => {
  // Limpiar la cookie del Refresh Token
  res.clearCookie(REFRESH_TOKEN_COOKIE_NAME, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
  });

  logger.info("Usuario cerró sesión", { ip: req.ip });

  res.json({
    message: "Sesión cerrada exitosamente",
  });
});

module.exports = router;
