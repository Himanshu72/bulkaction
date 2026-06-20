// tests/unit/handlers/bulkUpdate.handler.test.js
const BulkUpdateHandler = require('../../../src/handlers/bulkUpdate.handler')

const handler = new BulkUpdateHandler()

const entity = { id: 'c1', email: 'a@test.com', updated_at: new Date('2024-01-01') }

const makeCtx = ({ updateReturn = true, validReturn = { valid: true } } = {}) => ({
  repository: { updateById: jest.fn().mockResolvedValue(updateReturn) },
  validator:  jest.fn().mockResolvedValue(validReturn),
  db:         {},
  bulkActionStartedAt: new Date('2024-06-01'),
})

test('returns success when valid and update succeeds', async () => {
  const ctx = makeCtx()
  const result = await handler.execute(entity, { fields: { status: 'active' } }, ctx)
  expect(result.status).toBe('success')
})

test('returns failure when validation fails', async () => {
  const ctx = makeCtx({ validReturn: { valid: false, errors: ['Invalid email format'] } })
  const result = await handler.execute(entity, { fields: { email: 'bad' } }, ctx)
  expect(result.status).toBe('failure')
  expect(result.error).toMatch(/invalid email/i)
})

test('returns skipped when optimistic lock fails', async () => {
  const ctx = makeCtx({ updateReturn: false })
  const result = await handler.execute(entity, { fields: { status: 'active' } }, ctx)
  expect(result.status).toBe('skipped')
  expect(result.error).toMatch(/concurrent/i)
})

test('calls validator with entity and fields', async () => {
  const ctx = makeCtx()
  await handler.execute(entity, { fields: { age: 30 } }, ctx)
  expect(ctx.validator).toHaveBeenCalledWith(entity, { age: 30 }, ctx.db)
})

test('calls updateById with entity id and bulkActionStartedAt', async () => {
  const ctx = makeCtx()
  await handler.execute(entity, { fields: { age: 30 } }, ctx)
  expect(ctx.repository.updateById).toHaveBeenCalledWith(
    'c1', { age: 30 }, ctx.bulkActionStartedAt
  )
})
