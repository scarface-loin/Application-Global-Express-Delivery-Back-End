import Joi from 'joi';

export const schemas = {
  login: Joi.object({
    email: Joi.string().email().required(),
    password: Joi.string().min(6).required()
  }),

  register: Joi.object({
    email: Joi.string().email().required(),
    password: Joi.string().min(6).required(),
    name: Joi.string().min(2).required(),
    phone: Joi.string().pattern(/^[0-9]{9,15}$/).required(),
    matricule: Joi.string().required()
  }),

  changePassword: Joi.object({
    oldPassword: Joi.string().required(),
    newPassword: Joi.string().min(6).required()
  }),

  updateProfile: Joi.object({
    name: Joi.string().min(2),
    phone: Joi.string().pattern(/^[0-9]{9,15}$/),
    settings: Joi.object()
  }),

  updatePackageStatus: Joi.object({
    status: Joi.string().valid('delivered', 'rejected', 'pending', 'in_transit').required(),
    rejectionReason: Joi.string().when('status', {
      is: 'rejected',
      then: Joi.string().required(),
      otherwise: Joi.string().allow('')
    }),
    deliveryProof: Joi.string().uri()
  })
};