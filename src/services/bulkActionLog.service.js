// src/services/bulkActionLog.service.js
const repo             = require('../repositories/bulkActionLog.repository')
const { getEntity }    = require('../entities/registry')

function buildEntry(bulkActionId, entityType, entity, result) {
  const { logMetadata } = getEntity(entityType)
  return {
    bulkActionId,
    entityId:     entity.id,
    entityType,
    status:       result.status,
    errorMessage: result.error || null,
    processedAt:  new Date(),
    metadata:     logMetadata ? logMetadata(entity) : {},
  }
}

async function saveLogs(bulkActionId, entityType, entities, results) {
  if (!entities.length) return
  const logs = entities.map((entity, i) => buildEntry(bulkActionId, entityType, entity, results[i]))
  await repo.insertMany(logs)
}

async function getLogs(bulkActionId, statusFilter, page, limit) {
  return repo.findByBulkActionId(bulkActionId, statusFilter, page, limit)
}

module.exports = { saveLogs, getLogs }
