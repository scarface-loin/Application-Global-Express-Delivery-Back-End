// ==================== 4. src/middleware/auth.js ====================
const jwt = require('jsonwebtoken');
const { db } = require('../config/firebase');
const { ROLES } = require('../config/constants');

const authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      return res.status(401).json({ error: 'Token requis' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    const userDoc = await db.collection('users').doc(decoded.userId).get();
    
    if (!userDoc.exists) {
      return res.status(404).json({ error: 'Utilisateur non trouvé' });
    }

    const userData = userDoc.data();
    
    if (!userData.isActive) {
      return res.status(403).json({ error: 'Compte désactivé' });
    }

    req.user = {
      userId: userDoc.id,
      phone: userData.phone,
      role: userData.role,
      mustChangePassword: userData.mustChangePassword
    };

    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(403).json({ error: 'Token invalide' });
    }
    if (error.name === 'TokenExpiredError') {
      return res.status(403).json({ error: 'Token expiré' });
    }
    return res.status(500).json({ error: 'Erreur serveur' });
  }
};

const requireRole = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ 
        error: 'Accès refusé - Privilèges insuffisants' 
      });
    }
    next();
  };
};

const checkPasswordChange = (req, res, next) => {
  if (req.user.mustChangePassword && req.path !== '/password') {
    return res.status(403).json({ 
      error: 'Vous devez changer votre mot de passe',
      mustChangePassword: true 
    });
  }
  next();
};

module.exports = {
  authenticateToken,
  requireRole,
  checkPasswordChange
};
