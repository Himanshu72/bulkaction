// tests/integration/repositories/contact.repository.test.js
const db   = require('../../../src/config/postgres')
const repo = require('../../../src/repositories/contact.repository')

const ACCOUNT_ID = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'

beforeAll(async () => {
  await db('accounts').insert({ id: ACCOUNT_ID, name: 'Test Account' }).onConflict('id').ignore()
  await db('contacts').insert([
    { account_id: ACCOUNT_ID, email: 'alice@test.com', name: 'Alice', status: 'inactive', age: 30 },
    { account_id: ACCOUNT_ID, email: 'bob@test.com',   name: 'Bob',   status: 'active',   age: 25 },
    { account_id: ACCOUNT_ID, email: 'carol@test.com', name: 'Carol', status: 'inactive', age: 28 },
  ]).onConflict('email').ignore()
})

afterAll(async () => {
  await db('contacts').where({ account_id: ACCOUNT_ID }).delete()
  await db('accounts').where({ id: ACCOUNT_ID }).delete()
  await db.destroy()
})

test('paginatedFetch returns contacts matching filter', async () => {
  const rows = await repo.paginatedFetch({ status: 'inactive' }, null, 500)
  expect(rows.length).toBeGreaterThanOrEqual(2)
  rows.forEach(r => expect(r.status).toBe('inactive'))
})

test('paginatedFetch cursor paginates', async () => {
  const page1 = await repo.paginatedFetch({}, null, 2)
  expect(page1.length).toBe(2)
  const cursor = page1[page1.length - 1].id
  const page2 = await repo.paginatedFetch({}, cursor, 2)
  expect(page2.every(r => r.id > cursor)).toBe(true)
})

test('fetchByIds returns exact records', async () => {
  const all = await repo.paginatedFetch({}, null, 500)
  const ids = all.slice(0, 2).map(r => r.id)
  const result = await repo.fetchByIds(ids)
  expect(result.length).toBe(2)
})

test('updateById with optimistic lock — succeeds when updated_at is old', async () => {
  const [contact] = await repo.paginatedFetch({ status: 'inactive' }, null, 1)
  const updated = await repo.updateById(contact.id, { status: 'active' }, contact.updated_at)
  expect(updated).toBe(true)
})

test('updateById with optimistic lock — skips when record was updated after lock time', async () => {
  const [contact] = await repo.paginatedFetch({}, null, 1)
  const pastDate = new Date('2000-01-01')
  const updated = await repo.updateById(contact.id, { status: 'inactive' }, pastDate)
  expect(updated).toBe(false)
})
