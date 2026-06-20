// src/workers/batch.worker.js
const { Worker } = require('bullmq')
const redis              = require('../config/redis')
const { getEntity }      = require('../entities/registry')
const { getHandler }     = require('../handlers/registry')
const progressService    = require('../services/progress.service')
const rateLimitService   = require('../services/rateLimit.service')
const dedupService       = require('../services/dedup.service')
const bulkActionLogRepo  = require('../repositories/bulkActionLog.repository')
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

  const { repository, validator, uniqueField } = getEntity(entityType)
  const handler = getHandler(actionType)

  // 1. Fetch full entity records
  const entities = await repository.fetchByIds(entityIds)

  // 2. Dedup — split into process vs skip
  const { toProcess, skipped } = await dedupService.filter(entities, bulkActionId, uniqueField)

  // 3. Rate limit check — block batch if over limit
  const bulkAction = await bulkActionRepo.findById(bulkActionId)
  const limit = bulkAction?.rate_limit || 10000
  const allowed = await rateLimitService.check(accountId, toProcess.length, limit)
  if (!allowed) throw new Error(`Rate limit exceeded for account ${accountId}`)
  await rateLimitService.consume(accountId, toProcess.length)

  // 4. Process each entity through the handler
  const ctx = {
    repository,
    validator,
    db: dbContext,
    bulkActionStartedAt: new Date(bulkActionStartedAt),
  }

  const results = await Promise.all(
    toProcess.map(entity => handler.execute(entity, payload, ctx).catch(err => ({
      status: 'failure',
      error: err.message,
      entityId: entity.id,
    })))
  )

  // 5. Build log entries
  const logs = [
    ...skipped.map(e => ({
      bulkActionId, entityId: e.id, entityType,
      status: 'skipped',
      errorMessage: `Duplicate ${uniqueField}: ${e[uniqueField]}`,
      processedAt: new Date(),
    })),
    ...results.map((r, i) => ({
      bulkActionId, entityId: toProcess[i].id, entityType,
      status: r.status,
      errorMessage: r.error || null,
      processedAt: new Date(),
      metadata: { email: toProcess[i].email },
    })),
  ]

  // 6. Write logs to MongoDB (one call)
  await bulkActionLogRepo.insertMany(logs)

  // 7. Increment Redis progress counters
  const allResults = [
    ...skipped.map(() => ({ status: 'skipped' })),
    ...results,
  ]
  await progressService.increment(bulkActionId, allResults)

  // 8. Check if this is the last batch — if so, finalize
  const progress = await progressService.get(bulkActionId)
  if (progress.processed >= progress.total) {
    await progressService.flush(bulkActionId, bulkActionRepo)
    await bulkActionRepo.updateStatus(bulkActionId, 'completed', { completed_at: new Date() })
    await progressService.cleanup(bulkActionId)
  }
}

const batchWorker = new Worker('batch', processBatch, {
  connection:  redis,
  concurrency: 10,
})

batchWorker.on('failed', (job, err) => {
  console.error(`Batch job ${job.id} failed:`, err.message)
})

module.exports = batchWorker
