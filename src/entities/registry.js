// src/entities/registry.js
const contactRepository = require('../repositories/contact.repository')
const { validateContactUpdate } = require('../validators/contact.validator')

const entityRegistry = {
  contact: {
    repository:       contactRepository,
    validator:        validateContactUpdate,
    filterableFields: ['status', 'age', 'name', 'email'],
    logMetadata:      (entity) => ({ email: entity.email }),
  },
}

function getEntity(entityType) {
  if (!entityRegistry[entityType])
    throw new Error(`Unknown entity type: ${entityType}`)
  return entityRegistry[entityType]
}

function getEntityTypes() {
  return Object.keys(entityRegistry)
}

function _test_register(type, entry) {
  entityRegistry[type] = entry
}

function _test_unregister(type) {
  delete entityRegistry[type]
}

module.exports = { getEntity, getEntityTypes, _test_register, _test_unregister }
