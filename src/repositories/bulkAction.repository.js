// src/repositories/bulkAction.repository.js
const db = require('../config/postgres')

async function insert(dto) {
  const [row] = await db('bulk_actions').insert({
    account_id:  dto.accountId,
    entity_type: dto.entityType,
    action_type: dto.actionType,
    status:      dto.scheduledAt ? 'scheduled' : 'queued',
    filters:     JSON.stringify(dto.filters || {}),
    payload:     JSON.stringify(dto.payload),
    priority:    dto.priority || 5,
    scheduled_at: dto.scheduledAt || null,
  }).returning('*')
  return row
}

async function findById(id) {
  return db('bulk_actions').where({ id }).first() || null
}

async function updateStatus(id, status, extra = {}) {
  await db('bulk_actions').where({ id }).update({ status, ...extra })
}

async function updateCursor(id, cursor, batchesEnqueued) {
  await db('bulk_actions').where({ id }).update({ last_cursor: cursor, batches_enqueued: batchesEnqueued })
}

async function updateCounts(id, { successCount, failureCount, skippedCount }) {
  await db('bulk_actions').where({ id }).update({
    success_count: successCount,
    failure_count: failureCount,
    skipped_count: skippedCount,
  })
}

async function list(accountId, { status } = {}, page = 1, limit = 20) {
  let query = db('bulk_actions').where({ account_id: accountId })
  if (status) query = query.where({ status })
  const [{ count }] = await query.clone().count('id as count')
  const rows = await query.orderBy('created_at', 'desc').limit(limit).offset((page - 1) * limit)
  return { rows, total: parseInt(count) }
}

async function findStuck() {
  return db('bulk_actions').where({ status: 'processing' })
}

module.exports = { insert, findById, updateStatus, updateCursor, updateCounts, list, findStuck }
