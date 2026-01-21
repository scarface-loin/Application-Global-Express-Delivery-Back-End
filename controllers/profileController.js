import { ProfileService } from '../services/profileService.js';
import { AuthService } from '../services/authService.js';

export class ProfileController {
  /**
   * Récupérer le profil
   */
  static async getProfile(req, res) {
    try {
      const userId = req.user.uid;
      const profile = await ProfileService.getUserProfile(userId);
      
      res.json({
        success: true,
        data: profile
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Mettre à jour le profil
   */
  static async updateProfile(req, res) {
    try {
      const userId = req.user.uid;
      const updateData = req.body;
      
      const updatedProfile = await ProfileService.updateUserProfile(userId, updateData);
      
      res.json({
        success: true,
        message: 'Profil mis à jour avec succès',
        data: updatedProfile
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Changer le mot de passe
   */
  static async changePassword(req, res) {
    try {
      const userId = req.user.uid;
      const { oldPassword, newPassword } = req.body;
      
      const result = await AuthService.changePassword(userId, oldPassword, newPassword);
      
      res.json({
        success: true,
        message: result.message
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Mettre à jour les paramètres
   */
  static async updateSettings(req, res) {
    try {
      const userId = req.user.uid;
      const { settings } = req.body;
      
      const result = await ProfileService.updateUserSettings(userId, settings);
      
      res.json({
        success: true,
        message: 'Paramètres mis à jour avec succès',
        data: result
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Mettre à jour la photo de profil
   */
  static async updateProfilePicture(req, res) {
    try {
      const userId = req.user.uid;
      
      if (!req.file) {
        return res.status(400).json({
          success: false,
          error: 'Aucun fichier fourni'
        });
      }
      
      const result = await ProfileService.updateProfilePicture(userId, req.file);
      
      res.json({
        success: true,
        message: 'Photo de profil mise à jour avec succès',
        data: result
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Mettre à jour le token FCM
   */
  static async updateFCMToken(req, res) {
    try {
      const userId = req.user.uid;
      const { fcmToken } = req.body;
      
      const result = await ProfileService.updateFCMToken(userId, fcmToken);
      
      res.json({
        success: true,
        message: 'Token FCM mis à jour',
        data: result
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }
}