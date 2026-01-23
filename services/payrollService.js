// ==================== src/services/payrollService.js ====================
const { db } = require('../config/firebase');
const AdminReconciliationService = require('./adminReconciliationService');
const NotificationService = require('./notificationService');

class PayrollService {
  /**
   * Calculer le salaire d'un livreur avec déduction des dettes
   */
  static async calculateDriverSalary(driverId, baseSalary, period = {}) {
    try {
      const { startDate, endDate } = period;

      // 1. Récupérer les informations du livreur
      const driverDoc = await db.collection('users').doc(driverId).get();
      if (!driverDoc.exists) {
        throw new Error('Livreur non trouvé');
      }

      const driverData = driverDoc.data();
      const currentDebt = driverData.debtBalance || 0;

      // 2. Récupérer les dettes en attente
      const debtsResult = await AdminReconciliationService.getDriverDebts(driverId);
      const pendingDebts = debtsResult.data.debts.filter(d => d.status === 'pending');

      // 3. Calculer les performances (optionnel - pour bonus)
      let query = db.collection('deliveries')
        .where('deliveryManId', '==', driverId)
        .where('status', '==', 'delivered');

      if (startDate) {
        query = query.where('completedAt', '>=', new Date(startDate));
      }
      if (endDate) {
        query = query.where('completedAt', '<=', new Date(endDate));
      }

      const deliveriesSnapshot = await query.get();
      let totalDelivered = 0;
      let totalAmount = 0;

      deliveriesSnapshot.forEach(doc => {
        const delivery = doc.data();
        delivery.packages.forEach(pkg => {
          if (pkg.status === 'delivered') {
            totalDelivered++;
            totalAmount += parseFloat(pkg.amount) || 0;
          }
        });
      });

      // 4. Calculer le salaire net
      const grossSalary = baseSalary;
      const debtDeduction = Math.min(currentDebt, grossSalary * 0.3); // Maximum 30% du salaire
      const netSalary = grossSalary - debtDeduction;
      const remainingDebt = currentDebt - debtDeduction;

      return {
        success: true,
        data: {
          driverId,
          driverName: driverData.name,
          period: { startDate, endDate },
          grossSalary,
          deductions: {
            debt: debtDeduction,
            remainingDebt
          },
          netSalary,
          performance: {
            totalDelivered,
            totalAmount
          },
          pendingDebts: pendingDebts.map(d => ({
            id: d.id,
            amount: d.amount,
            reason: d.reason,
            createdAt: d.createdAt
          }))
        }
      };
    } catch (error) {
      console.error('Erreur calcul salaire:', error);
      throw error;
    }
  }

  /**
   * Effectuer le paiement du salaire avec déduction des dettes
   */
  static async processSalaryPayment(adminId, driverId, baseSalary, paymentReference) {
    try {
      // 1. Calculer le salaire
      const calculation = await this.calculateDriverSalary(driverId, baseSalary);
      const { grossSalary, deductions, netSalary } = calculation.data;

      // 2. Créer l'enregistrement de paie
      const payrollRef = db.collection('payroll_history').doc();
      const payrollRecord = {
        driverId,
        adminId,
        grossSalary,
        debtDeduction: deductions.debt,
        netSalary,
        paymentReference,
        processedAt: new Date(),
        status: 'paid'
      };

      await payrollRef.set(payrollRecord);

      // 3. Marquer les dettes comme payées proportionnellement
      if (deductions.debt > 0) {
        const pendingDebtsSnapshot = await db.collection('driver_debts')
          .where('driverId', '==', driverId)
          .where('status', '==', 'pending')
          .orderBy('createdAt', 'asc')
          .get();

        const batch = db.batch();
        let remainingDeduction = deductions.debt;
        const paidDebts = [];

        for (const debtDoc of pendingDebtsSnapshot.docs) {
          if (remainingDeduction <= 0) break;

          const debtData = debtDoc.data();
          const debtAmount = debtData.amount;

          if (debtAmount <= remainingDeduction) {
            // Dette entièrement payée
            batch.update(debtDoc.ref, {
              status: 'paid',
              paidAt: new Date(),
              paidBy: adminId,
              paymentReference: `SALARY_${payrollRef.id}`,
              updatedAt: new Date()
            });
            paidDebts.push({ id: debtDoc.id, amount: debtAmount, fullyPaid: true });
            remainingDeduction -= debtAmount;
          } else {
            // Dette partiellement payée - créer une nouvelle dette pour le reste
            batch.update(debtDoc.ref, {
              status: 'paid',
              paidAt: new Date(),
              paidBy: adminId,
              paymentReference: `SALARY_${payrollRef.id}`,
              originalAmount: debtAmount,
              paidAmount: remainingDeduction,
              updatedAt: new Date()
            });

            // Créer une nouvelle dette pour le montant restant
            const newDebtRef = db.collection('driver_debts').doc();
            batch.set(newDebtRef, {
              ...debtData,
              amount: debtAmount - remainingDeduction,
              reason: `${debtData.reason} (Solde restant)`,
              originalDebtId: debtDoc.id,
              createdAt: new Date()
            });

            paidDebts.push({ 
              id: debtDoc.id, 
              amount: remainingDeduction, 
              fullyPaid: false,
              remainingAmount: debtAmount - remainingDeduction
            });
            remainingDeduction = 0;
          }
        }

        // 4. Mettre à jour le solde du livreur
        const driverRef = db.collection('users').doc(driverId);
        batch.update(driverRef, {
          debtBalance: deductions.remainingDebt,
          lastDebtUpdate: new Date(),
          updatedAt: new Date()
        });

        await batch.commit();

        // 5. Notifier le livreur
        await NotificationService.createNotification({
          userId: driverId,
          title: 'Salaire payé',
          body: `Votre salaire de ${netSalary.toLocaleString('fr-FR')} XAF a été versé. ${deductions.debt > 0 ? `Dette déduite: ${deductions.debt.toLocaleString('fr-FR')} XAF` : ''}`,
          type: 'salary_paid',
          data: {
            payrollId: payrollRef.id,
            grossSalary,
            debtDeduction: deductions.debt,
            netSalary,
            paidDebts
          }
        });

        return {
          success: true,
          message: 'Salaire payé avec succès',
          data: {
            payrollId: payrollRef.id,
            grossSalary,
            debtDeduction: deductions.debt,
            netSalary,
            paidDebts,
            remainingDebt: deductions.remainingDebt
          }
        };
      } else {
        // Pas de dette à déduire
        await NotificationService.createNotification({
          userId: driverId,
          title: 'Salaire payé',
          body: `Votre salaire de ${netSalary.toLocaleString('fr-FR')} XAF a été versé.`,
          type: 'salary_paid',
          data: {
            payrollId: payrollRef.id,
            grossSalary,
            netSalary
          }
        });

        return {
          success: true,
          message: 'Salaire payé avec succès',
          data: {
            payrollId: payrollRef.id,
            grossSalary,
            netSalary,
            debtDeduction: 0
          }
        };
      }
    } catch (error) {
      console.error('Erreur paiement salaire:', error);
      throw error;
    }
  }

  /**
   * Obtenir l'historique des paies d'un livreur
   */
  static async getDriverPayrollHistory(driverId, startDate = null, endDate = null) {
    try {
      let query = db.collection('payroll_history')
        .where('driverId', '==', driverId);

      if (startDate) {
        query = query.where('processedAt', '>=', new Date(startDate));
      }
      if (endDate) {
        query = query.where('processedAt', '<=', new Date(endDate));
      }

      const snapshot = await query.orderBy('processedAt', 'desc').get();

      const history = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      const totalGross = history.reduce((sum, p) => sum + p.grossSalary, 0);
      const totalDeductions = history.reduce((sum, p) => sum + (p.debtDeduction || 0), 0);
      const totalNet = history.reduce((sum, p) => sum + p.netSalary, 0);

      return {
        success: true,
        data: history,
        summary: {
          count: history.length,
          totalGross,
          totalDeductions,
          totalNet
        }
      };
    } catch (error) {
      console.error('Erreur historique paies:', error);
      throw error;
    }
  }
}

module.exports = PayrollService;