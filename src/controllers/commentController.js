const commentService = require("../services/commentService");
const logger = require("../config/logger");

class CommentController {
  /**
   * GET /api/comments/:zoneId
   */
  async getCommentsByZone(req, res, next) {
    try {
      const { zoneId } = req.params;
      const { limit } = req.query;
      const result = await commentService.getCommentsByZone(zoneId, limit ? parseInt(limit) : 50);
      res.json(result);
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/reports/:reportId/comments
   */
  async getReportComments(req, res, next) {
    try {
      const { reportId } = req.params;
      const { limit } = req.query;
      const result = await commentService.getReportComments(reportId, limit ? parseInt(limit) : 50);
      res.json(result);
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/comments
   */
  async createComment(req, res, next) {
    try {
      const commentData = req.body;
      const result = await commentService.createComment(commentData);
      res.status(201).json(result);
    } catch (err) {
      next(err);
    }
  }

  /**
   * DELETE /api/comments/:id
   */
  async deleteComment(req, res, next) {
    try {
      const { id } = req.params;
      const result = await commentService.deleteComment(id);
      res.json(result);
    } catch (err) {
      next(err);
    }
  }

  /**
   * DELETE /api/reports/:reportId/comments/:commentIndex
   */
  async deleteReportComment(req, res, next) {
    try {
      const { reportId, commentIndex } = req.params;
      const result = await commentService.deleteReportComment(reportId, parseInt(commentIndex));
      res.json(result);
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new CommentController();
