const morgan = require("morgan");
const logger = require("../config/logger");

// Redirige los textos de Morgan para que los guarde Winston
const stream = {
  write: (message) => logger.http(message.trim()),
};

// Ignora las peticiones a "/health" para que el archivo de logs no se llene de basura
const skip = (req) => req.url === "/health";

// - En producción: usa "combined" (formato largo con IP, navegador, etc. para auditar).
// - En local: usa "dev" (formato corto y con colores para programar rápido).
const httpLogger = morgan(
  process.env.NODE_ENV === "production" ? "combined" : "dev",
  { stream, skip }
);

// Middleware adicional para loguear respuestas con errores 4xx
httpLogger.errorLogger = (req, res, next) => {
  const originalJson = res.json;
  
  res.json = function(data) {
    // Debuggear todos los errores 4xx
    if (res.statusCode >= 400 && res.statusCode < 500) {
      logger.warn(`[${res.statusCode}] ${data.error || "Error"} on ${req.method} ${req.url}`, {
        statusCode: res.statusCode,
        message: data.message,
      });
    }
    return originalJson.call(this, data);
  };
  
  next();
};

module.exports = httpLogger;
