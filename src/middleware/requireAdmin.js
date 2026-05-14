const logger = require("../config/logger");
const User = require("../models/User");

async function requireAdmin(req, res, next) {
  try {
    if (!req.user?.userId) {
      return res.status(401).json({
        error: "Acceso denegado. No se encontró usuario autenticado.",
      });
    }

    const user = await User.findById(req.user.userId).select("datos_acceso.rol estado");

    if (!user) {
      return res.status(401).json({
        error: "Usuario no encontrado.",
      });
    }

    if (user.estado !== "ACTIVO") {
      return res.status(403).json({
        error: "La cuenta no está activa.",
      });
    }

    if (user.datos_acceso?.rol !== "ADMIN") {
      logger.warn("Intento de acceso admin sin permisos", {
        userId: req.user.userId,
        email: req.user.email,
      });

      return res.status(403).json({
        error: "Acceso denegado. Se requieren permisos de administrador.",
      });
    }

    req.adminUser = user;
    next();
  } catch (err) {
    logger.error("Error validando permisos de administrador", { error: err.message });
    res.status(500).json({ error: "No se pudo validar el acceso de administrador." });
  }
}

module.exports = requireAdmin;