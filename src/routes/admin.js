const { Router } = require("express");
const { body, param, validationResult } = require("express-validator");
const User = require("../models/User");
const ReportCategory = require("../models/ReportCategory");
const SystemMetric = require("../models/SystemMetric");
const logger = require("../config/logger");

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
 * /api/admin/metrics:
 *   get:
 *     summary: Uso de APIs, cuotas de IA y salud del sistema
 *     tags: [Admin]
 *     responses:
 *       200:
 *         description: Métricas del sistema
 */
router.get("/metrics", async (req, res, next) => {
  try {
    // Último día de métricas
    const oneDay = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const metrics = await SystemMetric.aggregate([
      { $match: { createdAt: { $gte: oneDay } } },
      {
        $group: {
          _id: "$tipo",
          count: { $sum: 1 },
          avg_valor: { $avg: "$valor" },
        },
      },
    ]);

    logger.debug("GET /admin/metrics");

    res.json({
      periodo: "últimas 24 horas",
      metricas: metrics,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * @swagger
 * /api/admin/users/:id/block:
 *   patch:
 *     summary: Bloqueo de usuarios malintencionados
 *     tags: [Admin]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               accion: { type: string, enum: [block, unblock] }
 *     responses:
 *       200:
 *         description: Usuario bloqueado/desbloqueado
 */
router.patch(
  "/users/:id/block",
  [param("id").isMongoId(), body("accion").isIn(["block", "unblock"])],
  validate,
  async (req, res, next) => {
    try {
      const { id } = req.params;
      const { accion } = req.body;

      const user = await User.findById(id);
      if (!user) {
        return res.status(404).json({ error: "Usuario no encontrado" });
      }

      if (accion === "block") {
        user.estado = "BLOQUEADO";
      } else if (accion === "unblock") {
        user.estado = "ACTIVO";
      }

      await user.save();
      logger.warn(`Usuario ${id} ${accion === "block" ? "bloqueado" : "desbloqueado"}`);

      res.json({
        message: `Usuario ${accion === "block" ? "bloqueado" : "desbloqueado"}`,
        user,
      });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * @swagger
 * /api/admin/categories:
 *   post:
 *     summary: Gestión de tipos de reporte - Crear
 *     tags: [Admin]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               nombre: { type: string }
 *               descripcion: { type: string }
 *               icono_marcador: { type: string }
 *               creado_por: { type: string }
 *     responses:
 *       201:
 *         description: Categoría creada
 */
router.post(
  "/categories",
  [
    body("nombre").isString().trim(),
    body("descripcion").optional().isString().trim(),
    body("icono_marcador").optional().isString().trim(),
    body("creado_por").isMongoId(),
  ],
  validate,
  async (req, res, next) => {
    try {
      const { nombre, descripcion, icono_marcador, creado_por } = req.body;

      // Verificar que no existe ya esta categoría
      const existing = await ReportCategory.findOne({ nombre });
      if (existing) {
        return res.status(400).json({ error: "La categoría ya existe" });
      }

      const newCategory = new ReportCategory({
        nombre,
        descripcion,
        icono_marcador,
        creado_por,
      });

      await newCategory.save();
      logger.info(`Categoría creada: ${nombre}`);

      res.status(201).json({
        message: "Categoría de reporte creada",
        category: newCategory,
      });
    } catch (err) {
      next(err);
    }
  }
);

module.exports = router;
