// ==================== src/config/constants.js ====================

// Rôles utilisateurs
const ROLES = {
  ADMIN: 'admin',
  DELIVERY_MAN: 'delivery_man',
  CLIENT: 'client'
};

// Mot de passe par défaut pour les nouveaux livreurs
const DEFAULT_PASSWORD = '0000';

// Types de livraison
const DELIVERY_TYPE = {
  LOCAL: 'local',      // Livraison en ville
  TRANSFER: 'transfer' // Transfert vers agence extérieure
};

// Statuts des colis
const PACKAGE_STATUS = {
  PENDING: 'pending',
  PICKED_UP: 'picked_up',
  IN_TRANSIT: 'in_transit',
  AT_AGENCY: 'at_agency',      // Nouveau: colis à l'agence
  TRANSFERRED: 'transferred',   // Nouveau: colis transféré
  DELIVERED: 'delivered',
  FAILED: 'failed'
};

// Statuts des livraisons
const DELIVERY_STATUS = {
  PENDING: 'pending',
  ASSIGNED: 'assigned',
  ACCEPTED: 'accepted',
  IN_PROGRESS: 'in_progress',
  TRANSFERRED: 'transferred',   // Nouveau: pour les transferts
  DELIVERED: 'delivered',
  CANCELLED: 'cancelled'
};

// Types de documents
const DOCUMENT_TYPES = {
  PERMIT: 'permit',
  CNI: 'cni',
  CONTRACT: 'contract',
  TRANSFER_RECEIPT: 'transfer_receipt'
};

// Dossiers Cloudinary
const CLOUDINARY_FOLDERS = {
  DELIVERY_MEN_DOCS: 'delivery-men-documents',
  TRANSFER_RECEIPTS: 'transfer-receipts',
  PACKAGE_IMAGES: 'package-images'
};

// Messages d'erreur communs
const ERROR_MESSAGES = {
  UNAUTHORIZED: 'Accès non autorisé',
  FORBIDDEN: 'Accès interdit',
  NOT_FOUND: 'Ressource non trouvée',
  VALIDATION_ERROR: 'Erreur de validation',
  SERVER_ERROR: 'Erreur serveur'
};

// Messages de succès
const SUCCESS_MESSAGES = {
  DELIVERY_CREATED: 'Livraison créée avec succès',
  DELIVERY_ASSIGNED: 'Livraison attribuée avec succès',
  DELIVERY_UPDATED: 'Livraison mise à jour avec succès',
  DELIVERYMAN_CREATED: 'Livreur créé avec succès',
  DELIVERYMAN_UPDATED: 'Livreur mis à jour avec succès'
};

// Exportation de toutes les constantes
module.exports = {
  ROLES,
  DEFAULT_PASSWORD,  // ← AJOUT ICI
  DELIVERY_TYPE,
  PACKAGE_STATUS,
  DELIVERY_STATUS,
  DOCUMENT_TYPES,
  CLOUDINARY_FOLDERS,
  ERROR_MESSAGES,
  SUCCESS_MESSAGES
};