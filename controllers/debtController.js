// ==================== src/controllers/debtController.js ====================
const AdminReconciliationService = require('../services/adminReconciliationService');
const { db } = require('../config/firebase');
const { ROLES } = require('../config/constants');

class DebtController {
  /**
   * Obtenir toutes les dettes d'un livreur
   */
  static async getDriverDebts(req, res, next) {
    try {
      const { driverId } = req.params;
      
      // Vérifier les permissions
      if (req.user.role !== ROLES.ADMIN && req.user.userId !== driverId) {
        return res.status(403).json({
          success: false,
          error: 'Accès non autorisé'
        });
      }

      const result = await AdminReconciliationService.getDriverDebts(driverId);
      res.json(result);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Obtenir toutes les dettes en attente (admin seulement)
   */
  static async getAllPendingDebts(req, res, next) {
    try {
      // Vérifier les permissions
      if (req.user.role !== ROLES.ADMIN) {
        return res.status(403).json({
          success: false,
          error: 'Accès non autorisé. Admin seulement.'
        });
      }

      const debtsSnapshot = await db.collection('driver_debts')
        .where('status', '==', 'pending')
        .orderBy('createdAt', 'desc')
        .get();

      const debts = await Promise.all(
        debtsSnapshot.docs.map(async (doc) => {
          const debtData = doc.data();
          
          // Récupérer les infos du livreur
          const driverDoc = await db.collection('users').doc(debtData.driverId).get();
          const driverData = driverDoc.exists ? driverDoc.data() : null;

          return {
            id: doc.id,
            ...debtData,
            driverName: driverData?.name || 'Inconnu',
            driverPhone: driverData?.phone || 'N/A',
            driverMatricule: driverData?.matricule || 'N/A'
          };
        })
      );

      const totalPending = debts.reduce((sum, debt) => sum + debt.amount, 0);

      res.json({
        success: true,
        data: debts,
        summary: {
          count: debts.length,
          totalAmount: totalPending
        }
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Obtenir les statistiques des dettes
   */
  static async getDebtStatistics(req, res, next) {
    try {
      // Vérifier les permissions
      if (req.user.role !== ROLES.ADMIN) {
        return res.status(403).json({
          success: false,
          error: 'Accès non autorisé. Admin seulement.'
        });
      }

      const [pendingSnapshot, paidSnapshot] = await Promise.all([
        db.collection('driver_debts').where('status', '==', 'pending').get(),
        db.collection('driver_debts').where('status', '==', 'paid').get()
      ]);

      let totalPending = 0;
      let totalPaid = 0;

      pendingSnapshot.forEach(doc => {
        totalPending += doc.data().amount || 0;
      });

      paidSnapshot.forEach(doc => {
        totalPaid += doc.data().amount || 0;
      });

      // Récupérer les livreurs avec dettes
      const usersSnapshot = await db.collection('users')
        .where('role', '==', 'delivery_man')
        .where('debtBalance', '>', 0)
        .get();

      const driversWithDebt = usersSnapshot.docs.map(doc => ({
        id: doc.id,
        name: doc.data().name,
        debtBalance: doc.data().debtBalance
      }));

      res.json({
        success: true,
        data: {
          totalPendingDebts: totalPending,
          totalPaidDebts: totalPaid,
          pendingDebtsCount: pendingSnapshot.size,
          paidDebtsCount: paidSnapshot.size,
          driversWithDebt: driversWithDebt.length,
          topDebtors: driversWithDebt
            .sort((a, b) => b.debtBalance - a.debtBalance)
            .slice(0, 5)
        }
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Marquer une dette comme payée (admin seulement)
   */
  static async markDebtAsPaid(req, res, next) {
    try {
      // Vérifier les permissions
      if (req.user.role !== ROLES.ADMIN) {
        return res.status(403).json({
          success: false,
          error: 'Accès non autorisé. Admin seulement.'
        });
      }

      const { debtId } = req.params;
      const { paymentReference } = req.body;

      if (!paymentReference) {
        return res.status(400).json({
          success: false,
          error: 'La référence de paiement est requise'
        });
      }

      // Récupérer la dette
      const debtDoc = await db.collection('driver_debts').doc(debtId).get();
      
      if (!debtDoc.exists) {
        return res.status(404).json({
          success: false,
          error: 'Dette non trouvée'
        });
      }

      const debtData = debtDoc.data();

      if (debtData.status === 'paid') {
        return res.status(400).json({
          success: false,
          error: 'Cette dette a déjà été payée'
        });
      }

      // Marquer comme payée
      const result = await AdminReconciliationService.markDebtAsPaid(
        debtId,
        req.user.userId,
        paymentReference
      );

      // Mettre à jour le solde du livreur
      const driverRef = db.collection('users').doc(debtData.driverId);
      const driverDoc = await driverRef.get();
      const currentBalance = driverDoc.data().debtBalance || 0;
      
      await driverRef.update({
        debtBalance: Math.max(0, currentBalance - debtData.amount),
        lastDebtUpdate: new Date(),
        updatedAt: new Date()
      });

      res.json({
        success: true,
        message: 'Dette marquée comme payée avec succès',
        data: {
          debtId,
          amount: debtData.amount,
          paymentReference
        }
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Obtenir l'historique des dettes d'un livreur
   */
  static async getDriverDebtHistory(req, res, next) {
    try {
      const { driverId } = req.params;
      const { startDate, endDate, status } = req.query;

      // Vérifier les permissions
      if (req.user.role !== ROLES.ADMIN && req.user.userId !== driverId) {
        return res.status(403).json({
          success: false,
          error: 'Accès non autorisé'
        });
      }

      let query = db.collection('driver_debts')
        .where('driverId', '==', driverId);

      if (status) {
        query = query.where('status', '==', status);
      }

      if (startDate) {
        query = query.where('createdAt', '>=', new Date(startDate));
      }

      if (endDate) {
        query = query.where('createdAt', '<=', new Date(endDate));
      }

      const snapshot = await query.orderBy('createdAt', 'desc').get();

      const debts = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      const totalPending = debts
        .filter(d => d.status === 'pending')
        .reduce((sum, d) => sum + d.amount, 0);

      const totalPaid = debts
        .filter(d => d.status === 'paid')
        .reduce((sum, d) => sum + d.amount, 0);

      res.json({
        success: true,
        data: debts,
        summary: {
          totalDebts: debts.length,
          totalPending,
          totalPaid,
          pendingCount: debts.filter(d => d.status === 'pending').length,
          paidCount: debts.filter(d => d.status === 'paid').length
        }
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Obtenir le solde de dette actuel d'un livreur
   */
  static async getDriverDebtBalance(req, res, next) {
    try {
      const { driverId } = req.params;

      // Vérifier les permissions
      if (req.user.role !== ROLES.ADMIN && req.user.userId !== driverId) {
        return res.status(403).json({
          success: false,
          error: 'Accès non autorisé'
        });
      }

      const driverDoc = await db.collection('users').doc(driverId).get();

      if (!driverDoc.exists) {
        return res.status(404).json({
          success: false,
          error: 'Livreur non trouvé'
        });
      }

      const driverData = driverDoc.data();
      const debtBalance = driverData.debtBalance || 0;

      // Récupérer les dettes en attente
      const pendingDebtsSnapshot = await db.collection('driver_debts')
        .where('driverId', '==', driverId)
        .where('status', '==', 'pending')
        .get();

      const pendingDebts = pendingDebtsSnapshot.docs.map(doc => ({
        id: doc.id,
        amount: doc.data().amount,
        reason: doc.data().reason,
        createdAt: doc.data().createdAt
      }));

      res.json({
        success: true,
        data: {
          driverId,
          driverName: driverData.name,
          debtBalance,
          pendingDebts,
          lastDebtUpdate: driverData.lastDebtUpdate
        }
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Annuler une dette (admin seulement - cas exceptionnel)
   */
  static async cancelDebt(req, res, next) {
    try {
      // Vérifier les permissions
      if (req.user.role !== ROLES.ADMIN) {
        return res.status(403).json({
          success: false,
          error: 'Accès non autorisé. Admin seulement.'
        });
      }

      const { debtId } = req.params;
      const { reason } = req.body;

      if (!reason) {
        return res.status(400).json({
          success: false,
          error: 'La raison de l\'annulation est requise'
        });
      }

      // Récupérer la dette
      const debtDoc = await db.collection('driver_debts').doc(debtId).get();
      
      if (!debtDoc.exists) {
        return res.status(404).json({
          success: false,
          error: 'Dette non trouvée'
        });
      }

      const debtData = debtDoc.data();

      if (debtData.status === 'cancelled') {
        return res.status(400).json({
          success: false,
          error: 'Cette dette a déjà été annulée'
        });
      }

      // Annuler la dette
      await db.collection('driver_debts').doc(debtId).update({
        status: 'cancelled',
        cancelledAt: new Date(),
        cancelledBy: req.user.userId,
        cancellationReason: reason,
        updatedAt: new Date()
      });

      // Mettre à jour le solde du livreur
      const driverRef = db.collection('users').doc(debtData.driverId);
      const driverDoc = await driverRef.get();
      const currentBalance = driverDoc.data().debtBalance || 0;
      
      await driverRef.update({
        debtBalance: Math.max(0, currentBalance - debtData.amount),
        lastDebtUpdate: new Date(),
        updatedAt: new Date()
      });

      res.json({
        success: true,
        message: 'Dette annulée avec succès',
        data: {
          debtId,
          amount: debtData.amount,
          reason
        }
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = DebtController;