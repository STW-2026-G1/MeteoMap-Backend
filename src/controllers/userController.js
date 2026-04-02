const userService = require("../services/userService");

class UserController {
  /**
   * GET /api/user/profile/:userId
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
   * GET /api/user/me
   * Obtener el perfil del usuario autenticado
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
   * PUT /api/user/me/favorites
   * Añadir o quitar zona favorita del usuario autenticado
   */
  async updateFavorites(req, res, next) {
    try {
      const userId = req.user.userId; // Del token
      const { zonaId, accion, configuracion_alertas, metodo_notificacion } = req.body;
      
      const result = await userService.updateFavorites(
        userId,
        zonaId,
        accion,
        configuracion_alertas,
        metodo_notificacion
      );
      
      res.json(result);
    } catch (err) {
      next(err);
    }
  }
  /**
   * GET /api/user/me/favorites
   * Obtener las zonas favoritas del usuario autenticado
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
   * PATCH /api/user/alerts/:userId/:zoneId
   */
  async updateAlertConfig(req, res, next) {
    try {
      const { userId, zoneId } = req.params;
      const { configuracion_alertas } = req.body;

      const result = await userService.updateAlertConfig(userId, zoneId, configuracion_alertas);
      res.json({
        message: "Configuración de alertas actualizada",
        config: result,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * DELETE /api/user/delete
   * Eliminar usuario autenticado
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
   * PUT /api/user/update
   * Actualizar perfil del usuario autenticado
   */
  async updateUser(req, res, next) {
    try {
      const userId = req.user.userId;
      const { nombre, email, avatar_url, biografia, ubicacion } = req.body;

      const result = await userService.updateUser(userId, {
        nombre,
        email,
        avatar_url,
        biografia,
        ubicacion,
      });

      res.json(result);
    } catch (err) {
      next(err);
    }
  }

  /**
   * PUT /api/user/updatepassword
   * Actualizar contraseña del usuario autenticado
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
