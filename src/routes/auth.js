const { Router } = require("express");
const bcrypt = require("bcrypt");
const User = require("../models/User");
const logger = require("../config/logger");
const tokenService = require("../services/tokenService");
const { validateRequest, loginSchema, registerSchema } = require("../utils/validation");

const router = Router();

const BCRYPT_SALT_ROUNDS = 12;

// ============================================================================
// POST /api/auth/register - Registro de usuario
// ============================================================================
/**
 * @swagger
 * /api/auth/register:
 *   post:
 *     summary: Registro de usuario
 *     tags: [Auth]
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
 *         description: Login exitoso
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

      // Generar Access Token
      const accessToken = tokenService.generateTokenPair({
        userId: user._id.toString(),
        email: user.datos_acceso.email,
        rol: user.datos_acceso.rol,
      });

      logger.info(`Login exitoso`, { email, userId: user._id });

      // Devolver Access Token
      res.json({
        message: "Login exitoso",
        accessToken,
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
// POST /api/auth/logout - Cerrar sesión
// ============================================================================
/**
 * @swagger
 * /api/auth/logout:
 *   post:
 *     summary: Cerrar sesión
 *     tags: [Auth]
 *     responses:
 *       200:
 *         description: Sesión cerrada exitosamente
 */
router.post("/logout", (req, res) => {
  logger.info("Usuario cerró sesión", { ip: req.ip });

  res.json({
    message: "Sesión cerrada exitosamente",
  });
});

module.exports = router;
