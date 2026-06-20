// src/services/dedup.service.js
const redis = require('../config/redis')

async function seed(bulkActionId, emails) {
  if (!emails.length) return
  const key = `dedup:${bulkActionId}`
  const chunkSize = 1000
  for (let i = 0; i < emails.length; i += chunkSize) {
    const chunk = emails.slice(i, i + chunkSize)
    const pipe = redis.pipeline()
    pipe.sadd(key, ...chunk)
    pipe.expire(key, 86400)
    await pipe.exec()
  }
}

async function filter(entities, bulkActionId, uniqueField) {
  if (!entities.length) return { toProcess: [], skipped: [] }
  const key = `dedup:${bulkActionId}`

  const checkPipe = redis.pipeline()
  entities.forEach(e => checkPipe.sismember(key, e[uniqueField]))
  const results = await checkPipe.exec()

  const toProcess = []
  const skipped   = []
  const claimPipe = redis.pipeline()

  for (let i = 0; i < entities.length; i++) {
    if (results[i][1] === 1) {
      skipped.push(entities[i])
    } else {
      toProcess.push(entities[i])
      claimPipe.sadd(key, entities[i][uniqueField])
    }
  }
  await claimPipe.exec()
  return { toProcess, skipped }
}

async function cleanup(bulkActionId) {
  await redis.del(`dedup:${bulkActionId}`)
}

module.exports = { seed, filter, cleanup }
