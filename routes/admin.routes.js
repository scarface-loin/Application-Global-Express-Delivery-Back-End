// ==================== src/routes/admin.routes.js ====================
const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const AuthService = require('../services/authService');
const DeliveryService = require('../services/deliveryService');
const { db } = require('../config/firebase');
const { uploadDeliveryManDocs, uploadReceipt, uploadToCloudinary } = require('../config/cloudinary');
const { authenticateToken, requireRole } = require('../middleware/auth');
const { validateRequest, schemas } = require('../middleware/validation');
const { ROLES } = require('../config/constants');
const User = require('../models/User');

// ==================== ROUTE PUBLIQUE POUR CRÉER LE PREMIER ADMIN ====================
router.post('/create-first-admin', async (req, res, next) => {
  try {
    const { name, phone, matricule, password } = req.body;

    // Validation
    if (!name || !phone || !matricule || !password) {
      return res.status(400).json({ error: 'Tous les champs sont requis' });
    }

    if (password.length < 6) {
      return res.status(400).json({ 
        error: 'Le mot de passe doit contenir au moins 6 caractères' 
      });
    }

    if (!/^\d{9,15}$/.test(phone)) {
      return res.status(400).json({ 
        error: 'Numéro de téléphone invalide (9-15 chiffres)' 
      });
    }

    // Vérifier si un admin existe déjà (sécurité)
    const adminsSnapshot = await db.collection('users')
      .where('role', '==', 'admin')
      .limit(1)
      .get();

    if (!adminsSnapshot.empty) {
      return res.status(403).json({ 
        error: 'Un administrateur existe déjà. Route désactivée.' 
      });
    }

    // Vérifier le téléphone
    const existingUser = await db.collection('users')
      .where('phone', '==', phone)
      .get();

    if (!existingUser.empty) {
      return res.status(400).json({ 
        error: 'Ce numéro de téléphone est déjà utilisé' 
      });
    }

    // Créer l'admin
    const user = new User({
      name,
      phone,
      matricule,
      role: 'admin',
      mustChangePassword: false
    });

    const userRef = await db.collection('users').add(user.toFirestore());

    // Créer le mot de passe
    const hash = await bcrypt.hash(password, 10);
    await db.collection('passwords').doc(userRef.id).set({
      hash,
      createdAt: new Date()
    });

    res.status(201).json({
      message: 'Administrateur créé avec succès',
      admin: { id: userRef.id, name, phone, matricule }
    });

  } catch (error) {
    console.error('Erreur création admin:', error);
    next(error);
  }
});

// ==================== ROUTES PROTÉGÉES (ADMIN UNIQUEMENT) ====================
router.use(authenticateToken);
router.use(requireRole(ROLES.ADMIN));

// ==================== GESTION DES LIVREURS ====================
// Créer un livreur avec documents
router.post('/delivery-men',
  uploadDeliveryManDocs.fields([
    { name: 'permit', maxCount: 1 },
    { name: 'cni', maxCount: 1 },
    { name: 'contract', maxCount: 1 }
  ]),
  validateRequest(schemas.createDeliveryMan),
  async (req, res, next) => {
    try {
      const { name, phone, matricule } = req.body;
      
      // Vérifier que tous les documents ont été uploadés
      if (!req.files || !req.files.permit || !req.files.cni || !req.files.contract) {
        const missingDocs = [];
        if (!req.files?.permit) missingDocs.push('permit');
        if (!req.files?.cni) missingDocs.push('cni');
        if (!req.files?.contract) missingDocs.push('contract');
        
        return res.status(400).json({ 
          error: 'Documents manquants',
          missingDocuments: missingDocs,
          requiredDocuments: ['permit', 'cni', 'contract'],
          message: `Veuillez fournir tous les documents requis: ${missingDocs.join(', ')}`
        });
      }

      // Upload vers Cloudinary
      const { uploadToCloudinary } = require('../config/cloudinary');
      
      const permitUpload = await uploadToCloudinary(req.files.permit[0], 'delivery-men-documents');
      const cniUpload = await uploadToCloudinary(req.files.cni[0], 'delivery-men-documents');
      const contractUpload = await uploadToCloudinary(req.files.contract[0], 'delivery-men-documents');

      const documents = {
        permit: {
          url: permitUpload.secure_url,
          publicId: permitUpload.public_id
        },
        cni: {
          url: cniUpload.secure_url,
          publicId: cniUpload.public_id
        },
        contract: {
          url: contractUpload.secure_url,
          publicId: contractUpload.public_id
        }
      };

      // Créer le livreur (le mot de passe "0000" est créé automatiquement dans AuthService)
      const deliveryMan = await AuthService.createDeliveryMan(
        name,
        phone,
        matricule,
        documents
      );
      
      res.status(201).json(deliveryMan);
    } catch (error) {
      next(error);
    }
  }
);



// Mettre à jour les documents d'un livreur
router.patch('/delivery-men/:id/documents',
  uploadDeliveryManDocs.fields([
    { name: 'permit', maxCount: 1 },
    { name: 'cni', maxCount: 1 },
    { name: 'contract', maxCount: 1 }
  ]),
  async (req, res, next) => {
    try {
      if (!req.files || Object.keys(req.files).length === 0) {
        return res.status(400).json({ 
          error: 'Aucun document fourni' 
        });
      }

      const documents = {};
      
      if (req.files.permit) {
        const upload = await uploadToCloudinary(req.files.permit[0], 'delivery-men-documents');
        documents.permit = {
          url: upload.secure_url,
          publicId: upload.public_id
        };
      }
      
      if (req.files.cni) {
        const upload = await uploadToCloudinary(req.files.cni[0], 'delivery-men-documents');
        documents.cni = {
          url: upload.secure_url,
          publicId: upload.public_id
        };
      }
      
      if (req.files.contract) {
        const upload = await uploadToCloudinary(req.files.contract[0], 'delivery-men-documents');
        documents.contract = {
          url: upload.secure_url,
          publicId: upload.public_id
        };
      }

      const result = await AuthService.updateDeliveryManDocuments(
        req.params.id,
        documents
      );
      
      res.json(result);
    } catch (error) {
      next(error);
    }
  }
);

// Liste des livreurs
router.get('/delivery-men', async (req, res, next) => {
  try {
    const snapshot = await db.collection('users')
      .where('role', '==', ROLES.DELIVERY_MAN)
      .orderBy('createdAt', 'desc')
      .get();
    
    const deliveryMen = snapshot.docs.map(doc => {
      const data = doc.data();
      const user = { id: doc.id, ...data };
      
      // Ajouter le statut des documents
      const tempUser = new User(user);
      const missingDocs = tempUser.getMissingDocuments();
      
      return {
        ...user,
        documentsStatus: {
          allDocumentsProvided: missingDocs.length === 0,
          missingDocuments: missingDocs,
          hasPermit: !!data.documents?.permit,
          hasCni: !!data.documents?.cni,
          hasContract: !!data.documents?.contract
        }
      };
    });
    
    res.json(deliveryMen);
  } catch (error) {
    next(error);
  }
});

// Détails d'un livreur
router.get('/delivery-men/:id', async (req, res, next) => {
  try {
    const doc = await db.collection('users').doc(req.params.id).get();
    
    if (!doc.exists) {
      return res.status(404).json({ error: 'Livreur non trouvé' });
    }
    
    const data = doc.data();
    const user = { id: doc.id, ...data };
    
    // Ajouter le statut des documents
    const tempUser = new User(user);
    const missingDocs = tempUser.getMissingDocuments();
    
    res.json({
      ...user,
      documentsStatus: {
        allDocumentsProvided: missingDocs.length === 0,
        missingDocuments: missingDocs,
        hasPermit: !!data.documents?.permit,
        hasCni: !!data.documents?.cni,
        hasContract: !!data.documents?.contract
      }
    });
  } catch (error) {
    next(error);
  }
});

// Modifier un livreur
router.patch('/delivery-men/:id', async (req, res, next) => {
  try {
    const { name, isActive, settings } = req.body;
    const updates = {};
    
    if (name) updates.name = name;
    if (typeof isActive === 'boolean') updates.isActive = isActive;
    if (settings) updates.settings = settings;
    
    updates.updatedAt = new Date();
    
    await db.collection('users').doc(req.params.id).update(updates);
    
    const updated = await db.collection('users').doc(req.params.id).get();
    const data = updated.data();
    const user = { id: updated.id, ...data };
    
    const tempUser = new User(user);
    const missingDocs = tempUser.getMissingDocuments();
    
    res.json({
      ...user,
      documentsStatus: {
        allDocumentsProvided: missingDocs.length === 0,
        missingDocuments: missingDocs
      }
    });
  } catch (error) {
    next(error);
  }
});

// Désactiver un livreur
router.delete('/delivery-men/:id', async (req, res, next) => {
  try {
    await db.collection('users').doc(req.params.id).update({
      isActive: false,
      updatedAt: new Date()
    });
    
    res.json({ message: 'Livreur désactivé' });
  } catch (error) {
    next(error);
  }
});

// Réinitialiser le mot de passe d'un livreur
router.post('/delivery-men/:id/reset-password', async (req, res, next) => {
  try {
    const result = await AuthService.resetPassword(req.params.id);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

// ==================== GESTION DES LIVRAISONS ====================

// Créer une livraison
router.post('/deliveries',
  validateRequest(schemas.createDelivery),
  async (req, res, next) => {
    try {
      const delivery = await DeliveryService.createDelivery(
        req.user.userId,
        req.body
      );
      res.status(201).json(delivery);
    } catch (error) {
      next(error);
    }
  }
);

// Statistiques des livraisons
router.get('/deliveries/stats', async (req, res, next) => {
  try {
    const deliveriesRef = db.collection('deliveries');
    
    const [total, pending, assigned, inProgress, delivered, cancelled, transfers] = await Promise.all([
      deliveriesRef.count().get(),
      deliveriesRef.where('status', '==', 'pending').count().get(),
      deliveriesRef.where('status', '==', 'assigned').count().get(),
      deliveriesRef.where('status', '==', 'in_progress').count().get(),
      deliveriesRef.where('status', '==', 'delivered').count().get(),
      deliveriesRef.where('status', '==', 'cancelled').count().get(),
      deliveriesRef.where('deliveryType', '==', 'transfer').count().get()
    ]);
    
    res.json({
      total: total.data().count,
      pending: pending.data().count,
      assigned: assigned.data().count,
      inProgress: inProgress.data().count,
      delivered: delivered.data().count,
      cancelled: cancelled.data().count,
      transfers: transfers.data().count
    });
  } catch (error) {
    next(error);
  }
});

// Obtenir toutes les livraisons
router.get('/deliveries', async (req, res, next) => {
  try {
    const { status, deliveryType, deliveryManId } = req.query;
    const deliveries = await DeliveryService.getAllDeliveries({
      status,
      deliveryType,
      deliveryManId
    });
    res.json(deliveries);
  } catch (error) {
    next(error);
  }
});

// Obtenir les détails d'une livraison
router.get('/deliveries/:id', async (req, res, next) => {
  try {
    const delivery = await DeliveryService.getDeliveryDetails(req.params.id);
    res.json(delivery);
  } catch (error) {
    next(error);
  }
});

// Supprimer/Annuler une livraison
router.delete('/deliveries/:id', async (req, res, next) => {
  try {
    const result = await DeliveryService.deleteDelivery(req.params.id);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

// Rechercher un colis par tracking
router.get('/track/:trackingNumber', async (req, res, next) => {
  try {
    const result = await DeliveryService.trackPackage(req.params.trackingNumber);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

// ==================== ATTRIBUTION DES LIVRAISONS ====================

// Assigner une livraison à un livreur
router.post('/deliveries/:deliveryId/assign',
  validateRequest(schemas.assignDelivery),
  async (req, res, next) => {
    try {
      const result = await DeliveryService.assignDelivery(
        req.params.deliveryId,
        req.body.deliveryManId
      );
      res.json(result);
    } catch (error) {
      next(error);
    }
  }
);

// Réassigner une livraison
router.patch('/deliveries/:deliveryId/reassign',
  validateRequest(schemas.assignDelivery),
  async (req, res, next) => {
    try {
      const result = await DeliveryService.assignDelivery(
        req.params.deliveryId,
        req.body.deliveryManId
      );
      res.json(result);
    } catch (error) {
      next(error);
    }
  }
);

// Livraisons disponibles (non assignées)
router.get('/deliveries-available', async (req, res, next) => {
  try {
    const deliveries = await DeliveryService.getAvailableDeliveries();
    res.json(deliveries);
  } catch (error) {
    next(error);
  }
});

// Livraisons assignées
router.get('/deliveries-assigned', async (req, res, next) => {
  try {
    const deliveries = await DeliveryService.getAssignedDeliveries();
    res.json(deliveries);
  } catch (error) {
    next(error);
  }
});



// ==================== À AJOUTER DANS src/routes/admin.routes.js ====================
// ⚠️ Ajouter cet import en haut du fichier après les autres imports
const AdminReconciliationService = require('../services/adminReconciliationService');

// ==================== ROUTES DE RÉCONCILIATION (CAISSE & VERSEMENTS) ====================
// ⚠️ Ajouter ces routes AVANT "module.exports = router;" à la fin du fichier

// 1. Liste des livreurs avec solde positif
router.get('/reconciliation/drivers', async (req, res, next) => {
  try {
    const result = await AdminReconciliationService.getDriversWithPendingSettlement();
    res.json(result);
  } catch (error) {
    next(error);
  }
});

// 2. Détails du versement d'un livreur
router.get('/reconciliation/drivers/:driverId/details', async (req, res, next) => {
  try {
    const result = await AdminReconciliationService.getDriverSettlementDetails(
      req.params.driverId
    );
    res.json(result);
  } catch (error) {
    next(error);
  }
});

// 3. Valider le versement d'un livreur
router.post('/reconciliation/settle', async (req, res, next) => {
  try {
    const { driverId, amountCollected, confirmReturns } = req.body;

    // Validation
    if (!driverId) {
      return res.status(400).json({
        success: false,
        error: 'L\'ID du livreur est requis'
      });
    }

    if (!amountCollected || isNaN(amountCollected) || amountCollected < 0) {
      return res.status(400).json({
        success: false,
        error: 'Le montant collecté est requis et doit être un nombre positif'
      });
    }

    const result = await AdminReconciliationService.settleDriverPayment(
      req.user.userId, // Admin qui effectue l'opération
      driverId,
      parseFloat(amountCollected),
      confirmReturns !== false // Par défaut true
    );

    res.json(result);
  } catch (error) {
    next(error);
  }
});

// 4. BONUS : Historique des versements
router.get('/reconciliation/history', async (req, res, next) => {
  try {
    const { driverId, startDate, endDate } = req.query;

    const result = await AdminReconciliationService.getSettlementHistory(
      driverId || null,
      startDate ? new Date(startDate) : null,
      endDate ? new Date(endDate) : null
    );

    res.json(result);
  } catch (error) {
    next(error);
  }
});

// 5. BONUS : Statistiques de réconciliation
router.get('/reconciliation/stats', async (req, res, next) => {
  try {
    const driversResult = await AdminReconciliationService.getDriversWithPendingSettlement();
    
    // Statistiques supplémentaires
    const settlementHistorySnapshot = await db.collection('settlement_history')
      .orderBy('settledAt', 'desc')
      .limit(10)
      .get();

    const recentSettlements = settlementHistorySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    // Calculer les stats du mois en cours
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const monthlySnapshot = await db.collection('settlement_history')
      .where('settledAt', '>=', startOfMonth)
      .get();

    let monthlyTotal = 0;
    let monthlyCount = 0;

    monthlySnapshot.forEach(doc => {
      const data = doc.data();
      monthlyTotal += data.amountCollected || 0;
      monthlyCount++;
    });

    res.json({
      success: true,
      data: {
        pending: driversResult.summary,
        thisMonth: {
          totalSettlements: monthlyCount,
          totalAmount: monthlyTotal,
          averageAmount: monthlyCount > 0 ? monthlyTotal / monthlyCount : 0
        },
        recentSettlements: recentSettlements.slice(0, 5).map(s => ({
          id: s.id,
          driverId: s.driverId,
          amount: s.amountCollected,
          settledAt: s.settledAt
        }))
      }
    });
  } catch (error) {
    next(error);
  }
});

// ==================== FIN DES ROUTES DE RÉCONCILIATION ====================

module.exports = router;