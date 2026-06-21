// src/api/routes/health.routes.js
const { Router } = require('express')
const db          = require('../../config/postgres')
const redis       = require('../../config/redis')
const { mongoose } = require('../../config/mongodb')
const coordinatorQueue = require('../../queues/coordinator.queue')
const batchQueue       = require('../../queues/batch.queue')

const router = Router()

router.get('/', async (req, res) => {
  const checks = await Promise.all([
    checkPostgres(),
    checkRedis(),
    checkMongo(),
    checkQueues(),
  ])

  const [postgres, redisCheck, mongo, queues] = checks
  const allOk = [postgres, redisCheck, mongo].every(c => c.status === 'ok')

  res.status(allOk ? 200 : 503).json({
    status:  allOk ? 'ok' : 'degraded',
    version: process.env.npm_package_version || '1.0.0',
    uptime:  Math.floor(process.uptime()) + 's',
    checks: {
      postgres:   postgres,
      redis:      redisCheck,
      mongodb:    mongo,
      queues:     queues,
    },
  })
})

async function checkPostgres() {
  const t = Date.now()
  try {
    await db.raw('SELECT 1')
    return { status: 'ok', latencyMs: Date.now() - t }
  } catch (err) {
    return { status: 'error', error: err.message }
  }
}

async function checkRedis() {
  const t = Date.now()
  try {
    const pong = await redis.ping()
    return { status: pong === 'PONG' ? 'ok' : 'error', latencyMs: Date.now() - t }
  } catch (err) {
    return { status: 'error', error: err.message }
  }
}

async function checkMongo() {
  const t = Date.now()
  try {
    const state = mongoose.connection.readyState
    // 0=disconnected 1=connected 2=connecting 3=disconnecting
    const labels = ['disconnected', 'connected', 'connecting', 'disconnecting']
    if (state === 1) {
      await mongoose.connection.db.admin().ping()
      return { status: 'ok', latencyMs: Date.now() - t }
    }
    return { status: 'error', error: `MongoDB state: ${labels[state] || state}` }
  } catch (err) {
    return { status: 'error', error: err.message }
  }
}

async function checkQueues() {
  try {
    const [coordCounts, batchCounts] = await Promise.all([
      coordinatorQueue.getJobCounts('waiting', 'active', 'failed', 'completed'),
      batchQueue.getJobCounts('waiting', 'active', 'failed', 'completed'),
    ])
    return {
      status: 'ok',
      coordinator: coordCounts,
      batch:       batchCounts,
      note: coordCounts.waiting > 0
        ? `${coordCounts.waiting} job(s) waiting — are workers running?`
        : 'workers healthy',
    }
  } catch (err) {
    return { status: 'error', error: err.message }
  }
}

module.exports = router
