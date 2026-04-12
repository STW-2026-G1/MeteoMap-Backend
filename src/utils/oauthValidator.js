const { OAuth2Client } = require("google-auth-library");
const logger = require("../config/logger");

/**
 * Validador de tokens OAuth2 de Google
 * Usa google-auth-library para validación real
 */

/**
 * Decodifica y valida un ID Token de Google
 *
 * @param {string} idToken - Token ID de Google
 * @param {string} clientId - Google Client ID
 * @returns {object} Payload del token decodificado
 */
async function verifyGoogleToken(idToken, clientId) {
  try {
    const client = new OAuth2Client(clientId);
    const ticket = await client.verifyIdToken({
      idToken,
      audience: clientId,
    });
    return ticket.getPayload();
  } catch (err) {
    logger.error(`Error verificando token de Google: ${err.message}`);
    throw err;
  }
}

module.exports = {
  verifyGoogleToken,
};
