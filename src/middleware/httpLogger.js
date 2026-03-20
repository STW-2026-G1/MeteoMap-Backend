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

module.exports = httpLogger;
