// src/handlers/bulkUpdate.handler.js
const BaseHandler = require('./base.handler')

class BulkUpdateHandler extends BaseHandler {
  async execute(entity, payload, ctx) {
    const { repository, validator, db, bulkActionStartedAt } = ctx
    const fields = payload.fields || {}

    const validation = await validator(entity, fields, db)
    if (!validation.valid)
      return { status: 'failure', error: validation.errors.join('; ') }

    const updated = await repository.updateById(entity.id, fields, bulkActionStartedAt)
    if (!updated)
      return { status: 'skipped', error: 'Record modified by a concurrent bulk action' }

    return { status: 'success' }
  }
}

module.exports = BulkUpdateHandler
