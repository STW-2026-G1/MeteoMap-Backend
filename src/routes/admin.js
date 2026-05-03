const { Router } = require("express");
const { body, param, validationResult } = require("express-validator");
const adminController = require("../controllers/adminController");

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
 * /api/admin/users:
 *   get:
 *     summary: Listar usuarios no administradores
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Listado de usuarios
 */
router.get("/users", (req, res, next) => adminController.getUsers(req, res, next));

/**
 * @swagger
 * /api/admin/users/{id}:
 *   put:
 *     summary: Editar usuario no administrador
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID del usuario a editar
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               nombre:
 *                 type: string
 *               email:
 *                 type: string
 *                 format: email
 *               estado:
 *                 type: string
 *                 enum: [ACTIVO]
 *               biografia:
 *                 type: string
 *               ubicacion:
 *                 type: string
 *               avatar_style:
 *                 type: string
 *     responses:
 *       200:
 *         description: Usuario actualizado
 *       400:
 *         description: Error de validación
 *       404:
 *         description: Usuario no encontrado
 */
router.put(
  "/users/:id",
  [
    param("id").isMongoId(),
    body("nombre").optional().isString().trim().isLength({ min: 1 }),
    body("email").optional().isEmail().normalizeEmail(),
    body("estado").optional().isIn(["ACTIVO"]),
    body("biografia").optional().isString().trim(),
    body("ubicacion").optional().isString().trim(),
    body("avatar_style").optional().isString().trim(),
  ],
  validate,
  (req, res, next) => adminController.updateUser(req, res, next)
);

/**
 * @swagger
 * /api/admin/users/{id}:
 *   delete:
 *     summary: Eliminar usuario no administrador
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID del usuario a eliminar
 *     responses:
 *       200:
 *         description: Usuario eliminado
 *       404:
 *         description: Usuario no encontrado
 */
router.delete(
  "/users/:id",
  [param("id").isMongoId()],
  validate,
  (req, res, next) => adminController.deleteUser(req, res, next)
);

/**
 * @swagger
 * /api/admin/users/{id}/restore:
 *   put:
 *     summary: Restaurar usuario eliminado
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID del usuario a restaurar
 *     responses:
 *       200:
 *         description: Usuario restaurado a ACTIVO
 *       404:
 *         description: Usuario no encontrado
 */
router.put(
  "/users/:id/restore",
  [param("id").isMongoId()],
  validate,
  (req, res, next) => adminController.restoreUser(req, res, next)
);

/**
 * @swagger
 * /api/admin/reports/{id}:
 *   delete:
 *     summary: Borrar reporte (admin)
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID del reporte
 *     responses:
 *       200:
 *         description: Reporte eliminado con éxito
 *       404:
 *         description: Reporte no encontrado
 */
router.delete(
  "/reports/:id",
  [param("id").isMongoId()],
  validate,
  (req, res, next) => adminController.deleteReport(req, res, next)
);

/**
 * Dashboard de administración con datos agregados reales
 */
router.get("/dashboard", (req, res, next) => adminController.getDashboard(req, res, next));
module.exports = router;
