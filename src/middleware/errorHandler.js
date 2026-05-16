/**
 * @file Middleware de manejo de errores
 * @module middleware/errorHandler
 * @description Captura y formatea los errores detectados en la plataforma, y las rutas no encontradas.
 * @author MeteoMap Team
 */

const logger = require("../config/logger");

// Si una petición llega hasta aquí abajo sin ser contestada, es que la ruta no existe
function notFound(req, res, next) {
  res.status(404).json({ error: "No encontrado", message: `Ruta ${req.method} ${req.url} not found` });
}


// Express sabe que esto es un manejador de errores únicamente porque tiene 4 parámetros (err, req, res, next)
// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  const status = err.status || err.statusCode || 500;
  const message = err.message || "Error Interno del Servidor";

  // Solo loguear como error los 500s (errores internos del servidor)
  // Los 4xx se loguean en el HTTP logger (warn)
  if (status >= 500) {
    logger.error("Error no manejado", {
      status,
      message,
      stack: err.stack,
      method: req.method,
      url: req.url,
    });
  }

  // Responde al usuario que hizo la petición
  res.status(status).json({
    error: status === 500 ? "Error Interno del Servidor" : (err.name !== "Error" ? err.name : "Petición Incorrecta"),
    message: process.env.NODE_ENV === "production" && status === 500
      ? "Algo salió mal"
      : message,
  });
}

module.exports = { notFound, errorHandler };