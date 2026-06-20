// tests/unit/validators/contact.validator.test.js
const { validateContactUpdate } = require('../../../src/validators/contact.validator')

const mockDb = { query: jest.fn().mockResolvedValue({ rows: [] }) }
const entity = { id: 'contact-1', email: 'old@test.com' }

test('valid fields pass', async () => {
  const r = await validateContactUpdate(entity, { name: 'Alice', age: 30, status: 'active' }, mockDb)
  expect(r.valid).toBe(true)
})

test('unknown field rejected', async () => {
  const r = await validateContactUpdate(entity, { unknownField: 'x' }, mockDb)
  expect(r.valid).toBe(false)
  expect(r.errors[0]).toMatch(/not updatable/)
})

test('invalid email format rejected', async () => {
  const r = await validateContactUpdate(entity, { email: 'not-an-email' }, mockDb)
  expect(r.valid).toBe(false)
  expect(r.errors[0]).toMatch(/email format/i)
})

test('email in use by another contact rejected', async () => {
  const dbWithConflict = { query: jest.fn().mockResolvedValue({ rows: [{ id: 'other-contact' }] }) }
  const r = await validateContactUpdate(entity, { email: 'taken@test.com' }, dbWithConflict)
  expect(r.valid).toBe(false)
  expect(r.errors[0]).toMatch(/already in use/)
})

test('age out of range rejected', async () => {
  const r = await validateContactUpdate(entity, { age: 200 }, mockDb)
  expect(r.valid).toBe(false)
  expect(r.errors[0]).toMatch(/0 and 150/)
})

test('age must be integer', async () => {
  const r = await validateContactUpdate(entity, { age: 25.5 }, mockDb)
  expect(r.valid).toBe(false)
})

test('invalid status rejected', async () => {
  const r = await validateContactUpdate(entity, { status: 'unknown' }, mockDb)
  expect(r.valid).toBe(false)
  expect(r.errors[0]).toMatch(/status must be one of/i)
})

test('name too long rejected', async () => {
  const r = await validateContactUpdate(entity, { name: 'a'.repeat(256) }, mockDb)
  expect(r.valid).toBe(false)
})

test('empty name rejected', async () => {
  const r = await validateContactUpdate(entity, { name: '' }, mockDb)
  expect(r.valid).toBe(false)
})

test('multiple errors returned at once', async () => {
  const r = await validateContactUpdate(entity, { age: -1, status: 'bad' }, mockDb)
  expect(r.valid).toBe(false)
  expect(r.errors.length).toBe(2)
})
