// ==================== 2. src/routes/auth.routes.js ====================
const express = require('express');
const router = express.Router();
const AuthService = require('../services/authService');
const { validateRequest, schemas } = require('../middleware/validation');

router.post('/login', validateRequest(schemas.login), async (req, res, next) => {
  try {
    console.log('🔐 Tentative de login avec:', req.body.phone);
    
    const { phone, password } = req.body;
    const result = await AuthService.login(phone, password);
    
    console.log('✅ Login réussi pour:', phone);
    res.json(result);
  } catch (error) {
    console.error('❌ Erreur login:', error.message);
    next(error);
  }
});

router.post('/logout', (req, res) => {
  res.json({ message: 'Déconnexion réussie' });
});

module.exports = router;
