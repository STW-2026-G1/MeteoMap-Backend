/**
 * @file Controlador de usuarios
 * @module controllers/UserController
 * @description Maneja las solicitudes HTTP relacionadas con perfiles de usuario y mapea hacia los servicios correspondientes.
 * Gestiona obtención de perfil, actualización de datos, favoritos, y eliminación de cuenta.
 */

const userService = require("../services/userService");

class UserController {
  /**
   * Obtiene el perfil público de un usuario por su ID
   * @async
   * @param {Object} req - Objeto de solicitud HTTP
   * @param {string} req.params.userId - ID del usuario
   * @param {Object} res - Objeto de respuesta HTTP
   * @param {Function} next - Función middleware para pasar al siguiente controlador
   * @returns {Object} Datos del perfil del usuario
   */
  async getProfile(req, res, next) {
    try {
      const { userId } = req.params;
      const profile = await userService.getProfile(userId);
      res.json(profile);
    } catch (err) {
      next(err);
    }
  }

  /**
   * Obtiene el perfil del usuario autenticado
   * @async
   * @param {Object} req - Objeto de solicitud HTTP con usuario autenticado en req.user
   * @param {string} req.user.userId - ID del usuario autenticado (del token JWT)
   * @param {Object} res - Objeto de respuesta HTTP
   * @param {Function} next - Función middleware para pasar al siguiente controlador
   * @returns {Object} Datos del perfil del usuario actual
   */
  async getMyProfile(req, res, next) {
    try {
      const userId = req.user.userId; // Asumiendo que isAuth agregó req.user
      const profile = await userService.getProfile(userId);
      res.json(profile);
    } catch (err) {
      next(err);
    }
  }

  /**
   * Añade o quita una zona de los favoritos del usuario autenticado
   * @async
   * @param {Object} req - Objeto de solicitud HTTP con usuario autenticado en req.user
   * @param {string} req.user.userId - ID del usuario autenticado (del token JWT)
   * @param {string} req.body.zonaId - ID de la zona a agregar/quitar de favoritos
   * @param {string} req.body.accion - Acción a realizar: "agregar" o "quitar"
   * @param {Object} res - Objeto de respuesta HTTP
   * @param {Function} next - Función middleware para pasar al siguiente controlador
   * @returns {Object} Resultado de la operación con preferencias actualizadas
   */
  async updateFavorites(req, res, next) {
    try {
      const userId = req.user.userId; // Del token
      const { zonaId, accion } = req.body;
      
      const result = await userService.updateFavorites(
        userId,
        zonaId,
        accion
      );
      
      res.json(result);
    } catch (err) {
      next(err);
    }
  }
  /**
   * Obtiene las zonas favoritas del usuario autenticado
   * @async
   * @param {Object} req - Objeto de solicitud HTTP con usuario autenticado en req.user
   * @param {string} req.user.userId - ID del usuario autenticado (del token JWT)
   * @param {Object} res - Objeto de respuesta HTTP
   * @param {Function} next - Función middleware para pasar al siguiente controlador
   * @returns {Object} Objeto con array de zonas favoritas en preferencias
   */
  async getFavorites(req, res, next) {
    try {
      const userId = req.user.userId;
      const user = await userService.getProfile(userId);
      res.json({ preferencias: user.preferencias });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Elimina la cuenta del usuario autenticado
   * @async
   * @param {Object} req - Objeto de solicitud HTTP con usuario autenticado en req.user
   * @param {string} req.user.userId - ID del usuario autenticado (del token JWT)
   * @param {Object} res - Objeto de respuesta HTTP
   * @param {Function} next - Función middleware para pasar al siguiente controlador
   * @returns {Object} Resultado de la eliminación
   */
  async deleteUser(req, res, next) {
    try {
      const userId = req.user.userId;
      const result = await userService.deleteUser(userId);
      res.json(result);
    } catch (err) {
      next(err);
    }
  }

  /**
   * Actualiza los datos de perfil del usuario autenticado
   * @async
   * @param {Object} req - Objeto de solicitud HTTP con usuario autenticado en req.user
   * @param {string} req.user.userId - ID del usuario autenticado (del token JWT)
   * @param {string} req.body.nombre - Nombre del usuario
   * @param {string} req.body.email - Correo electrónico
   * @param {string} req.body.biografia - Biografía del usuario
   * @param {string} req.body.ubicacion - Ubicación geográfica
   * @param {string} req.body.avatar_style - Estilo del avatar
   * @param {Object} res - Objeto de respuesta HTTP
   * @param {Function} next - Función middleware para pasar al siguiente controlador
   * @returns {Object} Datos del usuario actualizado
   */
  async updateUser(req, res, next) {
    try {
      const userId = req.user.userId;
      console.log("updateUser - userId:", userId);
      const { nombre, email, biografia, ubicacion, avatar_style } = req.body;

      const updateData = {
        nombre,
        email,
        biografia,
        ubicacion,
        avatar_style,
      };

      if (nombre) {
        updateData.avatar_seed = nombre;
      }

      const result = await userService.updateUser(userId, updateData);

      res.json(result);
    } catch (err) {
      next(err);
    }
  }

  /**
   * Actualiza la contraseña del usuario autenticado
   * @async
   * @param {Object} req - Objeto de solicitud HTTP con usuario autenticado en req.user
   * @param {string} req.user.userId - ID del usuario autenticado (del token JWT)
   * @param {string} req.body.currentPassword - Contraseña actual
   * @param {string} req.body.newPassword - Nueva contraseña
   * @param {Object} res - Objeto de respuesta HTTP
   * @param {Function} next - Función middleware para pasar al siguiente controlador
   * @returns {Object} Resultado de la actualización
   */
  async updatePassword(req, res, next) {
    try {
      const userId = req.user.userId;
      const { currentPassword, newPassword } = req.body;

      const result = await userService.updatePassword(
        userId,
        currentPassword,
        newPassword
      );

      res.json(result);
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new UserController();
