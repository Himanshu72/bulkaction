// src/validators/bulkAction.validator.js
const Joi = require('joi')

const createSchema = Joi.object({
  accountId:   Joi.string().uuid().required(),
  entityType:  Joi.string().valid('contact').required(),
  actionType:  Joi.string().valid('bulk_update').required(),
  filters:     Joi.object(),
  entityIds:   Joi.array().items(Joi.string().uuid()).min(1),
  payload:     Joi.object({
    fields: Joi.object().min(1).required(),
  }).required(),
  priority:    Joi.number().integer().min(1).max(10).default(5),
  scheduledAt: Joi.date().iso().greater('now').optional(),
}).or('filters', 'entityIds')

function validateCreatePayload(body) {
  return createSchema.validate(body, { abortEarly: false, stripUnknown: true })
}

module.exports = { validateCreatePayload }
