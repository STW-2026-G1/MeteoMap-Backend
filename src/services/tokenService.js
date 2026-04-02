const jwt = require("jsonwebtoken");
const logger = require("../config/logger");
const JWT_CONFIG = require("../config/jwt");

/**
 * Servicio para generar y verificar tokens JWT
 */
class TokenService {
  /**
   * Genera un Access Token
   * @param {Object} payload - Datos a incluir en el token (ej: { userId, email, rol })
   * @returns {string} accessToken
   */
  generateTokenPair(payload) {
    try {
      // Validar que el algoritmo "none" NO se use
      const algorithm = JWT_CONFIG.ACCESS_TOKEN.algorithm;
      if (algorithm === "none") {
        throw new Error('Algorithm "none" is not permitted for security reasons');
      }

      // Crear payload seguro (sin datos sensibles)
      const cleanPayload = {
        userId: payload.userId,
        email: payload.email,
        rol: payload.rol,
      };

      // Generar Access Token (sin límite de tiempo)
      const accessToken = jwt.sign(cleanPayload, JWT_CONFIG.ACCESS_TOKEN.secret, {
        algorithm: JWT_CONFIG.ACCESS_TOKEN.algorithm,
      });

      logger.debug(`Access token generated for user: ${cleanPayload.userId}`);

      return accessToken;
    } catch (err) {
      logger.error("Error generating access token", { error: err.message });
      throw err;
    }
  }

  /**
   * Verifica y decodifica un Access Token
   * @param {string} token - El token a verificar
   * @returns {Object} El payload decodificado
   * @throws {Error} Si el token es inválido o ha expirado
   */
  verifyAccessToken(token) {
    try {
      // Decoficar el token
      const decoded = jwt.verify(token, JWT_CONFIG.ACCESS_TOKEN.secret, {
        algorithms: [JWT_CONFIG.ACCESS_TOKEN.algorithm],
      });

      if (!decoded) {
        throw new Error("Invalid token");
      }

      return decoded;
    } catch (err) {
      logger.debug(`Access token verification failed: ${err.message}`);
      throw err;
    }
  }


}

module.exports = new TokenService();
