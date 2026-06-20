// tests/unit/services/rateLimit.service.test.js
jest.mock('../../../src/config/redis', () => new (require('ioredis-mock'))())

const redis = require('../../../src/config/redis')
const rateLimitService = require('../../../src/services/rateLimit.service')

afterEach(() => redis.flushall())

test('allows request within limit', async () => {
  const allowed = await rateLimitService.check('acc1', 100, 10000)
  expect(allowed).toBe(true)
})

test('blocks request exceeding limit', async () => {
  await rateLimitService.consume('acc1', 9950)
  const allowed = await rateLimitService.check('acc1', 100, 10000)
  expect(allowed).toBe(false)
})

test('consume increments counter and sets TTL', async () => {
  await rateLimitService.consume('acc2', 500)
  const val = await redis.get('rate:acc2')
  expect(parseInt(val)).toBe(500)
  const ttl = await redis.ttl('rate:acc2')
  expect(ttl).toBeGreaterThan(0)
  expect(ttl).toBeLessThanOrEqual(60)
})

test('counter resets after window expires (simulated)', async () => {
  await rateLimitService.consume('acc3', 9999)
  await redis.del('rate:acc3')
  const allowed = await rateLimitService.check('acc3', 100, 10000)
  expect(allowed).toBe(true)
})
