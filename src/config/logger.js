const { createLogger, format, transports } = require("winston");
const path = require("path");

const { combine, timestamp, printf, colorize, errors, json } = format;

// Formato visual y limpio exclusivo para cuando estás programando en tu equipo local
const devFormat = printf(({ level, message, timestamp, stack, ...meta }) => {
  const metaStr = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : "";
  return `${timestamp} [${level}]: ${stack || message}${metaStr}`;
});

const logger = createLogger({
  // Nivel mínimo de mensajes que va a registrar
  level: process.env.LOG_LEVEL || "info", 
  // Siempre incluye la fecha/hora y el error exacto si la app crashea
  format: combine(errors({ stack: true }), timestamp({ format: "YYYY-MM-DD HH:mm:ss" })),
  
  transports: [
    // En producción escupe JSON, en local usa texto con colores
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