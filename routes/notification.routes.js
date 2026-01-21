// ==================== src/routes/notification.routes.js ====================
const express = require('express');
const router = express.Router();
const NotificationService = require('../services/notificationService');
const { authenticateToken, checkPasswordChange } = require('../middleware/auth');

router.use(authenticateToken);
router.use(checkPasswordChange);

router.get('/', async (req, res, next) => {
  try {
    const { limit } = req.query;
    const notifications = await NotificationService.getUserNotifications(
      req.user.userId,
      limit ? parseInt(limit) : 50
    );
    res.json(notifications);
  } catch (error) {
    next(error);
  }
});

router.patch('/:id/read', async (req, res, next) => {
  try {
    const result = await NotificationService.markAsRead(
      req.params.id,
      req.user.userId
    );
    res.json(result);
  } catch (error) {
    next(error);
  }
});

router.patch('/read-all', async (req, res, next) => {
  try {
    const result = await NotificationService.markAllAsRead(req.user.userId);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

module.exports = router;