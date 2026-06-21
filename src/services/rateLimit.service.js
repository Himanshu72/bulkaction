// src/services/rateLimit.service.js
const redis = require('../config/redis')

// Atomically checks and increments the rate limit counter.
// Returns true if the request is allowed, false if rate limited.
// Uses a Lua script so check+increment is a single round-trip with no TOCTOU race.
// TTL is set only on first write so the 60s window is fixed, not sliding.
const CONSUME_SCRIPT = `
local key   = KEYS[1]
local count = tonumber(ARGV[1])
local limit = tonumber(ARGV[2])
local current = tonumber(redis.call('GET', key) or '0')
if current + count > limit then return 0 end
redis.call('INCRBY', key, count)
if redis.call('TTL', key) < 0 then redis.call('EXPIRE', key, 60) end
return 1
`

async function consume(accountId, count, limitPerMinute) {
  const result = await redis.eval(CONSUME_SCRIPT, 1, `rate:${accountId}`, count, limitPerMinute)
  return result === 1
}

module.exports = { consume }
