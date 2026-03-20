const { Router } = require("express");
const { body, validationResult } = require("express-validator");
const User = require("../models/User");
const logger = require("../config/logger");

const router = Router();

function validate(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      error: "Validation Error",
      errors: errors.array().map((e) => ({ field: e.path, message: e.msg })),
    });
  }
  next();
}

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
 *               email: { type: string, example: user@example.com }
 *               password: { type: string }
 *               nombre: { type: string }
 *     responses:
 *       201:
 *         description: Usuario registrado exitosamente
 *       400:
 *         description: Datos inválidos o email duplicado
 */
router.post(
  "/register",
  [
    body("email").isEmail().normalizeEmail(),
    body("password").isLength({ min: 6 }).withMessage("Password debe tener al menos 6 caracteres"),
    body("nombre").optional().isString().trim(),
  ],
  validate,
  async (req, res, next) => {
    try {
      const { email, password, nombre } = req.body;

      // Verificar si el usuario ya existe
      const existingUser = await User.findOne({ "datos_acceso.email": email });
      if (existingUser) {
        return res.status(400).json({ error: "El email ya está registrado" });
      }

      // TODO: Hashear password con bcrypt
      const newUser = new User({
        datos_acceso: {
          email,
          password_hash: password, // En producción, usar bcrypt
          rol: "PUBLIC",
        },
        perfil: {
          nombre: nombre || "",
        },
      });

      await newUser.save();
      logger.info(`Usuario registrado: ${email}`);

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
 *               email: { type: string }
 *               password: { type: string }
 *     responses:
 *       200:
 *         description: Login exitoso
 *       401:
 *         description: Credenciales inválidas
 */
router.post(
  "/login",
  [
    body("email").isEmail(),
    body("password").isLength({ min: 6 }),
  ],
  validate,
  async (req, res, next) => {
    try {
      const { email, password } = req.body;

      const user = await User.findOne({ "datos_acceso.email": email });
      if (!user) {
        return res.status(401).json({ error: "Credenciales inválidas" });
      }

      // TODO: Usar bcrypt para comparar passwords
      if (user.datos_acceso.password_hash !== password) {
        return res.status(401).json({ error: "Credenciales inválidas" });
      }

      if (user.estado === "BLOQUEADO") {
        return res.status(403).json({ error: "Usuario bloqueado" });
      }

      // TODO: Generar JWT token
      logger.info(`Usuario autorizado: ${email}`);

      res.json({
        message: "Login exitoso",
        user: {
          id: user._id,
          email: user.datos_acceso.email,
          nombre: user.perfil.nombre,
          rol: user.datos_acceso.rol,
        },
        // token: generatedToken,
      });
    } catch (err) {
      next(err);
    }
  }
);

module.exports = router;
