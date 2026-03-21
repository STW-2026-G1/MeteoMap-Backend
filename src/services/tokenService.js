const jwt = require("jsonwebtoken");
const logger = require("../config/logger");
const JWT_CONFIG = require("../config/jwt");

/**
 * Servicio para generar y verificar tokens JWT
 */
class TokenService {
  /**
   * Genera un par de tokens (Access Token + Refresh Token)
   * @param {Object} payload - Datos a incluir en el token (ej: { userId, email, rol })
   * @returns {Object} { accessToken, refreshToken }
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

      // Generar Access Token (corta duración)
      const accessToken = jwt.sign(cleanPayload, JWT_CONFIG.ACCESS_TOKEN.secret, {
        expiresIn: JWT_CONFIG.ACCESS_TOKEN.expiresIn,
        algorithm: JWT_CONFIG.ACCESS_TOKEN.algorithm,
      });

      // Generar Refresh Token (larga duración)
      const refreshToken = jwt.sign(
        { userId: payload.userId },
        JWT_CONFIG.REFRESH_TOKEN.secret,
        {
          expiresIn: JWT_CONFIG.REFRESH_TOKEN.expiresIn,
          algorithm: JWT_CONFIG.REFRESH_TOKEN.algorithm,
        }
      );

      logger.debug(`Tokens generated for user: ${cleanPayload.userId}`);

      return {
        accessToken,
        refreshToken,
      };
    } catch (err) {
      logger.error("Error generating token pair", { error: err.message });
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
      // Rechazar explícitamente algoritmo "none"
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

  /**
   * Verifica y decodifica un Refresh Token
   * @param {string} token - El token a verificar
   * @returns {Object} El payload decodificado
   * @throws {Error} Si el token es inválido o ha expirado
   */
  verifyRefreshToken(token) {
    try {
      // Rechazar explícitamente algoritmo "none"
      const decoded = jwt.verify(token, JWT_CONFIG.REFRESH_TOKEN.secret, {
        algorithms: [JWT_CONFIG.REFRESH_TOKEN.algorithm],
      });

      if (!decoded) {
        throw new Error("Invalid refresh token");
      }

      return decoded;
    } catch (err) {
      logger.debug(`Refresh token verification failed: ${err.message}`);
      throw err;
    }
  }

  /**
   * Genera un nuevo Access Token a partir de un Refresh Token válido
   * @param {string} refreshToken - El Refresh Token
   * @returns {string} Un nuevo Access Token
   */
  generateNewAccessToken(refreshToken) {
    try {
      const decoded = this.verifyRefreshToken(refreshToken);

      // Para generar un nuevo access token, necesitamos obtener datos adicionales del usuario
      // En esta implementación, solo incluimos el userId
      // El cliente u otra capa debe proporcionar el email y rol si es necesario
      const newAccessToken = jwt.sign(
        { userId: decoded.userId },
        JWT_CONFIG.ACCESS_TOKEN.secret,
        {
          expiresIn: JWT_CONFIG.ACCESS_TOKEN.expiresIn,
          algorithm: JWT_CONFIG.ACCESS_TOKEN.algorithm,
        }
      );

      logger.debug(`New access token generated for user: ${decoded.userId}`);

      return newAccessToken;
    } catch (err) {
      logger.debug(`Error generating new access token: ${err.message}`);
      throw err;
    }
  }
}

module.exports = new TokenService();
