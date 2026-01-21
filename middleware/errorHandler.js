
// ==================== 5. src/middleware/errorHandler.js ====================
const errorHandler = (err, req, res, next) => {
  console.error('💥 Error Handler:', err);

  if (err.name === 'ValidationError') {
    return res.status(400).json({ error: err.message });
  }

  if (err.code === 'auth/phone-number-already-exists') {
    return res.status(400).json({ 
      error: 'Ce numéro de téléphone est déjà utilisé' 
    });
  }

  res.status(err.status || 500).json({
    error: err.message || 'Erreur serveur interne'
  });
};

module.exports = errorHandler;