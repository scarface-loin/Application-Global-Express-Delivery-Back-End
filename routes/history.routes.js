// ==================== src/services/HistoryService.js ====================
const { db } = require('../config/firebase');

class HistoryService {
  static async getDeliveryHistory(deliveryManId, startDate, endDate) {
    let query = db.collection('deliveries')
      .where('deliveryManId', '==', deliveryManId)
      .where('status', '==', 'delivered');
    
    if (startDate) {
      query = query.where('completedAt', '>=', new Date(startDate));
    }
    
    if (endDate) {
      query = query.where('completedAt', '<=', new Date(endDate));
    }
    
    const snapshot = await query.orderBy('completedAt', 'desc').get();
    
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
  }

  static async getStatistics(deliveryManId) {
    const deliveriesRef = db.collection('deliveries')
      .where('deliveryManId', '==', deliveryManId);
    
    const [total, delivered, inProgress, cancelled] = await Promise.all([
      deliveriesRef.count().get(),
      deliveriesRef.where('status', '==', 'delivered').count().get(),
      deliveriesRef.where('status', 'in', ['assigned', 'accepted', 'in_progress']).count().get(),
      deliveriesRef.where('status', '==', 'cancelled').count().get()
    ]);
    
    const deliveredSnapshot = await deliveriesRef
      .where('status', '==', 'delivered')
      .get();
    
    const totalEarnings = deliveredSnapshot.docs.reduce((sum, doc) => {
      return sum + (doc.data().totalAmount || 0);
    }, 0);
    
    return {
      totalDeliveries: total.data().count,
      delivered: delivered.data().count,
      inProgress: inProgress.data().count,
      cancelled: cancelled.data().count,
      totalEarnings,
      successRate: total.data().count > 0 
        ? ((delivered.data().count / total.data().count) * 100).toFixed(2)
        : 0
    };
  }

  static async getMonthlyEarnings(deliveryManId, year, month) {
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0, 23, 59, 59);
    
    const snapshot = await db.collection('deliveries')
      .where('deliveryManId', '==', deliveryManId)
      .where('status', '==', 'delivered')
      .where('completedAt', '>=', startDate)
      .where('completedAt', '<=', endDate)
      .get();
    
    const deliveries = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    
    const totalEarnings = deliveries.reduce((sum, delivery) => {
      return sum + (delivery.totalAmount || 0);
    }, 0);
    
    return {
      month,
      year,
      totalDeliveries: deliveries.length,
      totalEarnings,
      deliveries
    };
  }
}

module.exports = HistoryService;

// ==================== src/routes/auth.routes.js ====================
const express = require('express');
const router = express.Router();
const AuthService = require('../services/authService');
const { validateRequest, schemas } = require('../middleware/validation');

router.post('/login', validateRequest(schemas.login), async (req, res, next) => {
  try {
    const { phone, password } = req.body;
    const result = await AuthService.login(phone, password);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

router.post('/logout', (req, res) => {
  res.json({ message: 'Déconnexion réussie' });
});

module.exports = router;