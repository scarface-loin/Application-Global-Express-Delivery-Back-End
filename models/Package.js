
// ==================== src/models/Package.js (VERSION MISE À JOUR) ====================
class Package {
  constructor({
    id,
    trackingNumber,
    recipient,
    recipientPhone,
    destination, // Adresse complète ou ville de destination
    isOutOfTown = false, // Indique si c'est un transfert
    agencyName = null, // Nom de l'agence pour les transferts
    status = 'pending',
    amount = 0,
    weight = null, // Poids du colis
    description = '', // Description du contenu
    createdAt = new Date(),
    updatedAt = new Date()
  }) {
    this.id = id;
    this.trackingNumber = trackingNumber;
    this.recipient = recipient;
    this.recipientPhone = recipientPhone;
    this.destination = destination;
    this.isOutOfTown = isOutOfTown;
    this.agencyName = agencyName;
    this.status = status;
    this.amount = amount;
    this.weight = weight;
    this.description = description;
    this.createdAt = createdAt;
    this.updatedAt = updatedAt;
  }

  toObject() {
    return {
      id: this.id,
      trackingNumber: this.trackingNumber,
      recipient: this.recipient,
      recipientPhone: this.recipientPhone,
      destination: this.destination,
      isOutOfTown: this.isOutOfTown,
      agencyName: this.agencyName,
      status: this.status,
      amount: this.amount,
      weight: this.weight,
      description: this.description,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt
    };
  }
}

module.exports = Package;