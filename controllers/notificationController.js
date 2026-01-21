import { NotificationService } from '../services/notificationService.js';

export class NotificationController {
  /**
   * Récupérer les notifications
   */
  static async getNotifications(req, res) {
    try {
      const userId = req.user.uid;
      const notifications = await NotificationService.getUserNotifications(userId);
      
      res.json({
        success: true,
        data: notifications,
        unreadCount: notifications.filter(n => !n.read).length
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Marquer une notification comme lue
   */
  static async markAsRead(req, res) {
    try {
      const { id } = req.params;
      const result = await NotificationService.markNotificationAsRead(id);
      
      res.json({
        success: true,
        message: 'Notification marquée comme lue',
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
   * Marquer toutes les notifications comme lues
   */
  static async markAllAsRead(req, res) {
    try {
      const userId = req.user.uid;
      const result = await NotificationService.markAllNotificationsAsRead(userId);
      
      res.json({
        success: true,
        message: `${result.count} notifications marquées comme lues`,
        data: result
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Créer une notification
   */
  static async createNotification(req, res) {
    try {
      const userId = req.user.uid;
      const { title, message, type, data } = req.body;
      
      const result = await NotificationService.createNotification(userId, {
        title,
        message,
        type,
        data
      });

      res.status(201).json({
        success: true,
        message: 'Notification créée avec succès',
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