// tests/e2e/bulkAction.e2e.test.js
const request = require('supertest')
const app     = require('../../src/app')
const db      = require('../../src/config/postgres')
const redis   = require('../../src/config/redis')
const { connectMongo, mongoose } = require('../../src/config/mongodb')
const BulkActionLog = require('../../src/models/mongodb/bulkActionLog.model')

// Workers are imported inside beforeAll (after Redis flush) to avoid picking
// up stale BullMQ jobs left in the test Redis DB by earlier test suites.
let coordinatorWorker, batchWorker

const ACCOUNT_ID = 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee'

function wait(ms) { return new Promise(r => setTimeout(r, ms)) }

beforeAll(async () => {
  // Flush Redis test DB to remove stale BullMQ jobs from previous test runs
  await redis.flushdb()

  await connectMongo()
  await db('accounts').insert({ id: ACCOUNT_ID, name: 'E2E Account' }).onConflict('id').ignore()
  // Use merge() so re-runs reset contacts to known state (status: inactive)
  await db('contacts').insert([
    { account_id: ACCOUNT_ID, email: 'e2e1@test.com', name: 'E2E One', status: 'inactive', age: 20 },
    { account_id: ACCOUNT_ID, email: 'e2e2@test.com', name: 'E2E Two', status: 'inactive', age: 22 },
    { account_id: ACCOUNT_ID, email: 'e2e3@test.com', name: 'E2E Three', status: 'inactive', age: 24 },
  ]).onConflict('email').merge()

  // Import workers after flush so they start with a clean queue
  coordinatorWorker = require('../../src/workers/coordinator.worker')
  batchWorker       = require('../../src/workers/batch.worker')
})

afterAll(async () => {
  await coordinatorWorker.close()
  await batchWorker.close()
  await db('contacts').where({ account_id: ACCOUNT_ID }).delete()
  await db('bulk_actions').where({ account_id: ACCOUNT_ID }).delete()
  await db('accounts').where({ id: ACCOUNT_ID }).delete()
  await BulkActionLog.deleteMany({ bulkActionId: { $regex: /^.*/ } }).catch(() => {})
  await db.destroy()
  await mongoose.disconnect()
})

test('end-to-end: create bulk update and wait for completion', async () => {
  const create = await request(app).post('/bulk-actions').send({
    accountId: ACCOUNT_ID, entityType: 'contact', actionType: 'bulk_update',
    filters: { status: 'inactive' },
    payload: { fields: { status: 'active' } },
  })
  expect(create.status).toBe(201)
  const id = create.body.id

  // Poll until completed (max 30s)
  let completed = false
  for (let i = 0; i < 30; i++) {
    await wait(1000)
    const status = await request(app).get(`/bulk-actions/${id}`)
    if (status.body.status === 'completed') { completed = true; break }
  }
  expect(completed).toBe(true)

  // Verify stats
  const stats = await request(app).get(`/bulk-actions/${id}/stats`)
  expect(stats.body.successCount).toBeGreaterThan(0)
  expect(stats.body.totalCount).toBeGreaterThan(0)

  // Verify logs exist
  const logs = await request(app).get(`/bulk-actions/${id}/logs`)
  expect(logs.body.total).toBeGreaterThan(0)

  // Verify contacts were actually updated in PostgreSQL
  const updated = await db('contacts').where({ account_id: ACCOUNT_ID, status: 'active' })
  expect(updated.length).toBeGreaterThan(0)
}, 40000)

test('end-to-end: dedup — duplicate entityIds are deduplicated', async () => {
  const contacts = await db('contacts').where({ account_id: ACCOUNT_ID }).select('id')
  const ids = [contacts[0].id, contacts[0].id]  // same ID twice

  const create = await request(app).post('/bulk-actions').send({
    accountId: ACCOUNT_ID, entityType: 'contact', actionType: 'bulk_update',
    entityIds: ids,
    payload: { fields: { age: 99 } },
  })
  expect(create.status).toBe(201)
  const id = create.body.id

  let completed = false
  for (let i = 0; i < 30; i++) {
    await wait(1000)
    const status = await request(app).get(`/bulk-actions/${id}`)
    if (status.body.status === 'completed') { completed = true; break }
  }
  expect(completed).toBe(true)

  // Coordinator deduplicates IDs: only 1 unique entity should be processed
  const stats = await request(app).get(`/bulk-actions/${id}/stats`)
  expect(stats.body.totalCount).toBe(1)
  expect(stats.body.successCount).toBeGreaterThanOrEqual(1)
}, 40000)
