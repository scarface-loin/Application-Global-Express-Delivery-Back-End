import { db } from '../config/firebase.js';
import { 
  collection, 
  query, 
  where, 
  orderBy,
  getDocs,
  Timestamp,
  startOfDay,
  endOfDay,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth
} from 'firebase/firestore';
import { COLLECTIONS, PACKAGE_STATUS, DELIVERY_STATUS } from '../config/constants.js';

export class HistoryService {
  /**
   * Récupérer l'historique des livraisons d'un livreur
   */
  static async getDeliveryHistory(deliveryManId, period = 'week') {
    try {
      let startDate;
      const endDate = new Date();

      switch (period) {
        case 'day':
          startDate = startOfDay(endDate);
          break;
        case 'week':
          startDate = startOfWeek(endDate);
          break;
        case 'month':
          startDate = startOfMonth(endDate);
          break;
        default:
          startDate = new Date(endDate.getTime() - (7 * 24 * 60 * 60 * 1000)); // 7 jours par défaut
      }

      // Récupérer les livraisons complétées dans la période
      const q = query(
        collection(db, COLLECTIONS.DELIVERIES),
        where('deliveryManId', '==', deliveryManId),
        where('status', '==', DELIVERY_STATUS.COMPLETED),
        where('completedAt', '>=', Timestamp.fromDate(startDate)),
        where('completedAt', '<=', Timestamp.fromDate(endDate)),
        orderBy('completedAt', 'desc')
      );

      const querySnapshot = await getDocs(q);
      
      // Agréger les données par jour
      const historyMap = new Map();
      
      querySnapshot.forEach((doc) => {
        const delivery = doc.data();
        const deliveryDate = delivery.completedAt.toDate().toISOString().split('T')[0];
        
        if (!historyMap.has(deliveryDate)) {
          historyMap.set(deliveryDate, {
            date: deliveryDate,
            deliveries: 0,
            amount: 0,
            packages: 0
          });
        }
        
        const dayStats = historyMap.get(deliveryDate);
        dayStats.deliveries += 1;
        dayStats.amount += delivery.packages?.reduce((sum, pkg) => sum + (pkg.amount || 0), 0) || 0;
        dayStats.packages += delivery.packages?.length || 0;
      });

      // Convertir en tableau et trier par date
      const history = Array.from(historyMap.values())
        .sort((a, b) => new Date(b.date) - new Date(a.date));

      return history;
    } catch (error) {
      throw new Error(`Erreur lors de la récupération de l'historique: ${error.message}`);
    }
  }

  /**
   * Récupérer les statistiques générales
   */
  static async getStatistics(deliveryManId) {
    try {
      // Récupérer toutes les livraisons du livreur
      const q = query(
        collection(db, COLLECTIONS.DELIVERIES),
        where('deliveryManId', '==', deliveryManId)
      );

      const querySnapshot = await getDocs(q);
      
      let totalDeliveries = 0;
      let totalAmount = 0;
      let totalPackages = 0;
      let completedDeliveries = 0;
      let pendingDeliveries = 0;

      querySnapshot.forEach((doc) => {
        const delivery = doc.data();
        totalDeliveries++;
        
        if (delivery.status === DELIVERY_STATUS.COMPLETED) {
          completedDeliveries++;
          totalAmount += delivery.packages?.reduce((sum, pkg) => sum + (pkg.amount || 0), 0) || 0;
        } else if (delivery.status === DELIVERY_STATUS.PENDING || 
                   delivery.status === DELIVERY_STATUS.IN_PROGRESS) {
          pendingDeliveries++;
        }
        
        totalPackages += delivery.packages?.length || 0;
      });

      return {
        totalDeliveries,
        completedDeliveries,
        pendingDeliveries,
        totalAmount,
        totalPackages,
        successRate: totalDeliveries > 0 ? (completedDeliveries / totalDeliveries) * 100 : 0
      };
    } catch (error) {
      throw new Error(`Erreur lors de la récupération des statistiques: ${error.message}`);
    }
  }

  /**
   * Récupérer le revenu mensuel
   */
  static async getMonthlyEarnings(deliveryManId, year, month) {
    try {
      const startDate = new Date(year, month - 1, 1);
      const endDate = new Date(year, month, 0);

      const q = query(
        collection(db, COLLECTIONS.DELIVERIES),
        where('deliveryManId', '==', deliveryManId),
        where('status', '==', DELIVERY_STATUS.COMPLETED),
        where('completedAt', '>=', Timestamp.fromDate(startDate)),
        where('completedAt', '<=', Timestamp.fromDate(endDate)),
        orderBy('completedAt', 'asc')
      );

      const querySnapshot = await getDocs(q);
      
      // Agréger par jour
      const earningsByDay = new Map();
      const daysInMonth = new Date(year, month, 0).getDate();
      
      // Initialiser tous les jours du mois
      for (let day = 1; day <= daysInMonth; day++) {
        const dateStr = `${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
        earningsByDay.set(dateStr, 0);
      }

      // Ajouter les revenus réels
      querySnapshot.forEach((doc) => {
        const delivery = doc.data();
        const deliveryDate = delivery.completedAt.toDate().toISOString().split('T')[0];
        const dayAmount = delivery.packages?.reduce((sum, pkg) => sum + (pkg.amount || 0), 0) || 0;
        
        earningsByDay.set(deliveryDate, (earningsByDay.get(deliveryDate) || 0) + dayAmount);
      });

      // Convertir en tableau
      const earnings = Array.from(earningsByDay.entries()).map(([date, amount]) => ({
        date,
        amount
      }));

      const total = earnings.reduce((sum, day) => sum + day.amount, 0);

      return {
        earnings,
        total,
        average: daysInMonth > 0 ? total / daysInMonth : 0
      };
    } catch (error) {
      throw new Error(`Erreur lors de la récupération des revenus: ${error.message}`);
    }
  }
}