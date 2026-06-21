// src/workers/batch.worker.js
const { Worker } = require('bullmq')
const redis              = require('../config/redis')
const { getEntity }      = require('../entities/registry')
const { getHandler }     = require('../handlers/registry')
const progressService    = require('../services/progress.service')
const rateLimitService   = require('../services/rateLimit.service')
const bulkActionLogService = require('../services/bulkActionLog.service')
const bulkActionRepo     = require('../repositories/bulkAction.repository')
const db                 = require('../config/postgres')

// Wrap knex instance to provide a .query() method compatible with the contact validator
const dbContext = {
  query: (sql, params) => db.raw(sql, params).then(r => r),
}

async function processBatch(job) {
  const { bulkActionId, accountId, entityType, actionType,
          entityIds, payload, bulkActionStartedAt } = job.data
  console.log(`[batch] Processing batch for bulkActionId=${bulkActionId}, entityIds.length=${entityIds ? entityIds.length : 0}`)

  const { repository, validator } = getEntity(entityType)
  const handler = getHandler(actionType)

  // 1. Fetch full entity records
  const entities = await repository.fetchByIds(entityIds)

  // 2. Rate limit — atomic check+increment via Lua script (no TOCTOU race)
  const bulkAction = await bulkActionRepo.findById(bulkActionId)
  const limit      = bulkAction?.rate_limit || 10000
  const allowed    = await rateLimitService.consume(accountId, entities.length, limit)
  if (!allowed) throw new Error(`Rate limit exceeded for account ${accountId}`)

  // 3. Process each entity through the handler
  const ctx = {
    repository,
    validator,
    db: dbContext,
    bulkActionStartedAt: new Date(bulkActionStartedAt),
  }

  const results = await Promise.all(
    entities.map(entity => handler.execute(entity, payload, ctx).catch(err => ({
      status: 'failure',
      error: err.message,
      entityId: entity.id,
    })))
  )

  // 4. Write logs to MongoDB
  await bulkActionLogService.saveLogs(bulkActionId, entityType, entities, results)

  // 5. Increment Redis progress counters
  await progressService.increment(bulkActionId, results)

  // 6. Check if this is the last batch — if so, finalize
  const progress = await progressService.get(bulkActionId)
  if (progress.processed >= progress.total) {
    await progressService.flush(bulkActionId, bulkActionRepo)
    await bulkActionRepo.updateStatus(bulkActionId, 'completed', {
      completed_at: new Date(),
      total_count:  progress.total,
    })
    await progressService.cleanup(bulkActionId)
  }
}

const batchWorker = new Worker('batch', processBatch, {
  connection:  redis,
  concurrency: 10,
})

batchWorker.on('failed', async (job, err) => {
  const maxAttempts = job.opts?.attempts ?? 1
  console.error(`Batch job ${job.id} failed (attempt ${job.attemptsMade}/${maxAttempts}):`, err.message)

  // Only mark the bulk action as failed once all retries are exhausted
  if (job.attemptsMade >= maxAttempts) {
    const { bulkActionId } = job?.data || {}
    if (bulkActionId) {
      await Promise.all([
        // Sync whatever progress was made to PostgreSQL before marking failed
        progressService.flush(bulkActionId, bulkActionRepo),
        bulkActionRepo.updateStatus(bulkActionId, 'failed', {
          completed_at:  new Date(),
          error_message: err.message,
        }),
      ]).catch(e => console.error(`Failed to finalize bulk action ${bulkActionId}:`, e.message))

      await progressService.cleanup(bulkActionId)
        .catch(e => console.error(`Failed to cleanup progress for ${bulkActionId}:`, e.message))
    }
  }
})

module.exports = batchWorker
