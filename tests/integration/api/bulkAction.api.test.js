// tests/integration/api/bulkAction.api.test.js
const request = require('supertest')
const app     = require('../../../src/app')
const db      = require('../../../src/config/postgres')
const { connectMongo, mongoose } = require('../../../src/config/mongodb')

const ACCOUNT_ID = 'cccccccc-cccc-cccc-cccc-cccccccccccc'

beforeAll(async () => {
  await connectMongo()
  await db('accounts').insert({ id: ACCOUNT_ID, name: 'API Test Account' }).onConflict('id').ignore()
})

afterAll(async () => {
  await db('bulk_actions').where({ account_id: ACCOUNT_ID }).delete()
  await db('accounts').where({ id: ACCOUNT_ID }).delete()
})

test('POST /bulk-actions returns 400 for missing required fields', async () => {
  const res = await request(app).post('/bulk-actions').send({})
  expect(res.status).toBe(400)
})

test('POST /bulk-actions returns 400 when neither filters nor entityIds provided', async () => {
  const res = await request(app).post('/bulk-actions').send({
    accountId: ACCOUNT_ID, entityType: 'contact',
    actionType: 'bulk_update', payload: { fields: { status: 'active' } },
  })
  expect(res.status).toBe(400)
})

test('POST /bulk-actions creates bulk action with filters', async () => {
  const res = await request(app).post('/bulk-actions').send({
    accountId: ACCOUNT_ID, entityType: 'contact', actionType: 'bulk_update',
    filters: { status: 'inactive' },
    payload: { fields: { status: 'active' } },
  })
  expect(res.status).toBe(201)
  expect(res.body).toHaveProperty('id')
  expect(['queued', 'scheduled']).toContain(res.body.status)
})

test('GET /bulk-actions requires accountId', async () => {
  const res = await request(app).get('/bulk-actions')
  expect(res.status).toBe(400)
})

test('GET /bulk-actions lists actions for account', async () => {
  const res = await request(app).get(`/bulk-actions?accountId=${ACCOUNT_ID}`)
  expect(res.status).toBe(200)
  expect(res.body).toHaveProperty('rows')
  expect(res.body).toHaveProperty('total')
})

test('GET /bulk-actions/:id returns 404 for unknown id', async () => {
  const res = await request(app).get('/bulk-actions/00000000-0000-0000-0000-000000000000')
  expect(res.status).toBe(404)
})

test('GET /bulk-actions/:id returns progress for existing action', async () => {
  const create = await request(app).post('/bulk-actions').send({
    accountId: ACCOUNT_ID, entityType: 'contact', actionType: 'bulk_update',
    filters: { status: 'inactive' }, payload: { fields: { status: 'active' } },
  })
  const res = await request(app).get(`/bulk-actions/${create.body.id}`)
  expect(res.status).toBe(200)
  expect(res.body).toHaveProperty('progressPercent')
})
