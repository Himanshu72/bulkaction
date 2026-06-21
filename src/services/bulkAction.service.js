// src/services/bulkAction.service.js
const bulkActionRepo    = require('../repositories/bulkAction.repository')
const bulkActionLogService = require('../services/bulkActionLog.service')
const coordinatorQueue  = require('../queues/coordinator.queue')
const progressService   = require('../services/progress.service')

async function createBulkAction(dto) {
  const row = await bulkActionRepo.insert(dto)

  const delay = dto.scheduledAt
    ? Math.max(0, new Date(dto.scheduledAt) - Date.now())
    : 0

  await coordinatorQueue.add('coordinate', {
    bulkActionId: row.id,
    accountId:    dto.accountId,
    entityType:   dto.entityType,
    actionType:   dto.actionType,
    filters:      dto.filters || {},
    entityIds:    dto.entityIds || null,
    payload:      dto.payload,
  }, {
    delay,
    priority: dto.priority || 5,
    jobId:    `coordinator_${row.id}`,
  })

  return { id: row.id, status: row.status, scheduledAt: row.scheduled_at, createdAt: row.created_at }
}

async function listBulkActions(accountId, filters = {}, page = 1, limit = 20) {
  return bulkActionRepo.list(accountId, filters, page, limit)
}

async function getBulkActionWithProgress(id) {
  const row = await bulkActionRepo.findById(id)
  if (!row) return null

  // Skip Redis for terminal states — keys have already been cleaned up
  const isDone = row.status === 'completed' || row.status === 'failed'
  const live   = isDone ? null : await progressService.get(id)

  const total        = (live && live.total) || row.total_count
  // For completed actions, all entities were processed; use total as processed
  const processedCount = isDone ? total : (live ? live.processed : 0)
  const progressPercent = total > 0 ? Math.floor((processedCount / total) * 100) : 0

  return {
    id:              row.id,
    status:          row.status,
    entityType:      row.entity_type,
    actionType:      row.action_type,
    priority:        row.priority,
    totalCount:      total,
    processedCount,
    successCount:    (live && live.success)  || row.success_count,
    failureCount:    (live && live.failure)  || row.failure_count,
    skippedCount:    (live && live.skipped)  || row.skipped_count,
    progressPercent,
    errorMessage:    row.error_message || null,
    scheduledAt:     row.scheduled_at,
    startedAt:       row.started_at,
    completedAt:     row.completed_at,
  }
}

async function getBulkActionStats(id) {
  const row = await bulkActionRepo.findById(id)
  if (!row) return null

  const durationSeconds = row.completed_at && row.started_at
    ? Math.round((new Date(row.completed_at) - new Date(row.started_at)) / 1000)
    : null

  return {
    bulkActionId:  row.id,
    totalCount:    row.total_count,
    successCount:  row.success_count,
    failureCount:  row.failure_count,
    skippedCount:  row.skipped_count,
    durationSeconds,
  }
}

async function getBulkActionLogs(id, statusFilter, page, limit) {
  return bulkActionLogService.getLogs(id, statusFilter, page, limit)
}

module.exports = {
  createBulkAction,
  listBulkActions,
  getBulkActionWithProgress,
  getBulkActionStats,
  getBulkActionLogs,
}
