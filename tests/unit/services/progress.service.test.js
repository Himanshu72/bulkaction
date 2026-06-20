// tests/unit/services/progress.service.test.js
jest.mock('../../../src/config/redis', () => new (require('ioredis-mock'))())

const redis = require('../../../src/config/redis')
const progressService = require('../../../src/services/progress.service')

afterEach(() => redis.flushall())

test('init sets total and zeroes counters', async () => {
  await progressService.init('ba1', 100)
  const val = await redis.get('progress:ba1:total')
  expect(val).toBe('100')
  expect(await redis.get('progress:ba1:processed')).toBe('0')
})

test('increment updates counters correctly', async () => {
  await progressService.init('ba2', 10)
  const results = [
    { status: 'success' }, { status: 'success' },
    { status: 'failure' }, { status: 'skipped' },
  ]
  await progressService.increment('ba2', results)
  const p = await progressService.get('ba2')
  expect(p.success).toBe(2)
  expect(p.failure).toBe(1)
  expect(p.skipped).toBe(1)
  expect(p.processed).toBe(4)
})

test('get returns parsed integers', async () => {
  await progressService.init('ba3', 50)
  const p = await progressService.get('ba3')
  expect(typeof p.total).toBe('number')
  expect(p.total).toBe(50)
})

test('flush calls bulkActionRepo.updateCounts', async () => {
  await progressService.init('ba4', 10)
  await progressService.increment('ba4', [{ status: 'success' }, { status: 'failure' }])
  const mockRepo = { updateCounts: jest.fn() }
  await progressService.flush('ba4', mockRepo)
  expect(mockRepo.updateCounts).toHaveBeenCalledWith('ba4', {
    successCount: 1, failureCount: 1, skippedCount: 0,
  })
})

test('cleanup removes all progress keys', async () => {
  await progressService.init('ba5', 10)
  await progressService.cleanup('ba5')
  const val = await redis.get('progress:ba5:total')
  expect(val).toBeNull()
})
