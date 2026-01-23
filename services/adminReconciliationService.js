// ==================== src/services/adminReconciliationService.js ====================
const { db } = require('../config/firebase');
const NotificationService = require('./notificationService');
const { PACKAGE_STATUS } = require('../config/constants');

class AdminReconciliationService {

  // ==================== 1. Liste des livreurs avec solde positif ====================
  static async getDriversWithPendingSettlement() {
    try {
      // Récupérer tous les livreurs actifs
      const driversSnapshot = await db.collection('users')
        .where('role', '==', 'delivery_man')
        .where('isActive', '==', true)
        .get();

      const driversWithBalance = [];

      // Pour chaque livreur, calculer son solde
      for (const driverDoc of driversSnapshot.docs) {
        const driverId = driverDoc.id;
        const driverData = driverDoc.data();

        // Récupérer toutes les livraisons du livreur
        const deliveriesSnapshot = await db.collection('deliveries')
          .where('deliveryManId', '==', driverId)
          .get();

        let cashInHand = 0;
        let pendingReturns = 0;
        let deliveredCount = 0;
        let lastDeliveryDate = null;
        let lastSettlementRequest = null;

        deliveriesSnapshot.forEach(doc => {
          const delivery = doc.data();

          // Parcourir les packages
          delivery.packages.forEach(pkg => {
            // ✅ CASH : Colis livrés/transférés mais non versés
            if (
              (pkg.status === PACKAGE_STATUS.DELIVERED || pkg.status === PACKAGE_STATUS.TRANSFERRED) &&
              delivery.settlementStatus !== 'completed'
            ) {
              cashInHand += parseFloat(pkg.amount) || 0;
              deliveredCount++;

              // Mettre à jour la dernière date de livraison
              const completedAt = delivery.completedAt?.toDate() || delivery.transferredAt?.toDate();
              if (completedAt && (!lastDeliveryDate || completedAt > lastDeliveryDate)) {
                lastDeliveryDate = completedAt;
              }
            }

            // ✅ RETURNS : Colis échoués non retournés
            if (
              (pkg.status === PACKAGE_STATUS.FAILED || pkg.status === 'cancelled') &&
              pkg.returnStatus !== 'returned_to_agency'
            ) {
              pendingReturns++;
            }
          });
        });

        // Récupérer la dernière demande de réconciliation
        const reconciliationSnapshot = await db.collection('reconciliation_requests')
          .where('deliveryManId', '==', driverId)
          .where('status', '==', 'pending')
          .orderBy('requestedAt', 'desc')
          .limit(1)
          .get();

        if (!reconciliationSnapshot.empty) {
          lastSettlementRequest = reconciliationSnapshot.docs[0].data().requestedAt;
        }

        // Récupérer le solde de dette du livreur
        const driverDebt = driverData.debtBalance || 0;

        // Ajouter seulement si le livreur a un solde ou des retours
        if (cashInHand > 0 || pendingReturns > 0) {
          driversWithBalance.push({
            driverId,
            name: driverData.name,
            phone: driverData.phone,
            matricule: driverData.matricule,
            cashInHand,
            deliveredCount,
            pendingReturns,
            debtBalance: driverDebt,
            lastDeliveryDate,
            lastSettlementRequest,
            hasPendingRequest: !!lastSettlementRequest
          });
        }
      }

      // Trier par montant décroissant
      driversWithBalance.sort((a, b) => b.cashInHand - a.cashInHand);

      return {
        success: true,
        data: driversWithBalance,
        summary: {
          totalDrivers: driversWithBalance.length,
          totalCashInHand: driversWithBalance.reduce((sum, d) => sum + d.cashInHand, 0),
          totalPendingReturns: driversWithBalance.reduce((sum, d) => sum + d.pendingReturns, 0),
          totalDebt: driversWithBalance.reduce((sum, d) => sum + d.debtBalance, 0)
        }
      };
    } catch (error) {
      console.error('Erreur récupération livreurs avec solde:', error);
      throw new Error('Erreur lors de la récupération des livreurs avec solde positif');
    }
  }

  // ==================== 2. Détails du versement d'un livreur ====================
  static async getDriverSettlementDetails(driverId) {
    try {
      // Vérifier que le livreur existe
      const driverDoc = await db.collection('users').doc(driverId).get();
      if (!driverDoc.exists) {
        throw new Error('Livreur non trouvé');
      }

      const driverData = driverDoc.data();

      // Récupérer toutes les livraisons du livreur
      const deliveriesSnapshot = await db.collection('deliveries')
        .where('deliveryManId', '==', driverId)
        .get();

      const cashDetails = [];
      const returnDetails = [];
      let totalCash = 0;

      deliveriesSnapshot.forEach(doc => {
        const delivery = doc.data();
        const deliveryId = doc.id;

        delivery.packages.forEach(pkg => {
          // ✅ CASH DETAILS
          if (
            (pkg.status === PACKAGE_STATUS.DELIVERED || pkg.status === PACKAGE_STATUS.TRANSFERRED) &&
            delivery.settlementStatus !== 'completed'
          ) {
            const amount = parseFloat(pkg.amount) || 0;
            totalCash += amount;

            cashDetails.push({
              deliveryId,
              packageId: pkg.id,
              trackingNumber: pkg.trackingNumber,
              amount,
              clientName: pkg.recipient,
              destination: pkg.destination,
              completedAt: delivery.completedAt || delivery.transferredAt,
              deliveryType: delivery.deliveryType,
              status: pkg.status
            });
          }

          // ✅ RETURN DETAILS
          if (
            (pkg.status === PACKAGE_STATUS.FAILED || pkg.status === 'cancelled') &&
            pkg.returnStatus !== 'returned_to_agency'
          ) {
            returnDetails.push({
              deliveryId,
              packageId: pkg.id,
              trackingNumber: pkg.trackingNumber,
              recipient: pkg.recipient,
              destination: pkg.destination,
              reason: pkg.rejectionReason || 'Non spécifié',
              status: pkg.status,
              failedAt: pkg.updatedAt
            });
          }
        });
      });

      // Vérifier s'il y a une demande de réconciliation en attente
      const reconciliationSnapshot = await db.collection('reconciliation_requests')
        .where('deliveryManId', '==', driverId)
        .where('status', '==', 'pending')
        .orderBy('requestedAt', 'desc')
        .limit(1)
        .get();

      let pendingRequest = null;
      if (!reconciliationSnapshot.empty) {
        const requestData = reconciliationSnapshot.docs[0].data();
        pendingRequest = {
          requestId: reconciliationSnapshot.docs[0].id,
          declaredAmount: requestData.declaredAmount,
          requestedAt: requestData.requestedAt,
          difference: requestData.difference
        };
      }

      return {
        success: true,
        data: {
          driverId,
          name: driverData.name,
          phone: driverData.phone,
          matricule: driverData.matricule,
          summary: {
            totalCash,
            deliveredCount: cashDetails.length,
            pendingReturns: returnDetails.length,
            currentDebt: driverData.debtBalance || 0,
            pendingRequest
          },
          cashDetails,
          returnDetails
        }
      };
    } catch (error) {
      console.error('Erreur détails versement:', error);
      throw error;
    }
  }

  // ==================== 3. Valider le versement avec gestion des dettes ====================
  static async settleDriverPayment(adminId, driverId, amountCollected, confirmReturns = true) {
    try {
      // 1. Récupérer les détails pour validation
      const details = await this.getDriverSettlementDetails(driverId);
      const actualAmount = details.data.summary.totalCash;
      const currentDebt = details.data.summary.currentDebt;

      // 2. Calculer la différence (dette si négatif, trop-perçu si positif)
      const difference = actualAmount - amountCollected;
      let newDebtAmount = 0;
      let debtAction = null;

      if (difference > 0) {
        // Le livreur a versé MOINS que prévu → Dette
        newDebtAmount = difference;
        debtAction = 'added';
      } else if (difference < 0) {
        // Le livreur a versé PLUS que prévu → Excédent (on enregistre mais pas de dette)
        newDebtAmount = 0;
        debtAction = 'overpayment';
      }

      // 3. Récupérer toutes les livraisons concernées
      const deliveriesSnapshot = await db.collection('deliveries')
        .where('deliveryManId', '==', driverId)
        .get();

      const batch = db.batch();
      let deliveriesSettled = 0;
      let packagesSettled = 0;
      let returnsProcessed = 0;
      const deliveryIds = [];

      // 4. Mettre à jour les livraisons et packages
      deliveriesSnapshot.forEach(doc => {
        const delivery = doc.data();
        const deliveryRef = db.collection('deliveries').doc(doc.id);

        let needsUpdate = false;
        const updatedPackages = delivery.packages.map(pkg => {
          // Marquer les colis livrés comme versés
          if (
            (pkg.status === PACKAGE_STATUS.DELIVERED || pkg.status === PACKAGE_STATUS.TRANSFERRED) &&
            delivery.settlementStatus !== 'completed'
          ) {
            needsUpdate = true;
            packagesSettled++;
            return { ...pkg, settledAt: new Date() };
          }

          // Marquer les retours comme retournés
          if (
            confirmReturns &&
            (pkg.status === PACKAGE_STATUS.FAILED || pkg.status === 'cancelled') &&
            pkg.returnStatus !== 'returned_to_agency'
          ) {
            needsUpdate = true;
            returnsProcessed++;
            return {
              ...pkg,
              returnStatus: 'returned_to_agency',
              returnedAt: new Date()
            };
          }

          return pkg;
        });

        if (needsUpdate) {
          deliveriesSettled++;
          deliveryIds.push(doc.id);
          
          batch.update(deliveryRef, {
            packages: updatedPackages,
            settlementStatus: 'completed',
            settledAt: new Date(),
            settledBy: adminId,
            updatedAt: new Date()
          });
        }
      });

      // 5. Créer l'enregistrement d'historique de versement
      const settlementRecord = {
        driverId,
        adminId,
        amountCollected,
        actualAmount,
        difference,
        debtGenerated: newDebtAmount,
        debtAction,
        previousDebt: currentDebt,
        newTotalDebt: currentDebt + newDebtAmount,
        deliveriesSettled,
        packagesSettled,
        returnsProcessed,
        deliveryIds,
        settledAt: new Date(),
        cashDetails: details.data.cashDetails,
        returnDetails: confirmReturns ? details.data.returnDetails : []
      };

      const settlementRef = db.collection('settlement_history').doc();
      batch.set(settlementRef, settlementRecord);

      // 6. Mettre à jour le solde de dette du livreur
      if (newDebtAmount > 0) {
        const driverRef = db.collection('users').doc(driverId);
        batch.update(driverRef, {
          debtBalance: (currentDebt + newDebtAmount),
          lastDebtUpdate: new Date(),
          updatedAt: new Date()
        });

        // 7. Créer un enregistrement de dette
        const debtRef = db.collection('driver_debts').doc();
        batch.set(debtRef, {
          driverId,
          amount: newDebtAmount,
          reason: 'settlement_shortage',
          settlementId: settlementRef.id,
          expectedAmount: actualAmount,
          collectedAmount: amountCollected,
          status: 'pending',
          createdAt: new Date(),
          createdBy: adminId
        });
      }

      // 8. Mettre à jour les demandes de réconciliation en attente
      const reconciliationSnapshot = await db.collection('reconciliation_requests')
        .where('deliveryManId', '==', driverId)
        .where('status', '==', 'pending')
        .get();

      reconciliationSnapshot.forEach(doc => {
        batch.update(doc.ref, {
          status: 'approved',
          approvedBy: adminId,
          approvedAt: new Date(),
          settlementId: settlementRef.id
        });
      });

      // 9. Exécuter toutes les mises à jour
      await batch.commit();

      // 10. Notifier le livreur
      let notificationBody = `Votre versement de ${amountCollected} XAF a été validé`;
      
      if (newDebtAmount > 0) {
        notificationBody += `. Une différence de ${newDebtAmount} XAF a été enregistrée comme dette et sera prélevée sur votre salaire`;
      } else if (difference < 0) {
        notificationBody += `. Vous avez versé ${Math.abs(difference)} XAF de plus que prévu`;
      }

      await NotificationService.createNotification({
        userId: driverId,
        title: newDebtAmount > 0 ? 'Versement validé - Dette enregistrée' : 'Versement validé',
        body: notificationBody,
        type: newDebtAmount > 0 ? 'settlement_with_debt' : 'settlement_approved',
        data: {
          settlementId: settlementRef.id,
          amountCollected,
          expectedAmount: actualAmount,
          difference,
          debtGenerated: newDebtAmount,
          newTotalDebt: currentDebt + newDebtAmount,
          packagesSettled,
          returnsProcessed
        }
      });

      return {
        success: true,
        message: newDebtAmount > 0 
          ? `Versement validé avec une dette de ${newDebtAmount} XAF enregistrée`
          : 'Versement validé avec succès',
        data: {
          settlementId: settlementRef.id,
          driverId,
          amountCollected,
          expectedAmount: actualAmount,
          difference,
          debtGenerated: newDebtAmount,
          previousDebt: currentDebt,
          newTotalDebt: currentDebt + newDebtAmount,
          deliveriesSettled,
          packagesSettled,
          returnsProcessed,
          settledAt: new Date()
        }
      };
    } catch (error) {
      console.error('Erreur validation versement:', error);
      throw error;
    }
  }

  // ==================== 4. Historique des versements ====================
  static async getSettlementHistory(driverId = null, startDate = null, endDate = null) {
    try {
      let query = db.collection('settlement_history');

      if (driverId) {
        query = query.where('driverId', '==', driverId);
      }

      if (startDate) {
        query = query.where('settledAt', '>=', startDate);
      }

      if (endDate) {
        query = query.where('settledAt', '<=', endDate);
      }

      const snapshot = await query.orderBy('settledAt', 'desc').get();

      const history = await Promise.all(
        snapshot.docs.map(async (doc) => {
          const data = doc.data();
          
          // Récupérer les infos du livreur
          const driverDoc = await db.collection('users').doc(data.driverId).get();
          const driverData = driverDoc.exists ? driverDoc.data() : null;

          // Récupérer les infos de l'admin
          const adminDoc = await db.collection('users').doc(data.adminId).get();
          const adminData = adminDoc.exists ? adminDoc.data() : null;

          return {
            id: doc.id,
            ...data,
            driverName: driverData?.name || 'Inconnu',
            adminName: adminData?.name || 'Inconnu'
          };
        })
      );

      return {
        success: true,
        data: history,
        summary: {
          totalSettlements: history.length,
          totalAmount: history.reduce((sum, s) => sum + s.amountCollected, 0),
          totalDebtGenerated: history.reduce((sum, s) => sum + (s.debtGenerated || 0), 0)
        }
      };
    } catch (error) {
      console.error('Erreur historique versements:', error);
      throw new Error('Erreur lors de la récupération de l\'historique des versements');
    }
  }

  // ==================== 5. Récupérer les dettes d'un livreur ====================
  static async getDriverDebts(driverId) {
    try {
      const debtsSnapshot = await db.collection('driver_debts')
        .where('driverId', '==', driverId)
        .orderBy('createdAt', 'desc')
        .get();

      const debts = debtsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      const pendingDebts = debts.filter(d => d.status === 'pending');
      const paidDebts = debts.filter(d => d.status === 'paid');

      return {
        success: true,
        data: {
          debts,
          summary: {
            totalPending: pendingDebts.reduce((sum, d) => sum + d.amount, 0),
            totalPaid: paidDebts.reduce((sum, d) => sum + d.amount, 0),
            count: debts.length,
            pendingCount: pendingDebts.length
          }
        }
      };
    } catch (error) {
      console.error('Erreur récupération dettes:', error);
      throw new Error('Erreur lors de la récupération des dettes');
    }
  }

  // ==================== 6. Marquer une dette comme payée (lors du paiement de salaire) ====================
  static async markDebtAsPaid(debtId, paidBy, paymentReference) {
    try {
      await db.collection('driver_debts').doc(debtId).update({
        status: 'paid',
        paidAt: new Date(),
        paidBy,
        paymentReference,
        updatedAt: new Date()
      });

      return {
        success: true,
        message: 'Dette marquée comme payée'
      };
    } catch (error) {
      console.error('Erreur marquage dette:', error);
      throw new Error('Erreur lors du marquage de la dette');
    }
  }
}

module.exports = AdminReconciliationService;