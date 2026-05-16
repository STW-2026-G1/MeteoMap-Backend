/**
 * @file Rutas de autenticación
 * @module routes/auth
 * @description Define los endpoints de registro, login y gestión de credenciales, así como SSO.
 * @author MeteoMap Team
 */

const { Router } = require("express");
const { validateRequest, loginSchema, registerSchema, forgotPasswordSchema, resetPasswordSchema } = require("../utils/validation");
const authController = require("../controllers/authController");
const isAuth = require("../middleware/auth");
const { authLimiter } = require("../middleware/rateLimiter");

const router = Router();

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
 *               avatar_style: { type: string, enum: ["avataaars", "bottts", "lorelei", "pixel-art", "thumbs", "notionists", "notionists-neutral", "dylan", "croodles", "personas"] }  
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
  authLimiter,
  validateRequest(registerSchema),
  authController.register
);


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
  authLimiter,
  validateRequest(loginSchema),
  authController.login
);


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
router.post("/logout", isAuth, authController.logout);

/**
 * @swagger
 * /api/auth/login-google:
 *   post:
 *     summary: Login con Google OAuth2
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               idToken: { type: string, description: "Google ID Token from frontend" }
 *     responses:
 *       200:
 *         description: Login exitoso con Google
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message: { type: string }
 *                 accessToken: { type: string }
 *                 user: { type: object }
 *       400:
 *         description: Token inválido o faltante
 *       500:
 *         description: Error en servidor
 */
router.post("/login-google", authLimiter, authController.loginGoogle);

/**
 * @swagger
 * /api/auth/login-github:
 *   post:
 *     summary: Login con GitHub OAuth2
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               code: { type: string, description: "Authorization code from GitHub" }
 *     responses:
 *       200:
 *         description: Login exitoso con GitHub
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message: { type: string }
 *                 accessToken: { type: string }
 *                 user: { type: object }
 *       400:
 *         description: Código inválido o faltante
 *       500:
 *         description: Error en servidor
 */
router.post("/login-github", authLimiter, authController.loginGithub);

/**
 * @swagger
 * /api/auth/forgot-password:
 *   post:
 *     summary: Solicitar recuperación de contraseña
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               email: { type: string, example: user@example.com }
 *     responses:
 *       200:
 *         description: Solicitud procesada (respuesta genérica por seguridad)
 *       400:
 *         description: Email inválido
 */
router.post(
  "/forgot-password",
  authLimiter,
  validateRequest(forgotPasswordSchema),
  authController.forgotPassword
);

/**
 * @swagger
 * /api/auth/reset-password:
 *   post:
 *     summary: Restablecer contraseña con token
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               token: { type: string, description: "Token de recuperación de la URL" }
 *               newPassword: { type: string, minLength: 8, description: "Contraseña con mayúscula, minúscula, número y carácter especial" }
 *     responses:
 *       200:
 *         description: Contraseña actualizada correctamente
 *       400:
 *         description: Token inválido/expirado o contraseña no cumple requisitos
 */
router.post(
  "/reset-password",
  authLimiter,
  validateRequest(resetPasswordSchema),
  authController.resetPassword
);

module.exports = router;
