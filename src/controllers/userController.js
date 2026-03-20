const userService = require("../services/userService");
const logger = require("../config/logger");

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
   * PUT /api/user/favorites
   */
  async updateFavorites(req, res, next) {
    try {
      const { userId, zonaId, accion, configuracion } = req.body;
      const result = await userService.updateFavorites(userId, zonaId, accion, configuracion);
      res.json(result);
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
}

module.exports = new UserController();
