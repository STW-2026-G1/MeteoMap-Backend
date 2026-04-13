const { Router } = require("express");
const { validateRequest, loginSchema, registerSchema } = require("../utils/validation");
const authController = require("../controllers/authController");

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
router.post("/logout", authController.logout);

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
router.post("/login-google", authController.loginGoogle);

module.exports = router;
