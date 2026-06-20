// tests/unit/models/bulkActionLog.model.test.js
const { connectMongo, mongoose } = require('../../../src/config/mongodb')
const BulkActionLog = require('../../../src/models/mongodb/bulkActionLog.model')

beforeAll(() => connectMongo())
afterAll(async () => {
  await BulkActionLog.deleteMany({ bulkActionId: 'test-model' })
})

test('inserts and retrieves a log entry', async () => {
  await BulkActionLog.create({
    bulkActionId: 'test-model',
    entityId:     'contact-1',
    entityType:   'contact',
    status:       'success',
  })
  const doc = await BulkActionLog.findOne({ bulkActionId: 'test-model' })
  expect(doc.status).toBe('success')
  expect(doc.entityType).toBe('contact')
})

test('rejects invalid status', async () => {
  await expect(
    BulkActionLog.create({
      bulkActionId: 'test-model', entityId: 'c2',
      entityType: 'contact', status: 'bad_status'
    })
  ).rejects.toThrow()
})
