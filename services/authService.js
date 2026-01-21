
// ==================== 3. src/services/authService.js ====================
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { db } = require('../config/firebase');
const { cloudinary } = require('../config/cloudinary');
const User = require('../models/User');
const { DEFAULT_PASSWORD } = require('../config/constants');

class AuthService {
  static async login(phone, password) {
    console.log('🔍 Recherche utilisateur avec téléphone:', phone);
    
    const usersRef = db.collection('users');
    const snapshot = await usersRef.where('phone', '==', phone).limit(1).get();

    if (snapshot.empty) {
      console.log('❌ Aucun utilisateur trouvé avec ce téléphone');
      throw new Error('Identifiants incorrects');
    }

    const userDoc = snapshot.docs[0];
    const userData = userDoc.data();
    
    console.log('✅ Utilisateur trouvé:', userData.name, '- Role:', userData.role);

    if (!userData.isActive) {
      console.log('❌ Compte désactivé');
      throw new Error('Compte désactivé');
    }

    const passwordDoc = await db.collection('passwords')
      .doc(userDoc.id).get();
    
    if (!passwordDoc.exists) {
      console.log('❌ Pas de mot de passe configuré');
      throw new Error('Erreur de configuration du compte');
    }

    const isValid = await bcrypt.compare(
      password, 
      passwordDoc.data().hash
    );

    if (!isValid) {
      console.log('❌ Mot de passe incorrect');
      throw new Error('Identifiants incorrects');
    }

    console.log('✅ Mot de passe correct');

    const token = jwt.sign(
      { userId: userDoc.id, role: userData.role },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN }
    );

    const user = User.fromFirestore(userDoc);
    delete user.fcmToken;

    console.log('✅ Token généré, mustChangePassword:', userData.mustChangePassword);

    return {
      token,
      user,
      mustChangePassword: userData.mustChangePassword || false
    };
  }

  static async changePassword(userId, currentPassword, newPassword) {
    const passwordDoc = await db.collection('passwords').doc(userId).get();
    
    if (!passwordDoc.exists) {
      throw new Error('Erreur de configuration du compte');
    }

    const isValid = await bcrypt.compare(
      currentPassword,
      passwordDoc.data().hash
    );

    if (!isValid) {
      throw new Error('Mot de passe actuel incorrect');
    }

    const newHash = await bcrypt.hash(newPassword, 10);
    
    await db.collection('passwords').doc(userId).update({
      hash: newHash,
      updatedAt: new Date()
    });

    await db.collection('users').doc(userId).update({
      mustChangePassword: false,
      updatedAt: new Date()
    });

    return { message: 'Mot de passe modifié avec succès' };
  }

  static async createDeliveryMan(name, phone, matricule, documents) {
    const existingUser = await db.collection('users')
      .where('phone', '==', phone).get();
    
    if (!existingUser.empty) {
      throw new Error('Ce numéro de téléphone est déjà utilisé');
    }

    const documentsData = {
      permit: documents.permit ? {
        url: documents.permit.url,
        publicId: documents.permit.publicId,
        uploadedAt: new Date()
      } : null,
      cni: documents.cni ? {
        url: documents.cni.url,
        publicId: documents.cni.publicId,
        uploadedAt: new Date()
      } : null,
      contract: documents.contract ? {
        url: documents.contract.url,
        publicId: documents.contract.publicId,
        uploadedAt: new Date()
      } : null
    };

    const user = new User({
      name,
      phone,
      matricule,
      role: 'delivery_man',
      mustChangePassword: true,
      documents: documentsData
    });

    const missingDocuments = user.getMissingDocuments();
    if (missingDocuments.length > 0) {
      await this.cleanupCloudinaryFiles(documentsData);
      throw new Error(`Documents manquants: ${missingDocuments.join(', ')}`);
    }

    const userRef = await db.collection('users').add(user.toFirestore());
    
    const defaultHash = await bcrypt.hash(DEFAULT_PASSWORD, 10);
    await db.collection('passwords').doc(userRef.id).set({
      hash: defaultHash,
      createdAt: new Date()
    });

    return {
      id: userRef.id,
      ...user.toFirestore(),
      temporaryPassword: DEFAULT_PASSWORD,
      documentsStatus: {
        allDocumentsProvided: true,
        missingDocuments: []
      }
    };
  }

  static async updateDeliveryManDocuments(userId, documents) {
    const userDoc = await db.collection('users').doc(userId).get();
    
    if (!userDoc.exists) {
      throw new Error('Livreur non trouvé');
    }

    const userData = userDoc.data();
    const currentDocs = userData.documents || {};
    
    const updatedDocuments = { ...currentDocs };

    if (documents.permit) {
      if (currentDocs.permit?.publicId) {
        await this.deleteCloudinaryFile(currentDocs.permit.publicId);
      }
      updatedDocuments.permit = {
        url: documents.permit.url,
        publicId: documents.permit.publicId,
        uploadedAt: new Date()
      };
    }

    if (documents.cni) {
      if (currentDocs.cni?.publicId) {
        await this.deleteCloudinaryFile(currentDocs.cni.publicId);
      }
      updatedDocuments.cni = {
        url: documents.cni.url,
        publicId: documents.cni.publicId,
        uploadedAt: new Date()
      };
    }

    if (documents.contract) {
      if (currentDocs.contract?.publicId) {
        await this.deleteCloudinaryFile(currentDocs.contract.publicId);
      }
      updatedDocuments.contract = {
        url: documents.contract.url,
        publicId: documents.contract.publicId,
        uploadedAt: new Date()
      };
    }

    await db.collection('users').doc(userId).update({
      documents: updatedDocuments,
      updatedAt: new Date()
    });

    const tempUser = new User({ ...userData, documents: updatedDocuments });
    const missingDocuments = tempUser.getMissingDocuments();

    return {
      message: 'Documents mis à jour avec succès',
      documents: updatedDocuments,
      documentsStatus: {
        allDocumentsProvided: missingDocuments.length === 0,
        missingDocuments
      }
    };
  }

  static async deleteCloudinaryFile(publicId) {
    try {
      await cloudinary.uploader.destroy(publicId, { resource_type: 'auto' });
    } catch (error) {
      console.error('Erreur suppression Cloudinary:', error);
    }
  }

  static async cleanupCloudinaryFiles(documentsData) {
    const promises = [];
    
    if (documentsData.permit?.publicId) {
      promises.push(this.deleteCloudinaryFile(documentsData.permit.publicId));
    }
    if (documentsData.cni?.publicId) {
      promises.push(this.deleteCloudinaryFile(documentsData.cni.publicId));
    }
    if (documentsData.contract?.publicId) {
      promises.push(this.deleteCloudinaryFile(documentsData.contract.publicId));
    }
    
    await Promise.all(promises);
  }

  static async resetPassword(userId) {
    const defaultHash = await bcrypt.hash(DEFAULT_PASSWORD, 10);
    
    await db.collection('passwords').doc(userId).update({
      hash: defaultHash,
      updatedAt: new Date()
    });

    await db.collection('users').doc(userId).update({
      mustChangePassword: true,
      updatedAt: new Date()
    });

    return { 
      message: 'Mot de passe réinitialisé',
      temporaryPassword: DEFAULT_PASSWORD 
    };
  }
}

module.exports = AuthService;