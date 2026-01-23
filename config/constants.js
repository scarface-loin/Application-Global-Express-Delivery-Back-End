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
  AT_AGENCY: 'at_agency',      // Colis à l'agence
  TRANSFERRED: 'transferred',   // Colis transféré
  DELIVERED: 'delivered',
  FAILED: 'failed'
};

// Statuts des livraisons (MODIFIÉ)
const DELIVERY_STATUS = {
  PENDING: 'pending',           // Créée, en attente d'assignation
  ASSIGNED: 'assigned',         // Assignée à un livreur
  IN_PROGRESS: 'in_progress',   // Le livreur a commencé la livraison
  TRANSFERRED: 'transferred',   // Transfert effectué (avec reçu)
  DELIVERED: 'delivered',       // Livraison locale terminée
  FAILED: 'failed',             // Échec de livraison
  ISSUE_REPORTED: 'issue_reported', // Problème signalé
  CANCELLED: 'cancelled'        // Annulée
};

// Types de problèmes signalables
const ISSUE_TYPES = {
  ADDRESS_NOT_FOUND: 'address_not_found',
  RECIPIENT_UNAVAILABLE: 'recipient_unavailable',
  REFUSED_DELIVERY: 'refused_delivery',
  DAMAGED_PACKAGE: 'damaged_package',
  WRONG_ADDRESS: 'wrong_address',
  OTHER: 'other'
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
  SERVER_ERROR: 'Erreur serveur',
  INVALID_STATUS_TRANSITION: 'Transition de statut invalide',
  DELIVERY_NOT_ASSIGNED: 'Cette livraison ne vous est pas assignée',
  DELIVERY_ALREADY_STARTED: 'Cette livraison a déjà été commencée',
  CANNOT_START_DELIVERY: 'Cette livraison ne peut pas être commencée'
};

// Messages de succès
const SUCCESS_MESSAGES = {
  DELIVERY_CREATED: 'Livraison créée avec succès',
  DELIVERY_ASSIGNED: 'Livraison attribuée avec succès',
  DELIVERY_STARTED: 'Livraison commencée avec succès',
  DELIVERY_UPDATED: 'Livraison mise à jour avec succès',
  DELIVERY_COMPLETED: 'Livraison terminée avec succès',
  ISSUE_REPORTED: 'Problème signalé avec succès',
  DELIVERYMAN_CREATED: 'Livreur créé avec succès',
  DELIVERYMAN_UPDATED: 'Livreur mis à jour avec succès',
  PACKAGE_STATUS_UPDATED: 'Statut du colis mis à jour avec succès',
  RECEIPT_UPLOADED: 'Reçu de transfert uploadé avec succès'
};

// Transitions de statuts valides pour les livraisons
const VALID_DELIVERY_TRANSITIONS = {
  [DELIVERY_STATUS.PENDING]: [DELIVERY_STATUS.ASSIGNED, DELIVERY_STATUS.CANCELLED],
  [DELIVERY_STATUS.ASSIGNED]: [DELIVERY_STATUS.IN_PROGRESS, DELIVERY_STATUS.CANCELLED],
  [DELIVERY_STATUS.IN_PROGRESS]: [
    DELIVERY_STATUS.DELIVERED,
    DELIVERY_STATUS.TRANSFERRED,
    DELIVERY_STATUS.FAILED,
    DELIVERY_STATUS.ISSUE_REPORTED
  ],
  [DELIVERY_STATUS.DELIVERED]: [],
  [DELIVERY_STATUS.TRANSFERRED]: [],
  [DELIVERY_STATUS.FAILED]: [],
  [DELIVERY_STATUS.ISSUE_REPORTED]: [
    DELIVERY_STATUS.IN_PROGRESS,
    DELIVERY_STATUS.FAILED,
    DELIVERY_STATUS.CANCELLED
  ],
  [DELIVERY_STATUS.CANCELLED]: []
};

// Transitions de statuts valides pour les colis
const VALID_PACKAGE_TRANSITIONS = {
  [PACKAGE_STATUS.PENDING]: [PACKAGE_STATUS.PICKED_UP],
  [PACKAGE_STATUS.PICKED_UP]: [PACKAGE_STATUS.IN_TRANSIT, PACKAGE_STATUS.FAILED],
  [PACKAGE_STATUS.IN_TRANSIT]: [
    PACKAGE_STATUS.DELIVERED,
    PACKAGE_STATUS.AT_AGENCY,
    PACKAGE_STATUS.TRANSFERRED,
    PACKAGE_STATUS.FAILED
  ],
  [PACKAGE_STATUS.AT_AGENCY]: [PACKAGE_STATUS.TRANSFERRED],
  [PACKAGE_STATUS.TRANSFERRED]: [],
  [PACKAGE_STATUS.DELIVERED]: [],
  [PACKAGE_STATUS.FAILED]: [PACKAGE_STATUS.PENDING]
};

// Exportation de toutes les constantes
module.exports = {
  ROLES,
  DEFAULT_PASSWORD,
  DELIVERY_TYPE,
  PACKAGE_STATUS,
  DELIVERY_STATUS,
  ISSUE_TYPES,
  DOCUMENT_TYPES,
  CLOUDINARY_FOLDERS,
  ERROR_MESSAGES,
  SUCCESS_MESSAGES,
  VALID_DELIVERY_TRANSITIONS,
  VALID_PACKAGE_TRANSITIONS
};


// ==================== À AJOUTER DANS src/config/constants.js ====================

// Statuts de versement (Settlement)
const SETTLEMENT_STATUS = {
  PENDING: 'pending',       // En attente de versement
  COMPLETED: 'completed'    // Versement effectué et validé
};

// Statuts de retour des colis
const RETURN_STATUS = {
  NOT_RETURNED: 'not_returned',           // Pas encore retourné
  RETURNED_TO_AGENCY: 'returned_to_agency', // Retourné à l'agence
  RETURNED_TO_SENDER: 'returned_to_sender'  // Retourné à l'expéditeur
};

// Statuts des demandes de réconciliation
const RECONCILIATION_STATUS = {
  PENDING: 'pending',     // En attente de validation admin
  APPROVED: 'approved',   // Approuvée par admin
  REJECTED: 'rejected'    // Rejetée par admin
};

// ==================== MODIFIER L'EXPORT À LA FIN DU FICHIER ====================
// Ajouter ces nouvelles constantes dans module.exports :

module.exports = {
  ROLES,
  DEFAULT_PASSWORD,
  DELIVERY_TYPE,
  PACKAGE_STATUS,
  DELIVERY_STATUS,
  ISSUE_TYPES,
  DOCUMENT_TYPES,
  CLOUDINARY_FOLDERS,
  ERROR_MESSAGES,
  SUCCESS_MESSAGES,
  VALID_DELIVERY_TRANSITIONS,
  VALID_PACKAGE_TRANSITIONS,
  SETTLEMENT_STATUS,        // ✅ NOUVEAU
  RETURN_STATUS,            // ✅ NOUVEAU
  RECONCILIATION_STATUS     // ✅ NOUVEAU
};