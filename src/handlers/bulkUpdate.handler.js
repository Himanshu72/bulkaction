// src/handlers/bulkUpdate.handler.js
const BaseHandler = require('./base.handler')

class BulkUpdateHandler extends BaseHandler {
  async execute(entity, payload, ctx) {
    return { status: 'success' }
  }
}

module.exports = BulkUpdateHandler
