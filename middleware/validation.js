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

  updateDeliveryStatus: Joi.object({
    status: Joi.string().valid(
      'pending', 'assigned', 'accepted',
      'in_progress', 'delivered', 'cancelled', 'transferred'
    ).required()
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
  })
};

module.exports = { validateRequest, schemas };