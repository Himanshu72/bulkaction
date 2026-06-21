// tests/unit/services/bulkActionLog.service.test.js
jest.mock('../../../src/repositories/bulkActionLog.repository')

const repo    = require('../../../src/repositories/bulkActionLog.repository')
const service = require('../../../src/services/bulkActionLog.service')

const bulkActionId = 'ba-001'
const entityType   = 'contact'

const entities = [
  { id: 'c-1', email: 'a@test.com' },
  { id: 'c-2', email: 'b@test.com' },
]

const results = [
  { status: 'success' },
  { status: 'failure', error: 'Invalid email format' },
]

beforeEach(() => jest.clearAllMocks())

test('saveLogs writes one entry per entity', async () => {
  repo.insertMany.mockResolvedValue()

  await service.saveLogs(bulkActionId, entityType, entities, results)

  expect(repo.insertMany).toHaveBeenCalledTimes(1)
  const [logs] = repo.insertMany.mock.calls[0]
  expect(logs).toHaveLength(2)
})

test('saveLogs sets bulkActionId and entityId on each entry', async () => {
  repo.insertMany.mockResolvedValue()

  await service.saveLogs(bulkActionId, entityType, entities, results)

  const [logs] = repo.insertMany.mock.calls[0]
  expect(logs[0].bulkActionId).toBe(bulkActionId)
  expect(logs[0].entityId).toBe('c-1')
  expect(logs[1].entityId).toBe('c-2')
})

test('saveLogs maps status and errorMessage from results', async () => {
  repo.insertMany.mockResolvedValue()

  await service.saveLogs(bulkActionId, entityType, entities, results)

  const [logs] = repo.insertMany.mock.calls[0]
  expect(logs[0].status).toBe('success')
  expect(logs[0].errorMessage).toBeNull()
  expect(logs[1].status).toBe('failure')
  expect(logs[1].errorMessage).toBe('Invalid email format')
})

test('saveLogs stores entity email in metadata', async () => {
  repo.insertMany.mockResolvedValue()

  await service.saveLogs(bulkActionId, entityType, entities, results)

  const [logs] = repo.insertMany.mock.calls[0]
  expect(logs[0].metadata.email).toBe('a@test.com')
})

test('saveLogs skips repo call when entities list is empty', async () => {
  await service.saveLogs(bulkActionId, entityType, [], [])

  expect(repo.insertMany).not.toHaveBeenCalled()
})

test('getLogs delegates to repo with correct arguments', async () => {
  repo.findByBulkActionId.mockResolvedValue({ logs: [], total: 0 })

  await service.getLogs(bulkActionId, 'failure', 2, 25)

  expect(repo.findByBulkActionId).toHaveBeenCalledWith(bulkActionId, 'failure', 2, 25)
})

test('getLogs returns repo result unchanged', async () => {
  const expected = { logs: [{ id: 'log-1' }], total: 1 }
  repo.findByBulkActionId.mockResolvedValue(expected)

  const result = await service.getLogs(bulkActionId, null, 1, 50)

  expect(result).toBe(expected)
})
