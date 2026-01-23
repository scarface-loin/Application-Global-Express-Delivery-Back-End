// ==================== src/services/deliveryService.js ====================
const { db } = require('../config/firebase');
const { cloudinary } = require('../config/cloudinary');
const Delivery = require('../models/Delivery');
const PackageModel = require('../models/Package');
const NotificationService = require('./notificationService');
const { v4: uuidv4 } = require('uuid');

class DeliveryService {

  // ==================== Générer un numéro de suivi unique ====================
  static generateTrackingNumber() {
    const timestamp = Date.now().toString(36).toUpperCase();
    const random = Math.random().toString(36).substring(2, 6).toUpperCase();
    return `GE${timestamp}${random}`;
  }

  // ==================== Créer une nouvelle livraison avec ses colis ====================
  static async createDelivery(adminId, deliveryData) {
    try {
      const {
        packages,
        deliveryType,
        clientInfo,
        notes
      } = deliveryData;

      // Validation
      if (!packages || packages.length === 0) {
        throw new Error('Au moins un colis est requis');
      }

      if (!['local', 'transfer'].includes(deliveryType)) {
        throw new Error('Type de livraison invalide');
      }

      // Valider les infos client
      if (!clientInfo?.name || !clientInfo?.phone) {
        throw new Error('Les informations du client sont requises');
      }

      // Créer les colis avec numéros de suivi
      const createdPackages = packages.map(pkg => {
        const packageObj = new PackageModel({
          id: uuidv4(),
          trackingNumber: this.generateTrackingNumber(),
          recipient: pkg.recipient,
          recipientPhone: pkg.recipientPhone,
          destination: pkg.destination,
          isOutOfTown: pkg.isOutOfTown || deliveryType === 'transfer',
          agencyName: pkg.agencyName || null,
          amount: parseFloat(pkg.amount) || 0,
          weight: pkg.weight || null,
          description: pkg.description || '',
          status: 'pending'
        });

        return packageObj.toObject();
      });

      // Calculer le montant total
      const totalAmount = createdPackages.reduce((sum, pkg) => sum + pkg.amount, 0);

      // Créer la livraison
      const delivery = new Delivery({
        packages: createdPackages,
        deliveryType,
        status: 'pending',
        totalAmount,
        notes: notes || '',
        clientInfo: {
          name: clientInfo.name,
          phone: clientInfo.phone,
          address: clientInfo.address || ''
        }
      });

      // Sauvegarder dans Firestore
      const deliveryRef = await db.collection('deliveries').add(delivery.toFirestore());

      return {
        id: deliveryRef.id,
        ...delivery.toFirestore(),
        message: 'Livraison créée avec succès'
      };

    } catch (error) {
      console.error('Erreur création livraison:', error);
      throw error;
    }
  }

  // ==================== Assigner une livraison à un livreur ====================
  static async assignDelivery(deliveryId, deliveryManId) {
    const deliveryRef = db.collection('deliveries').doc(deliveryId);
    const deliveryDoc = await deliveryRef.get();

    if (!deliveryDoc.exists) {
      throw new Error('Livraison non trouvée');
    }

    const userDoc = await db.collection('users').doc(deliveryManId).get();

    if (!userDoc.exists) {
      throw new Error('Livreur non trouvé');
    }

    const userData = userDoc.data();

    if (userData.role !== 'delivery_man') {
      throw new Error('Cet utilisateur n\'est pas un livreur');
    }

    if (!userData.isActive) {
      throw new Error('Ce livreur est désactivé');
    }

    await deliveryRef.update({
      deliveryManId,
      deliveryManName: userData.name,
      status: 'assigned',
      assignedAt: new Date(),
      updatedAt: new Date()
    });

    // Notifier le livreur
    await NotificationService.createNotification({
      userId: deliveryManId,
      title: 'Nouvelle livraison',
      body: 'Une nouvelle livraison vous a été assignée',
      type: 'delivery_assigned',
      data: { deliveryId }
    });

    return { message: 'Livraison assignée avec succès' };
  }

  // ==================== Upload du reçu de transfert ====================
  static async uploadTransferReceipt(deliveryId, deliveryManId, receiptFile) {
    try {
      const deliveryRef = db.collection('deliveries').doc(deliveryId);
      const deliveryDoc = await deliveryRef.get();

      if (!deliveryDoc.exists) {
        throw new Error('Livraison non trouvée');
      }

      const deliveryData = deliveryDoc.data();

      // Vérifier que c'est bien un transfert
      if (deliveryData.deliveryType !== 'transfer') {
        throw new Error('Cette livraison n\'est pas un transfert');
      }

      // Vérifier que le livreur est assigné à cette livraison
      if (deliveryData.deliveryManId !== deliveryManId) {
        throw new Error('Vous n\'êtes pas assigné à cette livraison');
      }

      // Upload sur Cloudinary (le fichier est déjà uploadé via multer)
      const receiptUrl = receiptFile.path;

      // Mettre à jour la livraison
      await deliveryRef.update({
        receiptUrl,
        transferredAt: new Date(),
        status: 'transferred',
        updatedAt: new Date()
      });

      // Mettre à jour tous les colis en "transferred"
      const updatedPackages = deliveryData.packages.map(pkg => ({
        ...pkg,
        status: 'transferred',
        updatedAt: new Date()
      }));

      await deliveryRef.update({
        packages: updatedPackages
      });

      // Notifier l'admin
      const admins = await db.collection('users')
        .where('role', '==', 'admin')
        .get();

      for (const adminDoc of admins.docs) {
        await NotificationService.createNotification({
          userId: adminDoc.id,
          title: 'Transfert effectué',
          body: `Reçu de transfert uploadé pour la livraison ${deliveryId}`,
          type: 'transfer_receipt',
          data: { deliveryId, receiptUrl }
        });
      }

      return {
        message: 'Reçu de transfert uploadé avec succès',
        receiptUrl
      };

    } catch (error) {
      // Nettoyer le fichier Cloudinary en cas d'erreur
      if (receiptFile?.filename) {
        await cloudinary.uploader.destroy(receiptFile.filename).catch(err =>
          console.error('Erreur nettoyage Cloudinary:', err)
        );
      }
      throw error;
    }
  }

  // ==================== Obtenir les détails d'une livraison ====================
  static async getDeliveryDetails(deliveryId) {
    const doc = await db.collection('deliveries').doc(deliveryId).get();

    if (!doc.exists) {
      throw new Error('Livraison non trouvée');
    }

    return {
      id: doc.id,
      ...doc.data()
    };
  }

  // ==================== Obtenir toutes les livraisons (avec filtres) ====================
  static async getAllDeliveries(filters = {}) {
    let query = db.collection('deliveries');

    if (filters.status) {
      query = query.where('status', '==', filters.status);
    }

    if (filters.deliveryType) {
      query = query.where('deliveryType', '==', filters.deliveryType);
    }

    if (filters.deliveryManId) {
      query = query.where('deliveryManId', '==', filters.deliveryManId);
    }

    const snapshot = await query.orderBy('createdAt', 'desc').get();

    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
  }

  // ==================== Supprimer une livraison (soft delete) ====================
  static async deleteDelivery(deliveryId) {
    const deliveryRef = db.collection('deliveries').doc(deliveryId);
    const doc = await deliveryRef.get();

    if (!doc.exists) {
      throw new Error('Livraison non trouvée');
    }

    const data = doc.data();

    // Vérifier que la livraison n'est pas déjà assignée
    if (data.deliveryManId) {
      throw new Error('Impossible de supprimer une livraison assignée');
    }

    // Soft delete
    await deliveryRef.update({
      status: 'cancelled',
      updatedAt: new Date()
    });

    return { message: 'Livraison annulée avec succès' };
  }

  // ==================== Rechercher un colis par numéro de suivi ====================
  static async trackPackage(trackingNumber) {
    const deliveriesRef = db.collection('deliveries');
    const snapshot = await deliveriesRef.get();

    for (const doc of snapshot.docs) {
      const delivery = doc.data();
      const foundPackage = delivery.packages.find(
        pkg => pkg.trackingNumber === trackingNumber
      );

      if (foundPackage) {
        return {
          delivery: {
            id: doc.id,
            status: delivery.status,
            deliveryType: delivery.deliveryType,
            deliveryManName: delivery.deliveryManName,
            createdAt: delivery.createdAt
          },
          package: foundPackage
        };
      }
    }

    throw new Error('Numéro de suivi introuvable');
  }

  // ==================== Obtenir les livraisons d'un livreur ====================
  static async getDeliveriesByDeliveryMan(deliveryManId, status = null) {
    let query = db.collection('deliveries')
      .where('deliveryManId', '==', deliveryManId);

    if (status) {
      query = query.where('status', '==', status);
    }

    const snapshot = await query.orderBy('createdAt', 'desc').get();

    return snapshot.docs.map(doc => Delivery.fromFirestore(doc));
  }

  // ==================== Obtenir une livraison par ID ====================
  static async getDeliveryById(deliveryId) {
    const doc = await db.collection('deliveries').doc(deliveryId).get();

    if (!doc.exists) {
      throw new Error('Livraison non trouvée');
    }

    return Delivery.fromFirestore(doc);
  }

  // ==================== MODIFIÉ : Commencer une livraison ====================
  static async startDelivery(deliveryId, deliveryManId) {
    const deliveryRef = db.collection('deliveries').doc(deliveryId);
    const doc = await deliveryRef.get();

    if (!doc.exists) {
      throw new Error('Livraison non trouvée');
    }

    const delivery = doc.data();

    if (delivery.deliveryManId !== deliveryManId) {
      throw new Error('Cette livraison ne vous est pas assignée');
    }

    if (delivery.status !== 'assigned') {
      throw new Error('Cette livraison ne peut pas être commencée');
    }

    await deliveryRef.update({
      status: 'in_progress',
      startedAt: new Date(),
      updatedAt: new Date()
    });

    // Notifier l'admin que le livreur a commencé
    const admins = await db.collection('users')
      .where('role', '==', 'admin')
      .get();

    for (const adminDoc of admins.docs) {
      await NotificationService.createNotification({
        userId: adminDoc.id,
        title: 'Livraison commencée',
        body: `${delivery.deliveryManName} a commencé la livraison`,
        type: 'delivery_started',
        data: { deliveryId }
      });
    }

    return { message: 'Livraison commencée avec succès' };
  }

  // ==================== Mettre à jour le statut d'une livraison ====================
  static async updateDeliveryStatus(deliveryId, deliveryManId, status) {
    const deliveryRef = db.collection('deliveries').doc(deliveryId);
    const doc = await deliveryRef.get();

    if (!doc.exists) {
      throw new Error('Livraison non trouvée');
    }

    const delivery = doc.data();

    if (delivery.deliveryManId !== deliveryManId) {
      throw new Error('Accès refusé');
    }

    // Valider les transitions d'états
    const validTransitions = {
      'assigned': ['in_progress', 'cancelled'],
      'in_progress': ['delivered', 'transferred', 'failed', 'issue_reported'],
      'delivered': [],
      'transferred': [],
      'failed': [],
      'cancelled': []
    };

    if (!validTransitions[delivery.status]?.includes(status)) {
      throw new Error(`Transition de statut invalide: ${delivery.status} → ${status}`);
    }

    const updateData = {
      status,
      updatedAt: new Date()
    };

    if (status === 'delivered') {
      updateData.completedAt = new Date();
      updateData.deliveredAt = new Date();
    } else if (status === 'transferred') {
      updateData.transferredAt = new Date();
    } else if (status === 'failed') {
      updateData.failedAt = new Date();
    }

    await deliveryRef.update(updateData);

    // Notifier l'admin des changements importants
    if (['delivered', 'transferred', 'failed'].includes(status)) {
      const admins = await db.collection('users')
        .where('role', '==', 'admin')
        .get();

      for (const adminDoc of admins.docs) {
        await NotificationService.createNotification({
          userId: adminDoc.id,
          title: 'Statut de livraison mis à jour',
          body: `Livraison ${deliveryId} : ${status}`,
          type: 'delivery_status_updated',
          data: { deliveryId, status }
        });
      }
    }

    return { message: 'Statut mis à jour' };
  }

  // ==================== Mettre à jour le statut d'un colis ====================
  // Dans votre fichier de service (ex: DeliveryService.js)

  static async updatePackageStatus(deliveryId, packageId, deliveryManId, updateData) { // ✅ CORRECTION 1: On reçoit un objet "updateData"

    // ✅ CORRECTION 2: On extrait les informations de l'objet
    const { status, rejectionReason } = updateData;

    const deliveryRef = db.collection('deliveries').doc(deliveryId);
    const doc = await deliveryRef.get();

    if (!doc.exists) {
      throw new Error('Livraison non trouvée');
    }

    const delivery = doc.data();

    if (delivery.deliveryManId !== deliveryManId) {
      throw new Error('Accès refusé');
    }

    const packages = delivery.packages.map(pkg => {
      if (pkg.id === packageId) {
        // ✅ CORRECTION 3: On construit le colis mis à jour correctement
        const updatedPackage = {
          ...pkg,
          status, // On utilise le statut extrait
          updatedAt: new Date()
        };

        // On ajoute la raison du rejet SEULEMENT si elle existe
        if (rejectionReason) {
          updatedPackage.rejectionReason = rejectionReason;
        }

        return updatedPackage;
      }
      return pkg;
    });

    // Le reste de la logique est correct et fonctionnera maintenant
    const allDelivered = packages.every(pkg =>
      pkg.status === 'delivered' || pkg.status === 'transferred'
    );

    const dataToUpdate = {
      packages,
      updatedAt: new Date()
    };

    if (allDelivered && delivery.deliveryType === 'local') {
      dataToUpdate.status = 'delivered';
      dataToUpdate.completedAt = new Date();
    } else if (allDelivered && delivery.deliveryType === 'transfer') {
      dataToUpdate.status = 'transferred';
    }

    await deliveryRef.update(dataToUpdate);

    // On peut retourner le document mis à jour pour être plus cohérent
    const updatedDoc = await deliveryRef.get();
    return updatedDoc.data();
  }

  // ==================== Obtenir les livraisons disponibles ====================
  static async getAvailableDeliveries() {
    const snapshot = await db.collection('deliveries')
      .where('status', '==', 'pending')
      .orderBy('createdAt', 'desc')
      .get();

    return snapshot.docs.map(doc => Delivery.fromFirestore(doc));
  }

  // ==================== Obtenir les livraisons assignées ====================
  static async getAssignedDeliveries() {
    const snapshot = await db.collection('deliveries')
      .where('status', 'in', ['assigned', 'in_progress'])
      .orderBy('assignedAt', 'desc')
      .get();

    return snapshot.docs.map(doc => Delivery.fromFirestore(doc));
  }

  // ==================== Signaler un problème ====================
  static async reportDeliveryIssue(deliveryId, deliveryManId, issueData) {
    const deliveryRef = db.collection('deliveries').doc(deliveryId);
    const doc = await deliveryRef.get();

    if (!doc.exists) throw new Error('Livraison non trouvée');
    const delivery = doc.data();

    if (delivery.deliveryManId !== deliveryManId) {
      throw new Error('Accès refusé');
    }

    // Enregistrer le problème
    await deliveryRef.update({
      issues: [...(delivery.issues || []), {
        ...issueData,
        reportedAt: new Date(),
        reportedBy: deliveryManId
      }],
      status: 'issue_reported',
      updatedAt: new Date()
    });

    // Notifier tous les admins
    const admins = await db.collection('users')
      .where('role', '==', 'admin')
      .get();

    for (const adminDoc of admins.docs) {
      await NotificationService.createNotification({
        userId: adminDoc.id,
        title: 'Problème signalé',
        body: `Problème signalé sur la livraison ${deliveryId}`,
        type: 'delivery_issue',
        data: { deliveryId, issueData }
      });
    }

    return { message: 'Problème signalé avec succès' };
  }

  // ==================== Statistiques du livreur ====================
  static async getDeliveryManStats(deliveryManId) {
    const deliveriesRef = db.collection('deliveries');

    // Récupérer toutes les livraisons du livreur
    const snapshot = await deliveriesRef
      .where('deliveryManId', '==', deliveryManId)
      .get();

    let stats = {
      total: 0,
      completed: 0,
      pending: 0,
      inProgress: 0,
      totalAmount: 0,
      thisWeek: 0,
      thisMonth: 0
    };

    const now = new Date();
    const startOfWeek = new Date(now.setDate(now.getDate() - now.getDay()));
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    snapshot.forEach(doc => {
      const delivery = doc.data();
      stats.total++;

      if (delivery.status === 'delivered' || delivery.status === 'transferred') {
        stats.completed++;
        stats.totalAmount += delivery.totalAmount || 0;

        const completedAt = delivery.completedAt?.toDate();
        if (completedAt >= startOfWeek) stats.thisWeek++;
        if (completedAt >= startOfMonth) stats.thisMonth++;
      } else if (delivery.status === 'assigned') {
        stats.pending++;
      } else if (delivery.status === 'in_progress') {
        stats.inProgress++;
      }
    });

    return stats;
  }


  // ==================== Endpoint A : Récupérer le bilan de réconciliation ====================
  static async getReconciliationSummary(deliveryManId) {
    try {
      // Récupérer toutes les livraisons du livreur
      const deliveriesSnapshot = await db.collection('deliveries')
        .where('deliveryManId', '==', deliveryManId)
        .get();

      const cashItems = [];
      const returnItems = [];
      let totalCashAmount = 0;

      deliveriesSnapshot.forEach(doc => {
        const delivery = doc.data();
        const deliveryId = doc.id;

        // Parcourir les packages de chaque livraison
        delivery.packages.forEach(pkg => {
          // ✅ CASH : Livraisons livrées ou transférées mais non versées
          if (
            (pkg.status === 'delivered' || pkg.status === 'transferred') &&
            delivery.settlementStatus !== 'completed'
          ) {
            const amount = parseFloat(pkg.amount) || 0;
            totalCashAmount += amount;

            cashItems.push({
              deliveryId,
              packageId: pkg.id,
              trackingNumber: pkg.trackingNumber,
              amount,
              clientName: pkg.recipient,
              completedAt: delivery.completedAt || delivery.transferredAt
            });
          }

          // ✅ RETURNS : Colis échoués ou annulés non retournés
          if (
            (pkg.status === 'failed' || pkg.status === 'cancelled') &&
            pkg.returnStatus !== 'returned_to_agency'
          ) {
            returnItems.push({
              packageId: pkg.id,
              trackingNumber: pkg.trackingNumber,
              recipient: pkg.recipient,
              destination: pkg.destination,
              reason: pkg.rejectionReason || 'Non spécifié',
              status: pkg.status
            });
          }
        });
      });

      return {
        success: true,
        data: {
          cash: {
            totalAmount: totalCashAmount,
            currency: 'XAF',
            count: cashItems.length,
            items: cashItems
          },
          returns: {
            count: returnItems.length,
            items: returnItems
          }
        }
      };
    } catch (error) {
      console.error('Erreur réconciliation:', error);
      throw new Error('Erreur lors de la récupération du bilan de réconciliation');
    }
  }

  // ==================== Endpoint B : Demander la clôture ====================
  static async requestReconciliation(deliveryManId, declaredAmount) {
    try {
      // Vérifier le montant réel à verser
      const summary = await this.getReconciliationSummary(deliveryManId);
      const actualAmount = summary.data.cash.totalAmount;

      // Créer une demande de réconciliation
      const reconciliationRequest = {
        deliveryManId,
        declaredAmount: parseFloat(declaredAmount),
        actualAmount,
        difference: actualAmount - parseFloat(declaredAmount),
        status: 'pending', // pending | approved | rejected
        requestedAt: new Date(),
        cashItems: summary.data.cash.items,
        returnItems: summary.data.returns.items
      };

      // Sauvegarder la demande
      const requestRef = await db.collection('reconciliation_requests').add(reconciliationRequest);

      // Notifier tous les admins
      const admins = await db.collection('users')
        .where('role', '==', 'admin')
        .get();

      const deliveryManDoc = await db.collection('users').doc(deliveryManId).get();
      const deliveryManName = deliveryManDoc.data()?.name || 'Livreur';

      for (const adminDoc of admins.docs) {
        await NotificationService.createNotification({
          userId: adminDoc.id,
          title: 'Demande de clôture',
          body: `${deliveryManName} demande une clôture de caisse (${declaredAmount} XAF)`,
          type: 'reconciliation_request',
          data: {
            requestId: requestRef.id,
            deliveryManId,
            declaredAmount,
            actualAmount
          }
        });
      }

      return {
        success: true,
        message: 'Demande de clôture envoyée avec succès',
        data: {
          requestId: requestRef.id,
          declaredAmount: parseFloat(declaredAmount),
          actualAmount,
          difference: actualAmount - parseFloat(declaredAmount),
          status: 'pending'
        }
      };
    } catch (error) {
      console.error('Erreur demande réconciliation:', error);
      throw new Error('Erreur lors de la demande de clôture');
    }
  }
}

module.exports = DeliveryService;