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
          totalPendingReturns: driversWithBalance.reduce((sum, d) => sum + d.pendingReturns, 0)
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

  // ==================== 3. Valider le versement ====================
  static async settleDriverPayment(adminId, driverId, amountCollected, confirmReturns = true) {
    try {
      // 1. Récupérer les détails pour validation
      const details = await this.getDriverSettlementDetails(driverId);
      const actualAmount = details.data.summary.totalCash;

      // 2. Vérifier la correspondance des montants (tolérance de 100 XAF)
      const difference = Math.abs(actualAmount - amountCollected);
      if (difference > 100) {
        throw new Error(
          `Montant collecté (${amountCollected} XAF) ne correspond pas au montant attendu (${actualAmount} XAF). Différence: ${difference} XAF`
        );
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
        difference: actualAmount - amountCollected,
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

      // 6. Mettre à jour les demandes de réconciliation en attente
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

      // 7. Exécuter toutes les mises à jour
      await batch.commit();

      // 8. Notifier le livreur
      await NotificationService.createNotification({
        userId: driverId,
        title: 'Versement validé',
        body: `Votre versement de ${amountCollected} XAF a été validé par l'administrateur`,
        type: 'settlement_approved',
        data: {
          settlementId: settlementRef.id,
          amountCollected,
          packagesSettled,
          returnsProcessed
        }
      });

      return {
        success: true,
        message: 'Versement validé avec succès',
        data: {
          settlementId: settlementRef.id,
          driverId,
          amountSettled: amountCollected,
          actualAmount,
          difference: actualAmount - amountCollected,
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

  // ==================== BONUS: Historique des versements ====================
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
          totalAmount: history.reduce((sum, s) => sum + s.amountCollected, 0)
        }
      };
    } catch (error) {
      console.error('Erreur historique versements:', error);
      throw new Error('Erreur lors de la récupération de l\'historique des versements');
    }
  }
}

module.exports = AdminReconciliationService;