class Package {
  constructor({
    id,
    trackingNumber,
    recipient,
    recipientPhone,
    destination,
    isOutOfTown = false,
    agencyName = null,
    status = 'pending',
    returnStatus = 'not_returned', // ✅ NOUVEAU CHAMP
    rejectionReason = null, // ✅ NOUVEAU (pour failed/cancelled)
    amount = 0,
    weight = null,
    description = '',
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
    this.returnStatus = returnStatus; // ✅ NOUVEAU
    this.rejectionReason = rejectionReason; // ✅ NOUVEAU
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
      returnStatus: this.returnStatus, // ✅ NOUVEAU
      rejectionReason: this.rejectionReason, // ✅ NOUVEAU
      amount: this.amount,
      weight: this.weight,
      description: this.description,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt
    };
  }
}

module.exports = Package;