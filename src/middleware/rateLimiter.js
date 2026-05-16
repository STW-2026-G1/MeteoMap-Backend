/**
 * @file Middleware de Rate Limiting
 * @module middleware/rateLimiter
 * @description Configuración de límites de peticiones por IP usando express-rate-limit y MongoDB.
 * @author MeteoMap Team
 */

const rateLimit = require("express-rate-limit");
const MongoStore = require("rate-limit-mongo");
const logger = require("../config/logger");

// Configuración común del store para persistir límites a través de reinicios serverless
const storeConfig = {
  uri: process.env.MONGODB_URI || "mongodb://localhost:27017/",
  // El limitador compartirá cuotas si múltiples instancias lambda de Vercel acceden a la misma BD
  collectionName: "rate_limits",
};

// 1. Limitador Global (para todas las rutas de la API)
const globalLimiter = rateLimit({
  store: new MongoStore(storeConfig),
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 300, // Máximo 300 peticiones por IP cada 15 minutos
  standardHeaders: true, // Devuelve headers de límite de peticiones (RateLimit-Limit, etc.)
  legacyHeaders: false, // Deshabilita los encabezados X-RateLimit-* antiguos
  message: {
    error: "Demasiadas peticiones desde esta IP. Por favor, inténtalo de nuevo más tarde."
  },
  handler: (req, res, next, options) => {
    logger.warn(`Rate limit GLOBAL excedido por IP: ${req.ip}`);
    res.status(options.statusCode).json(options.message);
  }
});

// 2. Limitador Estricto para Autenticación (Login, Registro, Recuperación de contraseña)
const authLimiter = rateLimit({
  store: new MongoStore(storeConfig),
  windowMs: 60 * 60 * 1000, // 1 hora
  max: 5, // Máximo 100 intentos por IP cada hora
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: "Demasiados intentos de autenticación. Inténtalo de nuevo en una hora."
  },
  handler: (req, res, next, options) => {
    logger.warn(`Rate limit AUTH excedido por IP: ${req.ip}`);
    res.status(options.statusCode).json(options.message);
  }
});

// 3. Limitador para creación de contenido colaborativo (Reportes, Comentarios) (Anti-Spam)
const contentLimiter = rateLimit({
  store: new MongoStore(storeConfig),
  windowMs: 10 * 60 * 1000, // 10 minutos
  max: 15, // Máximo 15 publicaciones por IP cada 10 minutos
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: "Estás publicando contenido demasiado rápido. Esquema Anti-Spam activado, espera unos minutos."
  },
  handler: (req, res, next, options) => {
    logger.warn(`Rate limit ANTI-SPAM excedido por IP: ${req.ip} en la ruta ${req.originalUrl}`);
    res.status(options.statusCode).json(options.message);
  }
});

module.exports = {
  globalLimiter,
  authLimiter,
  contentLimiter
};