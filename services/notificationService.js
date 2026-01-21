// ==================== src/services/NotificationService.js ====================
const { db, admin } = require('../config/firebase');
const Notification = require('../models/Notification');

class NotificationService {
  static async getUserNotifications(userId, limit = 50) {
    const snapshot = await db.collection('notifications')
      .where('userId', '==', userId)
      .orderBy('createdAt', 'desc')
      .limit(limit)
      .get();
    
    return snapshot.docs.map(doc => Notification.fromFirestore(doc));
  }

  static async markAsRead(notificationId, userId) {
    const notifRef = db.collection('notifications').doc(notificationId);
    const doc = await notifRef.get();
    
    if (!doc.exists) {
      throw new Error('Notification non trouvée');
    }
    
    if (doc.data().userId !== userId) {
      throw new Error('Accès refusé');
    }
    
    await notifRef.update({ isRead: true });
    
    return { message: 'Notification marquée comme lue' };
  }

  static async markAllAsRead(userId) {
    const snapshot = await db.collection('notifications')
      .where('userId', '==', userId)
      .where('isRead', '==', false)
      .get();
    
    const batch = db.batch();
    
    snapshot.docs.forEach(doc => {
      batch.update(doc.ref, { isRead: true });
    });
    
    await batch.commit();
    
    return { 
      message: 'Toutes les notifications marquées comme lues',
      count: snapshot.size 
    };
  }

  static async createNotification({ userId, title, body, type, data }) {
    const notification = new Notification({
      userId,
      title,
      body,
      type,
      data
    });
    
    const notifRef = await db.collection('notifications')
      .add(notification.toFirestore());
    
    // Envoyer la notification push si FCM token disponible
    const userDoc = await db.collection('users').doc(userId).get();
    const userData = userDoc.data();
    
    if (userData.fcmToken && userData.settings?.notifications) {
      try {
        await admin.messaging().send({
          token: userData.fcmToken,
          notification: { title, body },
          data: data || {}
        });
      } catch (error) {
        console.error('Erreur FCM:', error);
      }
    }
    
    return notifRef.id;
  }
}

module.exports = NotificationService;