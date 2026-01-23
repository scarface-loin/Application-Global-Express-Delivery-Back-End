// ==================== src/routes/delivery.routes.js ====================
const express = require('express');
const router = express.Router();
const DeliveryService = require('../services/deliveryService');
const { authenticateToken, checkPasswordChange } = require('../middleware/auth');
const { validateRequest, schemas } = require('../middleware/validation');
const { uploadReceipt } = require('../config/cloudinary');

router.use(authenticateToken);
router.use(checkPasswordChange);

// ==================== ROUTES SPÉCIFIQUES (DOIVENT ÊTRE EN PREMIER) ====================

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

// ==================== ENDPOINTS DE RÉCONCILIATION ====================

// Endpoint A : Récupérer le bilan actuel du livreur
router.get('/reconciliation/summary', async (req, res, next) => {
  try {
    const summary = await DeliveryService.getReconciliationSummary(
      req.user.userId
    );
    res.json(summary);
  } catch (error) {
    next(error);
  }
});

// Endpoint B : Demander la clôture
router.post('/reconciliation/request', async (req, res, next) => {
  try {
    const { amountDeclared } = req.body;

    if (!amountDeclared || isNaN(amountDeclared)) {
      return res.status(400).json({
        success: false,
        error: 'Le montant déclaré est requis et doit être un nombre valide'
      });
    }

    const result = await DeliveryService.requestReconciliation(
      req.user.userId,
      amountDeclared
    );
    res.json(result);
  } catch (error) {
    next(error);
  }
});

// ==================== ROUTES GÉNÉRALES ====================

// Obtenir toutes les livraisons du livreur
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

// Obtenir une livraison spécifique (⚠️ DOIT ÊTRE APRÈS LES ROUTES SPÉCIFIQUES)
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

// MODIFIÉ : Commencer une livraison (au lieu d'accepter)
router.post('/:id/start', async (req, res, next) => {
  try {
    const result = await DeliveryService.startDelivery(
      req.params.id,
      req.user.userId
    );
    res.json(result);
  } catch (error) {
    next(error);
  }
});

// Mettre à jour le statut général de la livraison
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
  // ✅ CORRECTION 1 : Utiliser le bon schéma de validation
  validateRequest(schemas.updatePackageStatus),
  async (req, res, next) => {
    try {
      // ✅ CORRECTION 2 : Passer tout le `req.body` qui contient status ET rejectionReason
      const result = await DeliveryService.updatePackageStatus(
        req.params.deliveryId,
        req.params.packageId,
        req.user.userId,
        req.body // On passe l'objet entier { status, rejectionReason }
      );
      res.json(result);
    } catch (error) {
      next(error);
    }
  }
);


// Télécharger le reçu de transfert
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

module.exports = router;