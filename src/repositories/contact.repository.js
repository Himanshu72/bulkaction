// src/repositories/contact.repository.js
const db = require('../config/postgres')

async function paginatedFetch(filters = {}, cursor = null, limit = 500) {
  let query = db('contacts').select('*').orderBy('id', 'asc').limit(limit)
  if (cursor) query = query.where('id', '>', cursor)
  if (filters.status) query = query.where('status', filters.status)
  if (filters.age)    query = query.where('age', filters.age)
  if (filters.name)   query = query.where('name', 'ilike', `%${filters.name}%`)
  return query
}

async function fetchByIds(ids) {
  if (!ids.length) return []
  return db('contacts').select('*').whereIn('id', ids)
}

async function updateById(id, fields, updatedAtBefore) {
  const allowed = ['name', 'email', 'age', 'status', 'metadata']
  const safe = {}
  for (const [k, v] of Object.entries(fields)) {
    if (allowed.includes(k)) safe[k] = v
  }
  safe.updated_at = new Date()

  // Add 1ms buffer to handle microsecond precision differences between JS Date and PostgreSQL
  const updatedAtThreshold = new Date(new Date(updatedAtBefore).getTime() + 1)

  const rows = await db('contacts')
    .where('id', id)
    .where('updated_at', '<', updatedAtThreshold)
    .update(safe)
    .returning('id')

  return rows.length > 0
}

module.exports = { paginatedFetch, fetchByIds, updateById }
