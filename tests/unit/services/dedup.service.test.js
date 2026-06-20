// tests/unit/services/dedup.service.test.js
jest.mock('../../../src/config/redis', () => new (require('ioredis-mock'))())

const redis = require('../../../src/config/redis')
const dedupService = require('../../../src/services/dedup.service')

afterEach(() => redis.flushall())

const entities = [
  { id: '1', email: 'a@test.com' },
  { id: '2', email: 'b@test.com' },
  { id: '3', email: 'a@test.com' },  // duplicate of entity 1
]

test('seed populates the dedup set', async () => {
  await dedupService.seed('ba1', ['a@test.com', 'b@test.com'])
  const isMember = await redis.sismember('dedup:ba1', 'a@test.com')
  expect(isMember).toBe(1)
})

test('filter splits entities into toProcess and skipped', async () => {
  await dedupService.seed('ba2', ['a@test.com'])
  const { toProcess, skipped } = await dedupService.filter(entities, 'ba2', 'email')
  expect(toProcess.map(e => e.email)).not.toContain('a@test.com')
  expect(skipped.some(e => e.email === 'a@test.com')).toBe(true)
})

test('filter claims new emails so second call skips them', async () => {
  const batch1 = [{ id: '1', email: 'x@test.com' }]
  const batch2 = [{ id: '2', email: 'x@test.com' }]
  await dedupService.filter(batch1, 'ba3', 'email')
  const { toProcess, skipped } = await dedupService.filter(batch2, 'ba3', 'email')
  expect(toProcess.length).toBe(0)
  expect(skipped.length).toBe(1)
})

test('cleanup removes the dedup key', async () => {
  await dedupService.seed('ba4', ['a@test.com'])
  await dedupService.cleanup('ba4')
  const isMember = await redis.sismember('dedup:ba4', 'a@test.com')
  expect(isMember).toBe(0)
})
