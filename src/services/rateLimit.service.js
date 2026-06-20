// src/services/rateLimit.service.js
const redis = require('../config/redis')

async function check(accountId, count, limitPerMinute) {
  const current = parseInt(await redis.get(`rate:${accountId}`) || '0')
  return current + count <= limitPerMinute
}

async function consume(accountId, count) {
  const key = `rate:${accountId}`
  const pipe = redis.pipeline()
  pipe.incrby(key, count)
  pipe.expire(key, 60)
  await pipe.exec()
}

module.exports = { check, consume }
