const { Router } = require("express");
const { body, validationResult } = require("express-validator");
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
 * /api/chat/ask:
 *   post:
 *     summary: Endpoint para el asistente virtual IA
 *     tags: [Chat]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               usuario_id: { type: string }
 *               pregunta: { type: string }
 *               contexto: { type: string }
 *     responses:
 *       200:
 *         description: Respuesta del chatbot
 */
router.post(
  "/ask",
  [
    body("usuario_id").isMongoId(),
    body("pregunta").isString().trim().isLength({ min: 1 }),
    body("contexto").optional().isString().trim(),
  ],
  validate,
  async (req, res, next) => {
    try {
      const { usuario_id, pregunta, contexto } = req.body;

      // TODO: Integrar con servicio de IA (OpenAI, Claude, etc.)
      logger.info(`Chat request de usuario ${usuario_id}: ${pregunta}`);

      const respuesta = {
        id: Math.random().toString(36).substr(2, 9),
        pregunta,
        respuesta: "Respuesta del asistente IA (a implementar)",
        contexto_usado: contexto || null,
        timestamp: new Date(),
      };

      res.json({
        mensaje: "Respuesta generada",
        datos: respuesta,
        nota: "Los modelos de IA se integrarán aquí",
      });
    } catch (err) {
      next(err);
    }
  }
);

module.exports = router;
