// tests/unit/registries.test.js
const { getEntity } = require('../../src/entities/registry')
const { getHandler } = require('../../src/handlers/registry')

test('getEntity returns contact registry entry', () => {
  const entry = getEntity('contact')
  expect(entry).toHaveProperty('repository')
  expect(entry).toHaveProperty('validator')
  expect(entry).toHaveProperty('logMetadata')
  expect(typeof entry.logMetadata).toBe('function')
  expect(entry.logMetadata({ email: 'x@test.com' })).toEqual({ email: 'x@test.com' })
})

test('getEntity throws for unknown entity type', () => {
  expect(() => getEntity('unicorn')).toThrow(/unknown entity type/i)
})

test('getHandler returns bulk_update handler', () => {
  const handler = getHandler('bulk_update')
  expect(typeof handler.execute).toBe('function')
})

test('getHandler throws for unknown action type', () => {
  expect(() => getHandler('bulk_teleport')).toThrow(/unknown action/i)
})
