// ==================== src/routes/delivery.routes.js ====================
const express = require('express');
const router = express.Router();
const DeliveryService = require('../services/deliveryService');
const { authenticateToken, checkPasswordChange } = require('../middleware/auth');
const { validateRequest, schemas } = require('../middleware/validation');
const { uploadReceipt } = require('../config/cloudinary');

router.use(authenticateToken);
router.use(checkPasswordChange);

router.get('/', async (req, res, next) => {
  try {
    const { status } = req.query;
    const deliveries = await DeliveryService.getDeliveriesByDeliveryMan(
      req.user.userId,
      status
    );
    res.json(deliveries);
  } catch (error) {
    next(error);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const delivery = await DeliveryService.getDeliveryById(req.params.id);
    
    if (delivery.deliveryManId !== req.user.userId) {
      return res.status(403).json({ error: 'Accès refusé' });
    }
    
    res.json(delivery);
  } catch (error) {
    next(error);
  }
});

router.post('/:id/accept', async (req, res, next) => {
  try {
    const result = await DeliveryService.acceptDelivery(
      req.params.id,
      req.user.userId
    );
    res.json(result);
  } catch (error) {
    next(error);
  }
});

router.patch('/:id/status', 
  validateRequest(schemas.updateDeliveryStatus),
  async (req, res, next) => {
    try {
      const result = await DeliveryService.updateDeliveryStatus(
        req.params.id,
        req.user.userId,
        req.body.status
      );
      res.json(result);
    } catch (error) {
      next(error);
    }
  }
);

router.patch('/:deliveryId/packages/:packageId/status',
  validateRequest(schemas.updateDeliveryStatus),
  async (req, res, next) => {
    try {
      const result = await DeliveryService.updatePackageStatus(
        req.params.deliveryId,
        req.params.packageId,
        req.user.userId,
        req.body.status
      );
      res.json(result);
    } catch (error) {
      next(error);
    }
  }
);


router.post('/:deliveryId/upload-receipt',
  uploadReceipt.single('receipt'),
  async (req, res, next) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'Fichier reçu requis' });
      }

      const result = await DeliveryService.uploadTransferReceipt(
        req.params.deliveryId,
        req.user.userId,
        req.file
      );

      res.json(result);
    } catch (error) {
      next(error);
    }
  }
);


// A ajouter dans delivery.routes.js :

// Marquer une livraison comme "en cours de livraison"
router.patch('/:id/start-delivery', async (req, res, next) => {
  try {
    const result = await DeliveryService.updateDeliveryStatus(
      req.params.id,
      req.user.userId,
      'in_progress'
    );
    res.json(result);
  } catch (error) {
    next(error);
  }
});

// Signaler un problème avec une livraison
router.post('/:id/report-issue', async (req, res, next) => {
  try {
    const { issueType, description } = req.body;
    const result = await DeliveryService.reportDeliveryIssue(
      req.params.id,
      req.user.userId,
      { issueType, description }
    );
    res.json(result);
  } catch (error) {
    next(error);
  }
});

// Obtenir les statistiques personnelles
router.get('/stats/overview', async (req, res, next) => {
  try {
    const stats = await DeliveryService.getDeliveryManStats(
      req.user.userId
    );
    res.json(stats);
  } catch (error) {
    next(error);
  }
});

module.exports = router;