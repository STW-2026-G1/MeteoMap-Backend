const { Router } = require("express");
const { param, body, validationResult } = require("express-validator");
const userController = require("../controllers/userController");
const isAuth = require("../middleware/auth")
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
 *     summary: Obtener perfil y reputación del usuario
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
 *                     type: object
 *                     properties:
 *                       zona_id:
 *                         type: string
 *                       configuracion_alertas:
 *                         type: object
 *                         properties:
 *                           aludes:
 *                             type: object
 *                             properties:
 *                               activo:
 *                                 type: boolean
 *                               umbral_nivel:
 *                                 type: number
 *                           viento:
 *                             type: object
 *                             properties:
 *                               activo:
 *                                 type: boolean
 *                               umbral_kmh:
 *                                 type: number
 *                           reportes_comunidad:
 *                             type: object
 *                             properties:
 *                               activo:
 *                                 type: boolean
 *                               tipos_suscritos:
 *                                 type: array
 *                                 items:
 *                                   type: string
 *                       metodo_notificacion:
 *                         type: string
 *                         enum: [PUSH, EMAIL, SMS, NINGUNO]
 *                       fecha_agregada:
 *                         type: string
 *                         format: date-time
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
 *                     type: object
 *                     properties:
 *                       zona_id:
 *                         type: string
 *                       configuracion_alertas:
 *                         type: object
 *                         properties:
 *                           aludes:
 *                             type: object
 *                             properties:
 *                               activo:
 *                                 type: boolean
 *                               umbral_nivel:
 *                                 type: number
 *                           viento:
 *                             type: object
 *                             properties:
 *                               activo:
 *                                 type: boolean
 *                               umbral_kmh:
 *                                 type: number
 *                           reportes_comunidad:
 *                             type: object
 *                             properties:
 *                               activo:
 *                                 type: boolean
 *                               tipos_suscritos:
 *                                 type: array
 *                                 items:
 *                                   type: string
 *                       metodo_notificacion:
 *                         type: string
 *                         enum: [PUSH, EMAIL, SMS, NINGUNO]
 *                       fecha_agregada:
 *                         type: string
 *                         format: date-time
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
 *                 reputacion:
 *                   type: object
 *                   properties:
 *                     puntos:
 *                       type: number
 *                     medalla:
 *                       type: string
 *                     strikes_spam:
 *                       type: number
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
 *               configuracion_alertas:
 *                 type: object
 *                 description: Configuración de alertas (solo para acción add)
 *                 properties:
 *                   aludes:
 *                     type: object
 *                     properties:
 *                       activo:
 *                         type: boolean
 *                       umbral_nivel:
 *                         type: number
 *                         minimum: 1
 *                         maximum: 5
 *                   viento:
 *                     type: object
 *                     properties:
 *                       activo:
 *                         type: boolean
 *                       umbral_kmh:
 *                         type: number
 *                   reportes_comunidad:
 *                     type: object
 *                     properties:
 *                       activo:
 *                         type: boolean
 *                       tipos_suscritos:
 *                         type: array
 *                         items:
 *                           type: string
 *               metodo_notificacion:
 *                 type: string
 *                 enum: [PUSH, EMAIL, SMS, NINGUNO]
 *                 default: PUSH
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
 *                     type: object
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
    body("configuracion_alertas").optional().isObject(),
    body("metodo_notificacion").optional().isIn(["PUSH", "EMAIL", "SMS", "NINGUNO"])
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
 * /api/user/alerts/:userId/:zoneId:
 *   patch:
 *     summary: Actualizar configuración de alertas para una zona
 *     tags: [User]
 */
router.patch(
  "/alerts/:userId/:zoneId",
  [param("userId").isMongoId(), param("zoneId").isMongoId()],
  validate,
  (req, res, next) => userController.updateAlertConfig(req, res, next)
);

module.exports = router;
