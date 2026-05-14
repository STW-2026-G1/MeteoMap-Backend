const adminService = require("../services/adminService");
const reportService = require("../services/reportService");

class AdminController {
  async getUsers(req, res, next) {
    try {
      const result = await adminService.getUsers();
      res.json(result);
    } catch (err) {
      next(err);
    }
  }

  async updateUser(req, res, next) {
    try {
      const { id } = req.params;
      const result = await adminService.updateUser(id, req.body);
      res.json(result);
    } catch (err) {
      next(err);
    }
  }

  async deleteUser(req, res, next) {
    try {
      const { id } = req.params;
      const result = await adminService.deleteUser(id);
      res.json(result);
    } catch (err) {
      next(err);
    }
  }

  async restoreUser(req, res, next) {
    try {
      const { id } = req.params;
      const result = await adminService.restoreUser(id);
      res.json(result);
    } catch (err) {
      next(err);
    }
  }

  async deleteReport(req, res, next) {
    try {
      const { id } = req.params;
      const result = await reportService.deleteReport(id);
      res.json(result);
    } catch (err) {
      next(err);
    }
  }

  async getDashboard(req, res, next) {
    try {
      const result = await adminService.getDashboard();
      res.json(result);
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new AdminController();