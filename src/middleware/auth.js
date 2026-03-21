const logger = require("../config/logger");
const tokenService = require("../services/tokenService");

/**
 * Middleware isAuth - Verifica el Access Token en la cabecera Authorization
 * 
 * Uso:
 *   router.get('/protected-route', isAuth, controllerMethod);
 * 
 * Espera:
 *   Authorization: Bearer <accessToken>
 * 
 * Inyecta en req.user:
 *   {
 *     userId: string,
 *     email: string,
 *     rol: string
 *   }
 */
function isAuth(req, res, next) {
  try {
    // Obtener la cabecera Authorization
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      logger.warn("Falta la cabecera de autorización", { ip: req.ip });
      return res.status(401).json({
        error: "Acceso denegado. No se encontró token.",
      });
    }

    // Extraer el token del formato "Bearer <token>"
    const parts = authHeader.split(" ");

    if (parts.length !== 2 || parts[0].toLowerCase() !== "bearer") {
      logger.warn("Formato de cabecera de autorización inválido", { ip: req.ip });
      return res.status(401).json({
        error: "Formato de Authorization inválido. Use: Bearer <token>",
      });
    }

    const token = parts[1];

    // Verificar que el token no sea vacío
    if (!token) {
      logger.warn("Se proporcionó un token vacío.", { ip: req.ip });
      return res.status(401).json({
        error: "Token vacío.",
      });
    }

    // Verificar el token
    const decoded = tokenService.verifyAccessToken(token);

    // Inyectar los datos del usuario en req.user
    req.user = {
      userId: decoded.userId,
      email: decoded.email,
      rol: decoded.rol,
    };

    logger.debug(`Usuario autenticado: ${decoded.userId}`);
    next();
  } catch (err) {
    // Manejo específico de errores JWT
    if (err.name === "TokenExpiredError") {
      logger.warn("Token expirado", { ip: req.ip });
      return res.status(401).json({
        error: "Token expirado. Por favor, refresca tu sesión.",
      });
    }

    if (err.name === "JsonWebTokenError") {
      logger.warn("Token inválido", { ip: req.ip, message: err.message });
      return res.status(401).json({
        error: "Token inválido.",
      });
    }

    logger.error("Error de autenticación", { error: err.message, ip: req.ip });
    res.status(403).json({ error: "Acceso denegado." });
  }
}

module.exports = isAuth;
