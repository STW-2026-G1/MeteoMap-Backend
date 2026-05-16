/**
 * @file Servicio de Administración
 * @module services/adminService
 * @description Implementa la lógica de negocio para funciones administrativas:
 * - Gestión de usuarios (obtener, actualizar, eliminar, restaurar)
 * - Dashboard del sistema con estadísticas
 * - Monitoreo del estado de APIs y servicios
 * - Tracking de uso de IA y métricas del sistema
 * - Serialización y validación de datos
 */

const User = require("../models/User");
const logger = require("../config/logger");
const SystemMetric = require("../models/SystemMetric");
const AemetAlert = require("../models/AemetAlert");

class AdminService {
  formatElapsedTime(dateValue) {
    const timestamp = new Date(dateValue).getTime();
    if (Number.isNaN(timestamp)) return null;

    const elapsedMs = Date.now() - timestamp;
    const elapsedMinutes = Math.max(1, Math.round(elapsedMs / (60 * 1000)));

    if (elapsedMinutes < 60) {
      return `hace ${elapsedMinutes} min`;
    }

    const elapsedHours = Math.round(elapsedMinutes / 60);
    if (elapsedHours < 24) {
      return `hace ${elapsedHours} h`;
    }

    const elapsedDays = Math.round(elapsedHours / 24);
    return `hace ${elapsedDays} d`;
  }

  /**
   * Serializar usuario para respuestas API
   * @param {object} user - Documento de usuario de MongoDB
   * @returns {object} Objeto serializado del usuario
   */
  serializeUser(user) {
    const plainUser = user.toObject({ virtuals: true });
    
    return {
      id: plainUser._id.toString(),
      email: plainUser.datos_acceso?.email,
      nombre: plainUser.perfil?.nombre || "",
      avatar_style: plainUser.perfil?.avatar_style || "avataaars",
      avatar_seed: plainUser.perfil?.avatar_seed || plainUser.perfil?.nombre || plainUser._id.toString(),
      avatar_url: plainUser.perfil?.avatar_url,
      estado: plainUser.estado,
      rol: plainUser.datos_acceso?.rol,
      provider: plainUser.datos_acceso?.provider,
      biografia: plainUser.perfil?.biografia || "",
      ubicacion: plainUser.perfil?.ubicacion || "",
      createdAt: plainUser.createdAt,
      updatedAt: plainUser.updatedAt,
      fechaEliminacion: plainUser.fechaEliminacion,
    };
  }

  /**
   * Obtener lista de usuarios (sin administradores)
   * @returns {object} Conteo total y array de usuarios
   */
  async getUsers() {
    try {
      const users = await User.find({
        "datos_acceso.rol": { $ne: "ADMIN" },
      }).sort({ createdAt: -1 });

      return {
        total: users.length,
        users: users.map((user) => this.serializeUser(user)),
      };
    } catch (err) {
      logger.error(`Error en adminService.getUsers: ${err.message}`);
      throw err;
    }
  }

  /**
   * Actualizar usuario desde panel de administración
   * @param {string} userId - ID del usuario
   * @param {object} updateData - Datos a actualizar (nombre, email, estado, biografia, ubicacion, avatar_style)
   * @returns {object} Mensaje y usuario actualizado
   */
  async updateUser(userId, updateData) {
    try {
      const user = await User.findById(userId);
      if (!user) {
        const error = new Error("Usuario no encontrado");
        error.status = 404;
        throw error;
      }

      if (user.datos_acceso?.rol === "ADMIN") {
        const error = new Error("No se puede editar un usuario administrador");
        error.status = 403;
        throw error;
      }

      // Solo permitir editar usuarios ACTIVO
      if (user.estado === "ELIMINADO") {
        const error = new Error("No se puede editar un usuario eliminado");
        error.status = 400;
        throw error;
      }

      const { nombre, email, estado, biografia, ubicacion, avatar_style } = updateData;

      if (email && email !== user.datos_acceso.email) {
        const existingUser = await User.findOne({
          "datos_acceso.email": email,
          _id: { $ne: user._id },
          estado: "ACTIVO",
        });

        if (existingUser) {
          const error = new Error("El email ya está registrado");
          error.status = 400;
          throw error;
        }

        user.datos_acceso.email = email;
      }

      if (nombre !== undefined) {
        user.perfil.nombre = nombre;
        user.perfil.avatar_seed = nombre;
      }

      // Solo permitir estado ACTIVO en edición (no se puede forzar ELIMINADO aquí)
      if (estado !== undefined && estado === "ACTIVO") {
        user.estado = estado;
      }

      if (biografia !== undefined) {
        user.perfil.biografia = biografia;
      }

      if (ubicacion !== undefined) {
        user.perfil.ubicacion = ubicacion;
      }

      if (avatar_style !== undefined) {
        user.perfil.avatar_style = avatar_style;
      }

      await user.save();

      logger.info(`Usuario actualizado desde admin: ${userId}`);

      return {
        message: "Usuario actualizado correctamente",
        user: this.serializeUser(user),
      };
    } catch (err) {
      logger.error(`Error en adminService.updateUser: ${err.message}`);
      throw err;
    }
  }

  /**
   * Eliminar usuario desde panel de administración
   * @param {string} userId - ID del usuario
   * @returns {object} Mensaje de confirmación
   */
  async deleteUser(userId) {
    try {
      const user = await User.findById(userId);
      if (!user) {
        const error = new Error("Usuario no encontrado");
        error.status = 404;
        throw error;
      }

      if (user.datos_acceso?.rol === "ADMIN") {
        const error = new Error("No se puede eliminar un usuario administrador");
        error.status = 403;
        throw error;
      }

      if (user.estado === "ELIMINADO") {
        const error = new Error("El usuario ya estaba eliminado");
        error.status = 400;
        throw error;
      }

      user.estado = "ELIMINADO";
      user.fechaEliminacion = new Date();
      await user.save();

      logger.warn(`Usuario eliminado desde admin: ${userId} (${user.datos_acceso.email})`);

      return {
        message: "Usuario eliminado correctamente",
        userId,
      };
    } catch (err) {
      logger.error(`Error en adminService.deleteUser: ${err.message}`);
      throw err;
    }
  }

  /**
   * Restaurar usuario eliminado
   * @param {string} userId - ID del usuario
   * @returns {object} Mensaje y usuario restaurado
   */
  async restoreUser(userId) {
    try {
      const user = await User.findById(userId);
      if (!user) {
        const error = new Error("Usuario no encontrado");
        error.status = 404;
        throw error;
      }

      if (user.datos_acceso?.rol === "ADMIN") {
        const error = new Error("No se puede restaurar un usuario administrador");
        error.status = 403;
        throw error;
      }

      if (user.estado !== "ELIMINADO") {
        const error = new Error("El usuario no está eliminado");
        error.status = 400;
        throw error;
      }

      user.estado = "ACTIVO";
      user.fechaEliminacion = null;
      await user.save();

      logger.info(`Usuario restaurado desde admin: ${userId} (${user.datos_acceso.email})`);

      return {
        message: "Usuario restaurado correctamente",
        user: this.serializeUser(user),
      };
    } catch (err) {
      logger.error(`Error en adminService.restoreUser: ${err.message}`);
      throw err;
    }
  }

  /**
   * Obtener dashboard del sistema con estadísticas y estado de servicios
   * @returns {object} Dashboard completo con usuario, IA, weatherSync y apiStatus
   */
  async getDashboard() {
    try {
      const [users, latestMetric, latency24h, aemetLatestAlert, latestWeatherZone] = await Promise.all([
        User.find({ "datos_acceso.rol": { $ne: "ADMIN" } }).lean(),
        SystemMetric.findOne({ origen: "API_METEO" }).sort({ createdAt: -1 }).lean(),
        SystemMetric.find({
          origen: "API_METEO",
          tipo: "LATENCIA",
          createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
        })
          .sort({ createdAt: 1 })
          .lean(),
        AemetAlert.findOne().sort({ updatedAt: -1 }).lean(),
        require("../models/Zone")
          .findOne({ "cache_meteo.current.ultima_actualizacion": { $exists: true, $ne: null } })
          .sort({ "cache_meteo.current.ultima_actualizacion": -1 })
          .lean(),
      ]);

      const activosNoAdmin = users.filter((u) => u.estado === "ACTIVO").length;
      const eliminadosNoAdmin = users.filter((u) => u.estado === "ELIMINADO").length;

      const iaUsageByUser = users
        .map((u) => ({
          id: u._id.toString(),
          nombre: u.perfil?.nombre || "Sin nombre",
          email: u.datos_acceso?.email || "",
          peticionesHoy: u.limites_ia?.peticiones_hoy || 0,
          estado: u.estado,
        }))
        .sort((a, b) => b.peticionesHoy - a.peticionesHoy);

      const totalPeticionesHoy = iaUsageByUser.reduce((sum, u) => sum + u.peticionesHoy, 0);

      const latestLatencyMetric = [...latency24h].reverse()[0] || null;

      const mistralConfigured = Boolean(process.env.MISTRAL_API_KEY);
      const aemetConfigured = Boolean(process.env.AEMET_API_KEY);
      const emailRecoveryConfigured = Boolean(process.env.EMAIL_USER) && Boolean(process.env.EMAIL_PASSWORD);
      const googleOauthConfigured = Boolean(process.env.GOOGLE_CLIENT_ID);

      const now = Date.now();
      const latestMetricAgeMs = latestMetric ? now - new Date(latestMetric.createdAt).getTime() : null;

      const latestWeatherUpdateAt = latestWeatherZone?.cache_meteo?.current?.ultima_actualizacion || null;
      const latestWeatherUpdateAgeMs = latestWeatherUpdateAt
        ? now - new Date(latestWeatherUpdateAt).getTime()
        : null;
      const localWeatherRecent =
        typeof latestWeatherUpdateAgeMs === "number" && latestWeatherUpdateAgeMs <= 6 * 60 * 60 * 1000;

      const openMeteoStatus = !latestWeatherUpdateAt
        ? "warning"
        : localWeatherRecent
          ? "online"
          : "warning";

      const aemetAgeMs = aemetLatestAlert ? now - new Date(aemetLatestAlert.updatedAt).getTime() : null;
      const aemetRecent = typeof aemetAgeMs === "number" && aemetAgeMs <= 24 * 60 * 60 * 1000;
      const aemetStatus = !aemetConfigured ? "warning" : aemetRecent ? "online" : "warning";
      const openMeteoStatusLabel = !latestWeatherUpdateAt
        ? "Sin datos"
        : localWeatherRecent
          ? "Activo"
          : "Desactualizado";
      const aemetStatusLabel = !aemetConfigured ? "Sin configuración" : aemetStatus === "online" ? "Activo" : "Pendiente";
      const latestMetricAgeLabel = latestMetric ? this.formatElapsedTime(latestMetric.createdAt) : null;
      const latestWeatherUpdateAgeLabel = latestWeatherUpdateAt ? this.formatElapsedTime(latestWeatherUpdateAt) : null;
      const latestAlertAgeLabel = aemetLatestAlert ? this.formatElapsedTime(aemetLatestAlert.updatedAt) : null;

      return {
        generatedAt: new Date().toISOString(),
        users: {
          totalNoAdmin: users.length,
          activosNoAdmin,
          eliminadosNoAdmin,
        },
        ia: {
          totalPeticionesHoy,
          usageByUser: iaUsageByUser,
        },
        weatherSync: {
          latestMetricType: latestMetric?.tipo || null,
          latestMetricAt: latestMetric?.createdAt || null,
          latestLatencyMs: latestLatencyMetric?.valor ?? null,
          latencySeries24h: latency24h.map((m) => ({
            timestamp: m.createdAt,
            value: m.valor,
          })),
        },
        apiStatus: [
          {
            name: "Backend API",
            status: "online",
            source: "GET /health",
            details: "Servicio Express en ejecución",
          },
          {
            name: "Mistral IA",
            status: mistralConfigured ? "online" : "warning",
            source: "MISTRAL_API_KEY",
            details: mistralConfigured
              ? "Clave configurada en servidor"
              : "Clave no configurada (chat en modo degradado)",
          },
          {
            name: "Email recuperación",
            status: emailRecoveryConfigured ? "online" : "warning",
            source: "EMAIL_USER + EMAIL_PASSWORD",
            details: emailRecoveryConfigured
              ? "SMTP configurado para forgot/reset password"
              : "Falta configuración SMTP para recuperación",
          },
          {
            name: "Google OAuth",
            status: googleOauthConfigured ? "online" : "warning",
            source: "GOOGLE_CLIENT_ID",
            details: googleOauthConfigured
              ? "Login Google habilitado"
              : "Google OAuth no configurado",
          },
          {
            name: "Open-Meteo",
            status: openMeteoStatus,
            statusLabel: openMeteoStatusLabel,
            source: "cache_meteo.current.ultima_actualizacion",
            details: latestWeatherUpdateAt
              ? `Última actualización local ${latestWeatherUpdateAgeLabel || "hace poco"}`
              : latestMetric
                ? latestMetric.tipo === "ERROR"
                  ? `La última sincronización falló ${latestMetricAgeLabel || "hace poco"}`
                  : `Última sincronización ${latestMetricAgeLabel || "hace poco"}`
                : "Aún no se ha sincronizado",
          },
          {
            name: "AEMET Alerts",
            status: aemetStatus,
            statusLabel: aemetStatusLabel,
            source: "AEMET_API_KEY + última alerta persistida",
            details: !aemetConfigured
              ? "Falta configurar AEMET_API_KEY"
              : aemetLatestAlert
                ? `Última alerta ${latestAlertAgeLabel || "hace poco"}`
                : "Sin alertas persistidas aún",
          },
        ],
      };
    } catch (err) {
      logger.error(`Error en adminService.getDashboard: ${err.message}`);
      throw err;
    }
  }
}

module.exports = new AdminService();