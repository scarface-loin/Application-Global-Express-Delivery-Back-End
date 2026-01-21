// ==================== src/services/ProfileService.js ====================
const { db } = require('../config/firebase');
const User = require('../models/User');

class ProfileService {
  static async getUserProfile(userId) {
    const doc = await db.collection('users').doc(userId).get();
    
    if (!doc.exists) {
      throw new Error('Utilisateur non trouvé');
    }
    
    const user = User.fromFirestore(doc);
    delete user.fcmToken;
    
    return user;
  }

  static async updateUserProfile(userId, updates) {
    const allowedUpdates = ['name', 'settings'];
    const filteredUpdates = {};
    
    Object.keys(updates).forEach(key => {
      if (allowedUpdates.includes(key)) {
        filteredUpdates[key] = updates[key];
      }
    });
    
    filteredUpdates.updatedAt = new Date();
    
    await db.collection('users').doc(userId).update(filteredUpdates);
    
    return this.getUserProfile(userId);
  }

  static async updateFcmToken(userId, fcmToken) {
    await db.collection('users').doc(userId).update({
      fcmToken,
      updatedAt: new Date()
    });
    
    return { message: 'Token FCM mis à jour' };
  }
}

module.exports = ProfileService;