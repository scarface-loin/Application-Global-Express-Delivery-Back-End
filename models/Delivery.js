const { DELIVERY_STATUS, PACKAGE_STATUS } = require('../config/constants');
const { AppError } = require('../utils/helpers');

class Delivery {
  constructor({
    id,
    deliveryManId = null,
    deliveryManName = null,
    packages = [],
    deliveryType = 'local',
    status = DELIVERY_STATUS.PENDING,
    assignedAt = null,
    acceptedAt = null,
    completedAt = null,
    transferredAt = null,
    receiptUrl = null,
    createdAt = new Date(),
    updatedAt = new Date(),
    totalAmount = 0,
    notes = '',
    clientInfo = {}
  }) {
    this.id = id;
    this.deliveryManId = deliveryManId;
    this.deliveryManName = deliveryManName;
    this.packages = packages;
    this.deliveryType = deliveryType;
    this.status = status;
    this.assignedAt = assignedAt;
    this.acceptedAt = acceptedAt;
    this.completedAt = completedAt;
    this.transferredAt = transferredAt;
    this.receiptUrl = receiptUrl;
    this.createdAt = createdAt;
    this.updatedAt = updatedAt;
    this.totalAmount = totalAmount;
    this.notes = notes;
    this.clientInfo = {
      name: clientInfo.name || '',
      phone: clientInfo.phone || '',
      address: clientInfo.address || ''
    };
  }

  // === Vérifier et mettre à jour le statut ===
  checkAndUpdateStatus() {
    if (this.packages.length === 0) {
      this.status = DELIVERY_STATUS.PENDING;
      return;
    }

    // Statuts finaux pour les colis
    const FINAL_PACKAGE_STATUSES = [
      PACKAGE_STATUS.DELIVERED,
      PACKAGE_STATUS.FAILED,
      PACKAGE_STATUS.TRANSFERRED,
      PACKAGE_STATUS.AT_AGENCY
    ];
    
    // Vérifier si TOUS les colis sont dans un statut final
    const allPackagesFinalized = this.packages.every(pkg => 
      FINAL_PACKAGE_STATUSES.includes(pkg.status)
    );

    // Vérifier si au moins un colis est "en cours"
    const IN_PROGRESS_PACKAGE_STATUSES = [
      PACKAGE_STATUS.PICKED_UP,
      PACKAGE_STATUS.IN_TRANSIT
    ];
    const hasInProgressPackages = this.packages.some(pkg => 
      IN_PROGRESS_PACKAGE_STATUSES.includes(pkg.status)
    );

    // Vérifier si au moins un colis est "pending"
    const hasPendingPackages = this.packages.some(pkg => 
      pkg.status === PACKAGE_STATUS.PENDING
    );

    // Logique de mise à jour du statut
    if (allPackagesFinalized) {
      // Tous les colis sont finalisés
      if (this.deliveryType === 'transfer' && 
          this.packages.every(pkg => pkg.status === PACKAGE_STATUS.TRANSFERRED || pkg.status === PACKAGE_STATUS.AT_AGENCY)) {
        this.status = DELIVERY_STATUS.TRANSFERRED;
        this.transferredAt = this.transferredAt || new Date();
      } else {
        this.status = DELIVERY_STATUS.DELIVERED;
        this.completedAt = this.completedAt || new Date();
      }
    } else if (hasInProgressPackages) {
      this.status = DELIVERY_STATUS.IN_PROGRESS;
    } else if (hasPendingPackages) {
      this.status = DELIVERY_STATUS.PENDING;
    } else if (this.packages.some(pkg => pkg.status === PACKAGE_STATUS.PICKED_UP)) {
      this.status = DELIVERY_STATUS.ACCEPTED;
    } else if (this.deliveryManId && !this.acceptedAt) {
      this.status = DELIVERY_STATUS.ASSIGNED;
    }

    this.updatedAt = new Date();
  }

  // === Mettre à jour un colis ===
  updatePackage(packageId, newStatus, additionalData = {}) {
    const packageIndex = this.packages.findIndex(pkg => pkg.id === packageId);
    
    if (packageIndex === -1) {
      throw new AppError('Colis non trouvé', 404);
    }

    // Validation du statut
    const validStatuses = Object.values(PACKAGE_STATUS);
    if (!validStatuses.includes(newStatus)) {
      throw new AppError(`Statut invalide. Statuts valides: ${validStatuses.join(', ')}`, 400);
    }

    // Mettre à jour le colis
    const now = new Date();
    this.packages[packageIndex] = {
      ...this.packages[packageIndex],
      status: newStatus,
      updatedAt: now,
      ...additionalData
    };

    // Vérifier et mettre à jour le statut global
    this.checkAndUpdateStatus();

    // Recalculer le montant total
    this.calculateTotalAmount();

    // Mettre à jour le timestamp
    this.updatedAt = now;

    return this.packages[packageIndex];
  }

  // === Calculer le montant total ===
  calculateTotalAmount() {
    // Seulement les colis livrés comptent dans le total
    this.totalAmount = this.packages
      .filter(pkg => pkg.status === PACKAGE_STATUS.DELIVERED)
      .reduce((sum, pkg) => sum + (parseFloat(pkg.amount) || 0), 0);
    
    return this.totalAmount;
  }

  // === Vérifier si la livraison est complète ===
  isComplete() {
    const FINAL_PACKAGE_STATUSES = [
      PACKAGE_STATUS.DELIVERED,
      PACKAGE_STATUS.FAILED,
      PACKAGE_STATUS.TRANSFERRED,
      PACKAGE_STATUS.AT_AGENCY
    ];
    
    return this.packages.length > 0 && 
           this.packages.every(pkg => FINAL_PACKAGE_STATUSES.includes(pkg.status));
  }

  // === Obtenir le résumé ===
  getPackagesSummary() {
    const summary = {
      total: this.packages.length,
      byStatus: {},
      isComplete: this.isComplete(),
      totalAmount: this.calculateTotalAmount()
    };
    
    this.packages.forEach(pkg => {
      if (!summary.byStatus[pkg.status]) {
        summary.byStatus[pkg.status] = 0;
      }
      summary.byStatus[pkg.status]++;
    });

    return summary;
  }

  // === Préparer pour Firestore ===
  toFirestore() {
    // Vérifier et mettre à jour le statut avant de sauvegarder
    this.checkAndUpdateStatus();
    
    return {
      deliveryManId: this.deliveryManId,
      deliveryManName: this.deliveryManName,
      packages: this.packages.map(pkg => ({
        id: pkg.id,
        trackingNumber: pkg.trackingNumber,
        recipient: pkg.recipient,
        recipientPhone: pkg.recipientPhone,
        destination: pkg.destination,
        isOutOfTown: pkg.isOutOfTown,
        agencyName: pkg.agencyName,
        status: pkg.status,
        amount: parseFloat(pkg.amount) || 0,
        weight: pkg.weight,
        description: pkg.description,
        createdAt: pkg.createdAt,
        updatedAt: pkg.updatedAt,
        // Données additionnelles
        ...(pkg.rejectionReason && { rejectionReason: pkg.rejectionReason }),
        ...(pkg.deliveryProof && { deliveryProof: pkg.deliveryProof }),
        ...(pkg.notes && { notes: pkg.notes }),
        ...(pkg.location && { location: pkg.location }),
        ...(pkg.recipientSignature && { recipientSignature: pkg.recipientSignature })
      })),
      deliveryType: this.deliveryType,
      status: this.status,
      assignedAt: this.assignedAt,
      acceptedAt: this.acceptedAt,
      completedAt: this.completedAt,
      transferredAt: this.transferredAt,
      receiptUrl: this.receiptUrl,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      totalAmount: this.totalAmount,
      notes: this.notes,
      clientInfo: this.clientInfo
    };
  }

  static fromFirestore(doc) {
    const data = doc.data();
    return new Delivery({
      id: doc.id,
      ...data
    });
  }
}

module.exports = Delivery;