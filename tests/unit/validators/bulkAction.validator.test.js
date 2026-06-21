// tests/unit/validators/bulkAction.validator.test.js
const { validateCreatePayload } = require('../../../src/validators/bulkAction.validator')

const base = {
  accountId:  'a1b2c3d4-0000-0000-0000-000000000000',
  entityType: 'contact',
  actionType: 'bulk_update',
  entityIds:  ['b1b2c3d4-0000-0000-0000-000000000001'],
  payload:    { fields: { name: 'Alice' } },
}

test('valid contact payload passes', () => {
  const { error } = validateCreatePayload(base)
  expect(error).toBeUndefined()
})

test('rejects unknown entityType', () => {
  const { error } = validateCreatePayload({ ...base, entityType: 'invoice' })
  expect(error).toBeDefined()
})

test('accepts any entityType registered in the entity registry', () => {
  // Add a second entity type to the registry and the validator should accept it
  const registry = require('../../../src/entities/registry')
  registry._test_register('lead', { repository: {}, validator: () => {}, filterableFields: [] })

  const { error } = validateCreatePayload({ ...base, entityType: 'lead' })
  expect(error).toBeUndefined()

  registry._test_unregister('lead')
})

test('requires at least one of filters or entityIds', () => {
  const { accountId, entityType, actionType, payload } = base
  const { error } = validateCreatePayload({ accountId, entityType, actionType, payload })
  expect(error).toBeDefined()
})

test('strips unknown top-level keys', () => {
  const { error, value } = validateCreatePayload({ ...base, extraKey: 'oops' })
  expect(error).toBeUndefined()
  expect(value.extraKey).toBeUndefined()
})

test('priority defaults to 5', () => {
  const { value } = validateCreatePayload(base)
  expect(value.priority).toBe(5)
})
