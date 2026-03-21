const { Router } = require("express");
const { param, body, validationResult } = require("express-validator");
const userController = require("../controllers/userController");

const router = Router();

function validate(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      error: "Error de validación",
      errors: errors.array().map((e) => ({ field: e.path, message: e.msg })),
    });
  }
  next();
}

/**
 * @swagger
 * /api/user/profile:
 *   get:
 *     summary: Obtener perfil y reputación del usuario
 *     tags: [User]
 *     responses:
 *       200:
 *         description: Datos del perfil
 *       404:
 *         description: Usuario no encontrado
 */
router.get("/profile/:userId", [param("userId").isMongoId()], validate, (req, res, next) =>
  userController.getProfile(req, res, next)
);

/**
 * @swagger
 * /api/user/favorites:
 *   put:
 *     summary: Añadir/quitar zonas favoritas con configuración
 *     tags: [User]
 */
router.put(
  "/favorites",
  [
    body("userId").isMongoId(),
    body("zonaId").isMongoId(),
    body("accion").isIn(["add", "remove"]),
  ],
  validate,
  (req, res, next) => userController.updateFavorites(req, res, next)
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
