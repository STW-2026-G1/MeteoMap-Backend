/**
 * @file Logger del sistema
 * @module config/logger
 * @description Define la configuración de Winston para el registro de eventos, errores y peticiones en la aplicación.
 * @author MeteoMap Team
 */

const { createLogger, format, transports } = require("winston");
const path = require("path");

const { combine, timestamp, printf, colorize, errors, splat, json } = format;
const useFileTransports = !process.env.VERCEL;

// Formato visual y limpio
const devFormat = printf(({ level, message, timestamp, stack, ...meta }) => {
  // Filtrar propiedades internas de winston que no queremos en el JSON de meta
  const metaFiltered = { ...meta };
  delete metaFiltered[Symbol.for('level')];
  delete metaFiltered[Symbol.for('message')];
  delete metaFiltered[Symbol.for('splat')];

  const metaStr = Object.keys(metaFiltered).length ? ` ${JSON.stringify(metaFiltered)}` : "";
  return `${timestamp} [${level}]: ${stack || message}${metaStr}`;
});

const logger = createLogger({
  level: process.env.LOG_LEVEL || "info", 
  format: combine(
    errors({ stack: true }), 
    timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
    splat()
  ),
  
  transports: [
    new transports.Console({
      format:
        process.env.NODE_ENV === "production"
          ? combine(json())
          : combine(colorize(), devFormat),
    }),
    ...(useFileTransports
      ? [
          // Guarda un registro permanente en la carpeta "logs"
          new transports.File({
            filename: path.join("logs", "error.log"),
            level: "error",
            format: combine(json()),
          }),
          new transports.File({
            filename: path.join("logs", "combined.log"),
            format: combine(json()),
          }),
        ]
      : []),
  ],
});

module.exports = logger;