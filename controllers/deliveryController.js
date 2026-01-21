// ==================== src/controllers/deliveryController.js ====================
const { DeliveryService } = require('../services/deliveryService');
const { NotificationService } = require('../services/notificationService');
const { AppError } = require('../utils/helpers');
const { PACKAGE_STATUS, DELIVERY_STATUS, ROLES } = require('../config/constants');

class DeliveryController {
  /**
   * Récupérer toutes les livraisons (admin seulement)
   */
  static async getAllDeliveries(req, res, next) {
    try {
      const { status, deliveryType, deliveryManId, startDate, endDate } = req.query;

      // Vérifier les permissions (admin seulement)
      if (req.user.role !== ROLES.ADMIN) {
        throw new AppError('Accès non autorisé. Admin seulement.', 403);
      }

      const filters = {};
      if (status) filters.status = status;
      if (deliveryType) filters.deliveryType = deliveryType;
      if (deliveryManId) filters.deliveryManId = deliveryManId;
      if (startDate || endDate) {
        filters.dateRange = { startDate, endDate };
      }

      const deliveries = await DeliveryService.getAllDeliveries(filters);

      res.json({
        success: true,
        data: deliveries,
        count: deliveries.length,
        filters
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Récupérer les livraisons d'un livreur
   */
  static async getDeliveries(req, res, next) {
    try {
      const { status } = req.query;
      const userId = req.user.uid;

      const deliveries = await DeliveryService.getDeliveriesByDeliveryMan(userId, status);

      res.json({
        success: true,
        data: deliveries,
        count: deliveries.length
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Récupérer les livraisons disponibles (non assignées)
   */
  static async getAvailableDeliveries(req, res, next) {
    try {
      const deliveries = await DeliveryService.getAvailableDeliveries();

      res.json({
        success: true,
        data: deliveries,
        count: deliveries.length
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Récupérer une livraison spécifique
   */
  static async getDelivery(req, res, next) {
    try {
      const { id } = req.params;
      const userId = req.user.uid;
      const userRole = req.user.role;

      const delivery = await DeliveryService.getDeliveryById(id);

      // Vérifier les permissions
      if (userRole !== ROLES.ADMIN && delivery.deliveryManId !== userId) {
        throw new AppError('Accès refusé à cette livraison', 403);
      }

      res.json({
        success: true,
        data: delivery
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Créer une nouvelle livraison (admin seulement)
   */
  static async createDelivery(req, res, next) {
    try {
      // Vérifier les permissions
      if (req.user.role !== ROLES.ADMIN) {
        throw new AppError('Accès non autorisé. Admin seulement.', 403);
      }

      const adminId = req.user.uid;
      const deliveryData = req.body;

      const result = await DeliveryService.createDelivery(adminId, deliveryData);

      res.status(201).json({
        success: true,
        message: 'Livraison créée avec succès',
        data: result
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Assigner une livraison à un livreur (admin seulement)
   */
  static async assignDelivery(req, res, next) {
    try {
      // Vérifier les permissions
      if (req.user.role !== ROLES.ADMIN) {
        throw new AppError('Accès non autorisé. Admin seulement.', 403);
      }

      const { deliveryId } = req.params;
      const { deliveryManId } = req.body;

      if (!deliveryManId) {
        throw new AppError('L\'ID du livreur est requis', 400);
      }

      const result = await DeliveryService.assignDelivery(deliveryId, deliveryManId);

      res.json({
        success: true,
        message: 'Livraison assignée avec succès',
        data: result
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Accepter une livraison (livreur seulement)
   */
  static async acceptDelivery(req, res, next) {
    try {
      const { id } = req.params;
      const userId = req.user.uid;
      const userName = req.user.profile?.name;

      const result = await DeliveryService.acceptDelivery(id, userId, userName);

      res.json(result);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Mettre à jour le statut d'un colis (livreur seulement)
   */
  static async updatePackageStatus(req, res, next) {
    try {
      const { deliveryId, packageId } = req.params;
      const {
        status,
        rejectionReason,
        deliveryProof,
        notes,
        location,
        recipientSignature,
        agencyName,
        recipientName,
        recipientPhone
      } = req.body;

      const deliveryManId = req.user.uid;
      const deliveryManName = req.user.profile?.name;

      // Validation basique
      if (!status) {
        throw new AppError('Le statut est requis', 400);
      }

      // Préparer les données additionnelles
      const additionalData = {};
      if (rejectionReason) additionalData.rejectionReason = rejectionReason;
      if (deliveryProof) additionalData.deliveryProof = deliveryProof;
      if (notes) additionalData.notes = notes;
      if (location) additionalData.location = location;
      if (recipientSignature) additionalData.recipientSignature = recipientSignature;
      if (agencyName) additionalData.agencyName = agencyName;
      if (recipientName) additionalData.recipient = recipientName;
      if (recipientPhone) additionalData.recipientPhone = recipientPhone;

      const result = await DeliveryService.updatePackageStatus(
        deliveryId,
        packageId,
        deliveryManId,
        status,
        additionalData
      );

      res.json(result);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Mettre à jour le statut d'une livraison
   */
  static async updateDeliveryStatus(req, res, next) {
    try {
      const { id } = req.params;
      const { status } = req.body;
      const userId = req.user.uid;
      const userRole = req.user.role;

      // Si ce n'est pas un admin, vérifier que c'est le livreur assigné
      if (userRole !== ROLES.ADMIN) {
        const delivery = await DeliveryService.getDeliveryById(id);
        if (delivery.deliveryManId !== userId) {
          throw new AppError('Accès refusé. Vous n\'êtes pas assigné à cette livraison.', 403);
        }
      }

      const result = await DeliveryService.updateDeliveryStatus(id, userId, status);

      res.json({
        success: true,
        message: 'Statut de livraison mis à jour',
        data: result
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Upload du reçu de transfert (livreur seulement)
   */
  static async uploadTransferReceipt(req, res, next) {
    try {
      const { deliveryId } = req.params;
      const deliveryManId = req.user.uid;

      if (!req.file) {
        throw new AppError('Le fichier de reçu est requis', 400);
      }

      const result = await DeliveryService.uploadTransferReceipt(
        deliveryId,
        deliveryManId,
        req.file
      );

      res.json({
        success: true,
        message: 'Reçu de transfert uploadé avec succès',
        data: result
      });
    } catch (error) {
      // Nettoyer le fichier en cas d'erreur
      if (req.file && req.file.path) {
        // Vous pourriez ajouter ici une logique pour supprimer le fichier uploadé
      }
      next(error);
    }
  }

  /**
   * Rechercher un colis par numéro de suivi
   */
  static async trackPackage(req, res, next) {
    try {
      const { trackingNumber } = req.params;

      if (!trackingNumber) {
        throw new AppError('Le numéro de suivi est requis', 400);
      }

      const result = await DeliveryService.trackPackage(trackingNumber);

      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Supprimer/annuler une livraison (admin seulement)
   */
  static async deleteDelivery(req, res, next) {
    try {
      // Vérifier les permissions
      if (req.user.role !== ROLES.ADMIN) {
        throw new AppError('Accès non autorisé. Admin seulement.', 403);
      }

      const { deliveryId } = req.params;

      const result = await DeliveryService.deleteDelivery(deliveryId);

      res.json({
        success: true,
        message: 'Livraison annulée avec succès',
        data: result
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Obtenir les statistiques d'une livraison
   */
  static async getDeliveryStats(req, res, next) {
    try {
      const { deliveryId } = req.params;
      const userId = req.user.uid;
      const userRole = req.user.role;

      // Vérifier les permissions
      if (userRole !== ROLES.ADMIN) {
        const delivery = await DeliveryService.getDeliveryById(deliveryId);
        if (delivery.deliveryManId !== userId) {
          throw new AppError('Accès refusé à cette livraison', 403);
        }
      }

      const result = await DeliveryService.getDeliveryStats(deliveryId);

      res.json(result);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Obtenir les statistiques d'un livreur
   */
  static async getDeliveryManStats(req, res, next) {
    try {
      const deliveryManId = req.user.uid;

      // Si admin, peut consulter les stats d'un autre livreur
      const targetDeliveryManId = req.user.role === ROLES.ADMIN
        ? (req.params.deliveryManId || deliveryManId)
        : deliveryManId;

      const stats = await DeliveryService.getDeliveryManStats(targetDeliveryManId);

      res.json({
        success: true,
        data: stats
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Signaler un problème sur une livraison (livreur seulement)
   */
  static async reportDeliveryIssue(req, res, next) {
    try {
      const { deliveryId } = req.params;
      const deliveryManId = req.user.uid;
      const { issueType, description, packageId, images } = req.body;

      if (!issueType || !description) {
        throw new AppError('Le type de problème et la description sont requis', 400);
      }

      const issueData = {
        issueType,
        description,
        reportedBy: deliveryManId,
        reportedByName: req.user.profile?.name,
        packageId,
        images: images || [],
        timestamp: new Date().toISOString()
      };

      const result = await DeliveryService.reportDeliveryIssue(
        deliveryId,
        deliveryManId,
        issueData
      );

      res.json({
        success: true,
        message: 'Problème signalé avec succès',
        data: result
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Obtenir les livraisons assignées (admin seulement)
   */
  static async getAssignedDeliveries(req, res, next) {
    try {
      // Vérifier les permissions
      if (req.user.role !== ROLES.ADMIN) {
        throw new AppError('Accès non autorisé. Admin seulement.', 403);
      }

      const deliveries = await DeliveryService.getAssignedDeliveries();

      res.json({
        success: true,
        data: deliveries,
        count: deliveries.length
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Obtenir les détails d'une livraison pour suivi public
   */
  static async getPublicDeliveryDetails(req, res, next) {
    try {
      const { trackingNumber } = req.params;

      if (!trackingNumber) {
        throw new AppError('Le numéro de suivi est requis', 400);
      }

      const result = await DeliveryService.trackPackage(trackingNumber);

      // Filtrer les informations sensibles pour le public
      const publicInfo = {
        delivery: {
          id: result.delivery.id,
          status: result.delivery.status,
          deliveryType: result.delivery.deliveryType,
          createdAt: result.delivery.createdAt
        },
        package: {
          trackingNumber: result.package.trackingNumber,
          recipient: result.package.recipient,
          destination: result.package.destination,
          status: result.package.status,
          updatedAt: result.package.updatedAt
        }
      };

      res.json({
        success: true,
        data: publicInfo
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Mettre à jour les informations d'un colis (admin seulement)
   */
  static async updatePackageInfo(req, res, next) {
    try {
      // Vérifier les permissions
      if (req.user.role !== ROLES.ADMIN) {
        throw new AppError('Accès non autorisé. Admin seulement.', 403);
      }

      const { deliveryId, packageId } = req.params;
      const updateData = req.body;

      const result = await DeliveryService.updatePackageInfo(deliveryId, packageId, updateData);

      res.json({
        success: true,
        message: 'Informations du colis mises à jour',
        data: result
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Exporter les livraisons (admin seulement)
   */
  static async exportDeliveries(req, res, next) {
    try {
      // Vérifier les permissions
      if (req.user.role !== ROLES.ADMIN) {
        throw new AppError('Accès non autorisé. Admin seulement.', 403);
      }

      const { format = 'csv', startDate, endDate, status } = req.query;

      const result = await DeliveryService.exportDeliveries({
        format,
        startDate,
        endDate,
        status
      });

      // Définir les headers selon le format
      if (format === 'csv') {
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename=deliveries_${Date.now()}.csv`);
        res.send(result);
      } else if (format === 'excel') {
        res.setHeader('Content-Type', 'application/vnd.ms-excel');
        res.setHeader('Content-Disposition', `attachment; filename=deliveries_${Date.now()}.xlsx`);
        res.send(result);
      } else {
        res.json({
          success: true,
          data: result
        });
      }
    } catch (error) {
      next(error);
    }
  }


  // ==================== MÉTHODES SUPPLÉMENTAIRES POUR LES NOUVELLES ROUTES ====================

  /**
   * Démarrer une livraison (mettre en "in_progress")
   */
  static async startDelivery(req, res, next) {
    try {
      const { id } = req.params;
      const userId = req.user.uid;

      const result = await DeliveryService.updateDeliveryStatus(id, userId, 'in_progress');

      res.json({
        success: true,
        message: 'Livraison démarrée',
        data: result
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Compléter manuellement une livraison
   */
  static async completeDelivery(req, res, next) {
    try {
      const { id } = req.params;
      const userId = req.user.uid;

      const result = await DeliveryService.updateDeliveryStatus(id, userId, 'delivered');

      res.json({
        success: true,
        message: 'Livraison marquée comme complète',
        data: result
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Obtenir l'historique d'une livraison
   */
  static async getDeliveryHistory(req, res, next) {
    try {
      const { id } = req.params;

      const result = await DeliveryService.getDeliveryHistory(id);

      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Réassigner une livraison
   */
  static async reassignDelivery(req, res, next) {
    try {
      const { deliveryId } = req.params;
      const { newDeliveryManId } = req.body;

      if (!newDeliveryManId) {
        throw new AppError('L\'ID du nouveau livreur est requis', 400);
      }

      const result = await DeliveryService.reassignDelivery(deliveryId, newDeliveryManId);

      res.json({
        success: true,
        message: 'Livraison réassignée avec succès',
        data: result
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Obtenir les colis par statut
   */
  static async getPackagesByStatus(req, res, next) {
    try {
      const { status } = req.params;
      const { page = 1, limit = 20 } = req.query;

      const result = await DeliveryService.getPackagesByStatus(status, parseInt(page), parseInt(limit));

      res.json({
        success: true,
        data: result.packages,
        pagination: result.pagination
      });
    } catch (error) {
      next(error);
    }
  }
}



module.exports = DeliveryController;