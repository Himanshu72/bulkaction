// src/handlers/registry.js
const BulkUpdateHandler = require('./bulkUpdate.handler')

const handlerRegistry = {
  bulk_update: new BulkUpdateHandler(),
}

function getHandler(actionType) {
  if (!handlerRegistry[actionType])
    throw new Error(`Unknown action type: ${actionType}`)
  return handlerRegistry[actionType]
}

module.exports = { getHandler }
