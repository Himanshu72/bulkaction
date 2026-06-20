// src/entities/registry.js
const contactRepository = require('../repositories/contact.repository')
const { validateContactUpdate } = require('../validators/contact.validator')

const entityRegistry = {
  contact: {
    repository:       contactRepository,
    validator:        validateContactUpdate,
    uniqueField:      'email',
    filterableFields: ['status', 'age', 'name', 'email'],
  },
}

function getEntity(entityType) {
  if (!entityRegistry[entityType])
    throw new Error(`Unknown entity type: ${entityType}`)
  return entityRegistry[entityType]
}

module.exports = { getEntity }
