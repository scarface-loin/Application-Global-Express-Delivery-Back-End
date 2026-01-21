// ==================== src/routes/profile.routes.js ====================
const express = require('express');
const router = express.Router();
const ProfileService = require('../services/profileService');
const AuthService = require('../services/authService');
const { authenticateToken } = require('../middleware/auth');
const { validateRequest, schemas } = require('../middleware/validation');

router.use(authenticateToken);

router.get('/', async (req, res, next) => {
  try {
    const profile = await ProfileService.getUserProfile(req.user.userId);
    res.json(profile);
  } catch (error) {
    next(error);
  }
});

router.patch('/',
  validateRequest(schemas.updateProfile),
  async (req, res, next) => {
    try {
      const profile = await ProfileService.updateUserProfile(
        req.user.userId,
        req.body
      );
      res.json(profile);
    } catch (error) {
      next(error);
    }
  }
);

router.patch('/password',
  validateRequest(schemas.changePassword),
  async (req, res, next) => {
    try {
      const { currentPassword, newPassword } = req.body;
      const result = await AuthService.changePassword(
        req.user.userId,
        currentPassword,
        newPassword
      );
      res.json(result);
    } catch (error) {
      next(error);
    }
  }
);

router.post('/fcm-token', async (req, res, next) => {
  try {
    const { token } = req.body;
    const result = await ProfileService.updateFcmToken(req.user.userId, token);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

module.exports = router;