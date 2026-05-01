const { Router } = require("express");
const { body, validationResult } = require("express-validator");
const chatController = require("../controllers/chatController");
const isAuth = require("../middleware/auth");
const logger = require("../config/logger");

const router = Router();

function validate(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      status: "error",
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
 *     summary: Chatbot inteligente con acceso a todos los endpoints
 *     description: |
 *       Chatbot que analiza tu pregunta y automáticamente obtiene información relevante 
 *       de todos los endpoints (zonas, clima, reportes, etc.) para generar una respuesta 
 *       inteligente en lenguaje natural.
 *     tags: [Chat]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               usuario_id:
 *                 type: string
 *                 description: ID del usuario (MongoDB ObjectId)
 *                 example: "507f1f77bcf86cd799439011"
 *               pregunta:
 *                 type: string
 *                 description: Tu pregunta sobre montañismo, zonas, clima, etc.
 *                 example: "¿Que tiempo hace en ordesa?"
 *             required: [usuario_id, pregunta]
 *     responses:
 *       200:
 *         description: Respuesta inteligente del chatbot
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: "success"
 *                 data:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                       description: ID único de la respuesta
 *                     usuario_id:
 *                       type: string
 *                     pregunta:
 *                       type: string
 *                     respuesta:
 *                       type: string
 *                       description: Respuesta en lenguaje natural
 *                     datos_utilizados:
 *                       type: array
 *                       items: { type: string }
 *                       description: Qué datos del sistema se utilizaron
 *                     modelo:
 *                       type: string
 *                       example: "gemini-1.5-flash"
 *                     timestamp:
 *                       type: string
 *       400:
 *         description: Error de validación
 *       500:
 *         description: Error interno del servidor
 */
router.post(
  "/ask",
  isAuth,
  [
    body("pregunta")
      .isString()
      .trim()
      .isLength({ min: 1 })
      .withMessage("pregunta es requerida"),
    body("contexto")
      .optional()
      .isString()
      .trim()
      .withMessage("contexto debe ser texto"),
  ],
  validate,
  (req, res, next) => chatController.getResponse(req, res, next)
);

module.exports = router;
