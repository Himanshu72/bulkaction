// src/repositories/bulkActionLog.repository.js
const BulkActionLog = require('../models/mongodb/bulkActionLog.model')

async function insertMany(logs) {
  if (!logs.length) return
  await BulkActionLog.insertMany(logs, { ordered: false })
}

async function findByBulkActionId(bulkActionId, statusFilter = null, page = 1, limit = 50) {
  const query = { bulkActionId }
  if (statusFilter) query.status = statusFilter
  const [logs, total] = await Promise.all([
    BulkActionLog.find(query)
      .sort({ processedAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    BulkActionLog.countDocuments(query),
  ])
  return { logs, total }
}

module.exports = { insertMany, findByBulkActionId }
