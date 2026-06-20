const db    = require('../../src/config/postgres')
const redis = require('../../src/config/redis')
const { connectMongo, mongoose } = require('../../src/config/mongodb')

beforeAll(() => connectMongo())
afterAll(async () => {
})

test('postgres connection', async () => {
  const result = await db.raw('SELECT 1+1 AS result')
  expect(result.rows[0].result).toBe(2)
})

test('redis connection', async () => {
  await redis.set('test:ping', 'pong')
  const val = await redis.get('test:ping')
  expect(val).toBe('pong')
  await redis.del('test:ping')
})

test('mongo connection', () => {
  expect(mongoose.connection.readyState).toBe(1)
})
