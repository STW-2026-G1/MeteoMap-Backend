const { Router } = require("express");
const { param, body, validationResult } = require("express-validator");
const userController = require("../controllers/userController");
const isAuth = require("../middleware/auth");
const { updatePasswordSchema, validateRequest } = require("../utils/validation");
const router = Router();

function validate(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const error = new Error(errors.array()[0].msg);
    error.status = 400;
    return next(error);
  }
  next();
}

/**
 * @swagger
 * /api/user/profile/{userId}:
 *   get:
 *     summary: Obtener perfil del usuario
 *     tags: [User]
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID del usuario
 *         example: "507f1f77bcf86cd799439011"
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Datos del perfil
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 _id:
 *                   type: string
 *                 email:
 *                   type: string
 *                 perfil:
 *                   type: object
 *                   properties:
 *                     nombre:
 *                       type: string
 *                     avatar_url:
 *                       type: string
 *                 preferencias:
 *                   type: array
 *                   items:
 *                     type: string
 *                     description: Zone ObjectId
 *                 limites_ia:
 *                   type: object
 *                   properties:
 *                     peticiones_hoy:
 *                       type: number
 *                     ultimo_reset:
 *                       type: string
 *                       format: date-time
 *                 estado:
 *                   type: string
 *                   enum: [ACTIVO, BLOQUEADO]
 *       400:
 *         description: ID de usuario inválido
 *       401:
 *         description: No autorizado
 *       404:
 *         description: Usuario no encontrado
 */
router.get(
  "/profile/:userId",
  isAuth,
  [param("userId").isMongoId().withMessage("ID de usuario inválido")],
  validate,
  userController.getProfile
);

/**
 * @swagger
 * /api/user/me:
 *   get:
 *     summary: Obtener mi propio perfil
 *     tags: [User]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Datos del perfil del usuario autenticado
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 _id:
 *                   type: string
 *                 email:
 *                   type: string
 *                 perfil:
 *                   type: object
 *                   properties:
 *                     nombre:
 *                       type: string
 *                     avatar_url:
 *                       type: string
 *                 preferencias:
 *                   type: array
 *                   items:
 *                     type: string
 *                     description: Zone ObjectId
 *                 limites_ia:
 *                   type: object
 *                   properties:
 *                     peticiones_hoy:
 *                       type: number
 *                     ultimo_reset:
 *                       type: string
 *                       format: date-time
 *                 estado:
 *                   type: string
 *                   enum: [ACTIVO, BLOQUEADO]
 *                 createdAt:
 *                   type: string
 *                   format: date-time
 *                 updatedAt:
 *                   type: string
 *                   format: date-time
 *       401:
 *         description: No autorizado
 *       404:
 *         description: Usuario no encontrado
 */
router.get(
  "/me",
  isAuth,
  validate,
  userController.getMyProfile
);

/**
 * @swagger
 * /api/user/me/favorites:
 *   put:
 *     summary: Añadir o quitar zonas favoritas del usuario autenticado
 *     tags: [User]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - zonaId
 *               - accion
 *             properties:
 *               zonaId:
 *                 type: string
 *                 description: ID de la zona
 *                 example: "69c1170c67ab1cff0dd1e53c"
 *               accion:
 *                 type: string
 *                 enum: [add, remove]
 *                 description: add para añadir, remove para quitar
 *                 example: "add"
 *     responses:
 *       200:
 *         description: Favoritos actualizados correctamente
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 preferencias:
 *                   type: array
 *                   items:
 *                     type: string
 *       400:
 *         description: |
 *           Error de validación. Posibles causas:
 *           - ID de zona inválido (no es un MongoID válido)
 *           - Acción inválida (debe ser 'add' o 'remove')
 *       401:
 *         description: No autorizado
 *       404:
 *         description: Zona no encontrada
 */
router.put(
  "/me/favorites",
  isAuth,
  [
    body("zonaId").isMongoId().withMessage("ID de zona inválido"),
    body("accion").isIn(["add", "remove"]).withMessage("Acción debe ser add o remove"),
  ],
  validate,
  userController.updateFavorites
);

/**
 * @swagger
 * /api/user/me/favorites:
 *   get:
 *     summary: Obtener zonas favoritas del usuario autenticado
 *     tags: [User]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Lista de zonas favoritas
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 preferencias:
 *                   type: array
 *                   items:
 *                     type: object
 *       401:
 *         description: No autorizado
 */
router.get(
  "/me/favorites",
  isAuth,
  validate,
  userController.getFavorites
);

/**
 * @swagger
 * /api/user/delete:
 *   post:
 *     summary: Eliminar usuario autenticado
 *     tags: [User]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Usuario eliminado exitosamente
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Usuario eliminado exitosamente"
 *                 userId:
 *                   type: string
 *                   example: "507f1f77bcf86cd799439011"
 *       401:
 *         description: No autorizado
 *       404:
 *         description: Usuario no encontrado
 */
router.post(
  "/delete",
  isAuth,
  validate,
  userController.deleteUser
);

/**
 * @swagger
 * /api/user/update:
 *   put:
 *     summary: Actualizar perfil del usuario autenticado
 *     tags: [User]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               nombre:
 *                 type: string
 *                 description: Nombre del usuario
 *                 example: "Juan Pérez"
 *               email:
 *                 type: string
 *                 description: Email del usuario
 *                 example: "juan@example.com"
 *               biografia:
 *                 type: string
 *                 description: Biografía del usuario
 *                 example: "Amante de las montañas y la meteorología"
 *               ubicacion:
 *                 type: string
 *                 description: Ubicación del usuario
 *                 example: "Barcelona, España"
 *               avatar_style:
 *                 type: string
 *                 description: Estilo del avatar (DiceBear)
 *                 example: "avataaars"
 *                 enum: ["avataaars", "bottts", "lorelei", "pixel-art", "thumbs", "notionists", "notionists-neutral", "dylan", "croodles", "personas"]
 *     responses:
 *       200:
 *         description: Perfil actualizado exitosamente
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 user:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                     email:
 *                       type: string
 *                     perfil:
 *                       type: object
 *       400:
 *         description: Datos inválidos o email duplicado
 *       401:
 *         description: No autorizado
 *       404:
 *         description: Usuario no encontrado
 */
router.put(
  "/update",
  isAuth,
  [
    body("nombre").optional().isString().trim(),
    body("email").optional().isEmail().withMessage("Email no válido"),
    body("biografia").optional().isString().trim(),
    body("ubicacion").optional().isString().trim(),
    body("avatar_style").optional().isIn(['avataaars', 'bottts', 'lorelei', 'pixel-art', 'thumbs', 'notionists', 'notionists-neutral', 'dylan', 'croodles', 'personas']).withMessage("Estilo de avatar inválido"),
  ],
  validate,
  userController.updateUser
);

/**
 * @swagger
 * /api/user/updatepassword:
 *   put:
 *     summary: Actualizar contraseña del usuario autenticado
 *     tags: [User]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - currentPassword
 *               - newPassword
 *             properties:
 *               currentPassword:
 *                 type: string
 *                 description: Contraseña actual
 *                 example: "OldPassword123!"
 *               newPassword:
 *                 type: string
 *                 description: Nueva contraseña (mínimo 8 caracteres)
 *                 minLength: 8
 *                 example: "NewPassword123!"
 *     responses:
 *       200:
 *         description: Contraseña actualizada exitosamente
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *       400:
 *         description: Datos inválidos o contraseña muy corta
 *       401:
 *         description: Contraseña actual incorrecta o no autorizado
 *       404:
 *         description: Usuario no encontrado
 */
router.put(
  "/updatepassword",
  isAuth,
  validateRequest(updatePasswordSchema),
  userController.updatePassword
);

module.exports = router;
