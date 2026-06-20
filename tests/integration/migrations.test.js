const db = require('../../src/config/postgres')

test('accounts table exists with correct columns', async () => {
  const cols = await db('accounts').columnInfo()
  expect(cols).toHaveProperty('id')
  expect(cols).toHaveProperty('rate_limit')
})

test('contacts email unique index exists', async () => {
  await db('accounts').insert({ id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', name: 'Test' })
  await db('contacts').insert({
    account_id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    email: 'dup@test.com', name: 'A'
  })
  await expect(
    db('contacts').insert({
      account_id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      email: 'dup@test.com', name: 'B'
    })
  ).rejects.toThrow(/unique/i)

  await db('contacts').delete()
  await db('accounts').delete()
})

afterAll(async () => {
  await db.destroy()
})
