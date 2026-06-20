// index.js
require('dotenv').config()
const app = require('./src/app')
const { connectMongo } = require('./src/config/mongodb')
const flushWorker        = require('./src/workers/flush.worker')
const bulkActionRepo     = require('./src/repositories/bulkAction.repository')
const coordinatorQueue   = require('./src/queues/coordinator.queue')

// Workers auto-register when required
require('./src/workers/coordinator.worker')
require('./src/workers/batch.worker')

const PORT = process.env.PORT || 3000

async function recoverStuckActions() {
  const stuck = await bulkActionRepo.findStuck()
  for (const ba of stuck) {
    console.log(`Recovering stuck bulk action: ${ba.id}`)
    await coordinatorQueue.add('coordinate', {
      bulkActionId:       ba.id,
      accountId:          ba.account_id,
      entityType:         ba.entity_type,
      actionType:         ba.action_type,
      filters:            ba.filters,
      entityIds:          null,
      payload:            ba.payload,
      resumeFromCursor:   ba.last_cursor,
    }, {
      jobId:    `coordinator_${ba.id}_recovery`,
      priority: ba.priority,
    })
  }
  if (stuck.length) console.log(`Recovered ${stuck.length} stuck bulk action(s)`)
}

async function start() {
  await connectMongo()
  await recoverStuckActions()
  flushWorker.start()
  app.listen(PORT, () => console.log(`CRM Bulk API running on port ${PORT}`))
}

start().catch((err) => {
  console.error('Startup failed:', err)
  process.exit(1)
})
