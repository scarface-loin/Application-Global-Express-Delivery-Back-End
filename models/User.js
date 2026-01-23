// ==================== src/models/User.js ====================
class User {
  constructor({
    id,
    name,
    phone,
    matricule,
    role = 'delivery_man',
    createdAt = new Date(),
    updatedAt = new Date(),
    isActive = true,
    fcmToken = null,
    mustChangePassword = false,
    settings = {},
    documents = {},
    debtBalance = 0,
    lastDebtUpdate = null
  }) {
    this.id = id;
    this.name = name;
    this.phone = phone;
    this.matricule = matricule;
    this.role = role;
    this.createdAt = createdAt;
    this.updatedAt = updatedAt;
    this.isActive = isActive;
    this.fcmToken = fcmToken;
    this.mustChangePassword = mustChangePassword;
    this.settings = {
      notifications: true,
      darkMode: false,
      ...settings
    };
    this.documents = {
      permit: null,
      cni: null,
      contract: null,
      ...documents
    };
    this.debtBalance = debtBalance;
    this.lastDebtUpdate = lastDebtUpdate;
  }

  toFirestore() {
    return {
      name: this.name,
      phone: this.phone,
      matricule: this.matricule,
      role: this.role,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      isActive: this.isActive,
      fcmToken: this.fcmToken,
      mustChangePassword: this.mustChangePassword,
      settings: this.settings,
      documents: this.documents,
      debtBalance: this.debtBalance,
      lastDebtUpdate: this.lastDebtUpdate
    };
  }

  static fromFirestore(doc) {
    const data = doc.data();
    return new User({
      id: doc.id,
      ...data
    });
  }

  // Vérifier si tous les documents requis sont présents
  hasAllRequiredDocuments() {
    return this.documents.permit && 
           this.documents.cni && 
           this.documents.contract;
  }

  // Obtenir les documents manquants
  getMissingDocuments() {
    const missing = [];
    if (!this.documents.permit) missing.push('permit');
    if (!this.documents.cni) missing.push('cni');
    if (!this.documents.contract) missing.push('contract');
    return missing;
  }

  // Vérifier si le livreur a des dettes
  hasDebt() {
    return this.debtBalance > 0;
  }

  // Obtenir le solde de dette formaté
  getFormattedDebt() {
    return `${this.debtBalance.toLocaleString('fr-FR')} XAF`;
  }
}

module.exports = User;