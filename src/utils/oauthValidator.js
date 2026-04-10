const logger = require("../config/logger");

/**
 * Validador de tokens OAuth2 de Google
 * En producción, usa google-auth-library para validación real
 * Por ahora, proporciona estructura para integración
 */

/**
 * Decodifica y valida un ID Token de Google
 * Requiere instalación: npm install google-auth-library
 *
 * @param {string} idToken - Token ID de Google
 * @param {string} clientId - Google Client ID
 * @returns {object} Payload del token decodificado
 */
async function verifyGoogleToken(idToken, clientId) {
  try {
    // OPCIÓN 1: Usar google-auth-library (recomendado para producción)
    // Descomenta y instala: npm install google-auth-library
    /*
    const { OAuth2Client } = require("google-auth-library");
    const client = new OAuth2Client(clientId);
    const ticket = await client.verifyIdToken({
      idToken,
      audience: clientId,
    });
    return ticket.getPayload();
    */

    // OPCIÓN 2: Validación simple (para desarrollo/testing)
    // Decodifica el token sin validar firma (NO usar en producción)
    const parts = idToken.split(".");
    if (parts.length !== 3) {
      throw new Error("Token inválido: formato incorrecto");
    }

    const payload = JSON.parse(
      Buffer.from(parts[1], "base64").toString("utf-8")
    );

    // Validaciones básicas
    if (!payload.email) {
      throw new Error("Token sin email");
    }

    if (payload.aud !== clientId) {
      logger.warn(
        `Audience mismatch: esperado ${clientId}, recibido ${payload.aud}`
      );
    }

    // Validar no expirado
    if (payload.exp && payload.exp * 1000 < Date.now()) {
      throw new Error("Token expirado");
    }

    return payload;
  } catch (err) {
    logger.error(`Error verificando token de Google: ${err.message}`);
    throw err;
  }
}

module.exports = {
  verifyGoogleToken,
};
