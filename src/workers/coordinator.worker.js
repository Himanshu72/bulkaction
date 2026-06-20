// src/workers/coordinator.worker.js
const { Worker } = require('bullmq')
const redis           = require('../config/redis')
const batchQueue      = require('../queues/batch.queue')
const { getEntity }   = require('../entities/registry')
const progressService = require('../services/progress.service')
const dedupService    = require('../services/dedup.service')
const bulkActionRepo  = require('../repositories/bulkAction.repository')

const BATCH_SIZE = 500

async function processCoordinator(job) {
  const { bulkActionId, accountId, entityType, actionType, filters, entityIds, payload } = job.data

  await bulkActionRepo.updateStatus(bulkActionId, 'processing', { started_at: new Date() })

  const { repository } = getEntity(entityType)
  const batchJobs = []
  let totalCount  = 0
  let batchesEnqueued = 0
  const startedAt = new Date()

  if (entityIds && entityIds.length) {
    // Explicit ID mode — chunk the provided list
    for (let i = 0; i < entityIds.length; i += BATCH_SIZE) {
      const chunk = entityIds.slice(i, i + BATCH_SIZE)
      batchJobs.push({
        name: 'process-batch',
        data: { bulkActionId, accountId, entityType, actionType, payload,
                entityIds: chunk, bulkActionStartedAt: startedAt },
        opts: { jobId: `${bulkActionId}:batch:${i}`, priority: job.opts?.priority || 5 },
      })
      totalCount += chunk.length
      batchesEnqueued++
    }
  } else {
    // Filter mode — cursor-paginate PostgreSQL
    let cursor = job.data.resumeFromCursor || null
    let offset = 0
    while (true) {
      const page = await repository.paginatedFetch(filters || {}, cursor, BATCH_SIZE)
      if (!page.length) break
      batchJobs.push({
        name: 'process-batch',
        data: { bulkActionId, accountId, entityType, actionType, payload,
                entityIds: page.map(e => e.id), bulkActionStartedAt: startedAt },
        opts: { jobId: `${bulkActionId}:batch:${offset}`, priority: job.opts?.priority || 5 },
      })
      cursor = page[page.length - 1].id
      totalCount += page.length
      batchesEnqueued++
      offset += BATCH_SIZE
      await bulkActionRepo.updateCursor(bulkActionId, cursor, batchesEnqueued)
      if (page.length < BATCH_SIZE) break
    }
  }

  // If no entities found, mark as completed immediately
  if (totalCount === 0) {
    await progressService.init(bulkActionId, 0)
    await bulkActionRepo.updateStatus(bulkActionId, 'completed', {
      total_count: 0,
      completed_at: new Date(),
    })
    return
  }

  // Seed dedup set with all emails before any batch runs
  const allEmails = await getAllEmails(repository, filters, entityIds)
  await dedupService.seed(bulkActionId, allEmails)

  await progressService.init(bulkActionId, totalCount)
  await bulkActionRepo.updateStatus(bulkActionId, 'processing', { total_count: totalCount })

  // Enqueue all batch jobs
  await batchQueue.addBulk(batchJobs)
}

async function getAllEmails(repository, filters, entityIds) {
  if (entityIds && entityIds.length) {
    const entities = await repository.fetchByIds(entityIds)
    return entities.map(e => e.email).filter(Boolean)
  }
  const emails = []
  let cursor = null
  while (true) {
    const page = await repository.paginatedFetch(filters || {}, cursor, 1000)
    if (!page.length) break
    emails.push(...page.map(e => e.email).filter(Boolean))
    cursor = page[page.length - 1].id
    if (page.length < 1000) break
  }
  return emails
}

const coordinatorWorker = new Worker('coordinator', processCoordinator, {
  connection:  redis,
  concurrency: 5,
})

coordinatorWorker.on('failed', (job, err) => {
  console.error(`Coordinator job ${job.id} failed:`, err.message)
})

module.exports = coordinatorWorker
