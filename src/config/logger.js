const { createLogger, format, transports } = require("winston");
const path = require("path");

const { combine, timestamp, printf, colorize, errors, splat, json } = format;

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
    
    // Guarda un registro permanente en la carpeta "logs"
    new transports.File({
      filename: path.join("logs", "error.log"),
      level: "error", // Archivo exclusivo para errores graves
      format: combine(json()),
    }),
    new transports.File({
      filename: path.join("logs", "combined.log"),
      format: combine(json()), // Archivo general con absolutamente todo el historial
    }),
  ],
});

module.exports = logger;