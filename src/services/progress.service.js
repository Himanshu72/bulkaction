// src/services/progress.service.js
const redis = require('../config/redis')

const keys = (id) => ({
  total:     `progress:${id}:total`,
  processed: `progress:${id}:processed`,
  success:   `progress:${id}:success`,
  failure:   `progress:${id}:failure`,
  skipped:   `progress:${id}:skipped`,
})

async function init(bulkActionId, total) {
  const k = keys(bulkActionId)
  const pipe = redis.pipeline()
  pipe.set(k.total, total)
  pipe.set(k.processed, 0)
  pipe.set(k.success, 0)
  pipe.set(k.failure, 0)
  pipe.set(k.skipped, 0)
  await pipe.exec()
}

async function increment(bulkActionId, results) {
  const k = keys(bulkActionId)
  const counts = { success: 0, failure: 0, skipped: 0 }
  for (const r of results) counts[r.status] = (counts[r.status] || 0) + 1

  const pipe = redis.pipeline()
  pipe.incrby(k.processed, results.length)
  pipe.incrby(k.success,   counts.success)
  pipe.incrby(k.failure,   counts.failure)
  pipe.incrby(k.skipped,   counts.skipped)
  await pipe.exec()
}

async function get(bulkActionId) {
  const k = keys(bulkActionId)
  const [total, processed, success, failure, skipped] = await redis.mget(
    k.total, k.processed, k.success, k.failure, k.skipped
  )
  return {
    total:     parseInt(total || 0),
    processed: parseInt(processed || 0),
    success:   parseInt(success || 0),
    failure:   parseInt(failure || 0),
    skipped:   parseInt(skipped || 0),
  }
}

async function flush(bulkActionId, bulkActionRepo) {
  const p = await get(bulkActionId)
  await bulkActionRepo.updateCounts(bulkActionId, {
    successCount: p.success,
    failureCount: p.failure,
    skippedCount: p.skipped,
  })
}

async function cleanup(bulkActionId) {
  const k = keys(bulkActionId)
  await redis.del(k.total, k.processed, k.success, k.failure, k.skipped, `dedup:${bulkActionId}`)
}

module.exports = { init, increment, get, flush, cleanup }
