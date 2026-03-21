const logger = require("./logger");

/**
 * Configuración centralizada de JWT
 * Asegura que los secretos y expiración sean consistentes en toda la aplicación
 */
const JWT_CONFIG = {
  // Access Token: corta duración (15 minutos)
  ACCESS_TOKEN: {
    secret: process.env.JWT_ACCESS_TOKEN_SECRET,
    expiresIn: "15m",
    algorithm: "HS256",
  },

  // Refresh Token: larga duración (7 días)
  REFRESH_TOKEN: {
    secret: process.env.JWT_REFRESH_TOKEN_SECRET,
    expiresIn: "7d",
    algorithm: "HS256",
  },
};

// Validar que los secretos estén configurados
function validateJwtConfig() {
  const missingSecrets = [];

  if (!JWT_CONFIG.ACCESS_TOKEN.secret) {
    missingSecrets.push("JWT_ACCESS_TOKEN_SECRET");
  }

  if (!JWT_CONFIG.REFRESH_TOKEN.secret) {
    missingSecrets.push("JWT_REFRESH_TOKEN_SECRET");
  }

  if (missingSecrets.length > 0) {
    const message = `Variables de entorno faltantes: ${missingSecrets.join(", ")}`;
    logger.error(message);
    throw new Error(message);
  }

  // Validar longitud mínima de secretos (recomendación: al menos 32 caracteres)
  if (JWT_CONFIG.ACCESS_TOKEN.secret.length < 32) {
    logger.warn("JWT_ACCESS_TOKEN_SECRET es muy corto. Usar al menos 32 caracteres.");
  }

  if (JWT_CONFIG.REFRESH_TOKEN.secret.length < 32) {
    logger.warn("JWT_REFRESH_TOKEN_SECRET es muy corto. Usar al menos 32 caracteres.");
  }

  logger.info("JWT configuration validated successfully");
}

// Ejecutar validación al cargar el módulo
validateJwtConfig();

module.exports = JWT_CONFIG;
