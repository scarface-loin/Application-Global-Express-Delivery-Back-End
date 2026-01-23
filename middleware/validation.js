// ==================== src/middleware/validation.js ====================
const Joi = require('joi');

const validateRequest = (schema) => {
  return (req, res, next) => {
    // Logs de débogage
    console.log('📦 Body reçu:', JSON.stringify(req.body, null, 2));
    
    const { error } = schema.validate(req.body, { abortEarly: false });

    if (error) {
      console.error('❌ Erreurs de validation:', error.details);
      
      const errors = error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message,
        value: detail.context.value
      }));
      
      return res.status(400).json({ 
        errors,
        receivedData: req.body
      });
    }

    next();
  };
};

// Pattern de téléphone acceptant le + optionnel
const phonePattern = /^\+?[0-9]{9,15}$/;

const schemas = {
  login: Joi.object({
    phone: Joi.string().pattern(phonePattern).required()
      .messages({
        'string.pattern.base': 'Le numéro de téléphone doit contenir entre 9 et 15 chiffres (le + est optionnel)'
      }),
    password: Joi.string().min(4).required()
      .messages({
        'string.min': 'Le mot de passe doit contenir au moins 4 caractères'
      })
  }),

  createDeliveryMan: Joi.object({
    name: Joi.string().min(2).max(100).required(),
    phone: Joi.string().pattern(phonePattern).required()
      .messages({
        'string.pattern.base': 'Le numéro de téléphone doit contenir entre 9 et 15 chiffres'
      }),
    matricule: Joi.string().required()
  }),

  updateProfile: Joi.object({
    name: Joi.string().min(2).max(100),
    settings: Joi.object({
      notifications: Joi.boolean(),
      darkMode: Joi.boolean()
    })
  }),

  changePassword: Joi.object({
    currentPassword: Joi.string().required(),
    newPassword: Joi.string().min(4).required()
  }),

  // MODIFIÉ : Suppression de 'accepted', ajout de 'failed' et 'issue_reported'
  updateDeliveryStatus: Joi.object({
    status: Joi.string().valid(
      'pending',
      'assigned',
      'in_progress',
      'delivered',
      'transferred',
      'failed',
      'issue_reported',
      'cancelled'
    ).required()
      .messages({
        'any.only': 'Statut invalide. Statuts autorisés : pending, assigned, in_progress, delivered, transferred, failed, issue_reported, cancelled'
      })
  }),

  assignDelivery: Joi.object({
    deliveryManId: Joi.string().required()
  }),

  createDelivery: Joi.object({
    deliveryType: Joi.string().valid('local', 'transfer').required(),
    clientInfo: Joi.object({
      name: Joi.string().min(2).required(),
      phone: Joi.string().pattern(phonePattern).required()
        .messages({
          'string.pattern.base': 'Le numéro de téléphone du client doit contenir entre 9 et 15 chiffres'
        }),
      address: Joi.string().allow('', null).optional()
    }).required(),
    packages: Joi.array().min(1).items(
      Joi.object({
        recipient: Joi.string().min(2).required(),
        recipientPhone: Joi.string().pattern(phonePattern).required()
          .messages({
            'string.pattern.base': 'Le numéro de téléphone du destinataire doit contenir entre 9 et 15 chiffres'
          }),
        destination: Joi.string().min(3).required(),
        isOutOfTown: Joi.boolean().default(false),
        agencyName: Joi.string().allow(null, '').optional(),
        amount: Joi.number().positive().required(),
        weight: Joi.number().positive().allow(null).optional(),
        description: Joi.string().allow('', null).optional()
      })
    ).required(),
    notes: Joi.string().allow('', null).optional()
  }),

  // AJOUTÉ : Validation pour signaler un problème
  reportIssue: Joi.object({
    issueType: Joi.string().valid(
      'address_not_found',
      'recipient_unavailable',
      'refused_delivery',
      'damaged_package',
      'wrong_address',
      'other'
    ).required()
      .messages({
        'any.only': 'Type de problème invalide'
      }),
    description: Joi.string().min(10).max(500).required()
      .messages({
        'string.min': 'La description doit contenir au moins 10 caractères',
        'string.max': 'La description ne peut pas dépasser 500 caractères'
      })
  }),

  // AJOUTÉ : Validation pour mettre à jour le statut d'un colis
  updatePackageStatus: Joi.object({
    status: Joi.string().valid(
      'pending',
      'picked_up',
      'in_transit',
      'delivered',
      'failed',
      'transferred',
      'at_agency'
    ).required()
      .messages({
        'any.only': 'Statut de colis invalide. Statuts autorisés : pending, picked_up, in_transit, delivered, failed, transferred, at_agency'
      }),
    notes: Joi.string().max(500).optional(),
    rejectionReason: Joi.string().max(500).optional(),
    recipientSignature: Joi.string().optional(),
    deliveryProof: Joi.string().optional()
  })
};

module.exports = { validateRequest, schemas };