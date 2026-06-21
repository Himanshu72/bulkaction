// tests/unit/services/rateLimit.service.test.js
jest.mock('../../../src/config/redis', () => new (require('ioredis-mock'))())

const redis = require('../../../src/config/redis')
const rateLimitService = require('../../../src/services/rateLimit.service')

afterEach(() => redis.flushall())

test('allows request within limit', async () => {
  const allowed = await rateLimitService.consume('acc1', 100, 10000)
  expect(allowed).toBe(true)
})

test('blocks request that would exceed limit', async () => {
  await rateLimitService.consume('acc1', 9950, 10000)
  const allowed = await rateLimitService.consume('acc1', 100, 10000)
  expect(allowed).toBe(false)
})

test('consume increments counter and sets TTL', async () => {
  await rateLimitService.consume('acc2', 500, 10000)
  const val = await redis.get('rate:acc2')
  expect(parseInt(val)).toBe(500)
  const ttl = await redis.ttl('rate:acc2')
  expect(ttl).toBeGreaterThan(0)
  expect(ttl).toBeLessThanOrEqual(60)
})

test('TTL is not reset on subsequent calls within the same window', async () => {
  await rateLimitService.consume('acc3', 100, 10000)
  // Simulate time passing by manually reducing TTL
  await redis.expire('rate:acc3', 30)
  await rateLimitService.consume('acc3', 100, 10000)
  const ttl = await redis.ttl('rate:acc3')
  // TTL should still be ~30, not reset to 60
  expect(ttl).toBeLessThanOrEqual(30)
})

test('counter resets after window expires (simulated)', async () => {
  await rateLimitService.consume('acc4', 9999, 10000)
  await redis.del('rate:acc4')
  const allowed = await rateLimitService.consume('acc4', 100, 10000)
  expect(allowed).toBe(true)
})
