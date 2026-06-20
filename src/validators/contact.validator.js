// src/validators/contact.validator.js
const UPDATABLE_FIELDS = new Set(['name', 'email', 'age', 'status', 'metadata'])
const VALID_STATUSES   = new Set(['active', 'inactive', 'churned', 'lead'])
const EMAIL_RE         = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

async function validateContactUpdate(entity, fields, db) {
  const errors = []

  for (const key of Object.keys(fields)) {
    if (!UPDATABLE_FIELDS.has(key))
      errors.push(`Field '${key}' is not updatable`)
  }

  if (fields.email !== undefined) {
    if (!EMAIL_RE.test(fields.email)) {
      errors.push('Invalid email format')
    } else {
      const res = await db.query(
        'SELECT id FROM contacts WHERE email = $1 AND id != $2',
        [fields.email, entity.id]
      )
      if (res.rows.length)
        errors.push(`Email already in use by contact ${res.rows[0].id}`)
    }
  }

  if (fields.age !== undefined) {
    if (!Number.isInteger(fields.age) || fields.age < 0 || fields.age > 150)
      errors.push('Age must be an integer between 0 and 150')
  }

  if (fields.name !== undefined) {
    if (typeof fields.name !== 'string' || fields.name.length < 1 || fields.name.length > 255)
      errors.push('Name must be between 1 and 255 characters')
  }

  if (fields.status !== undefined) {
    if (!VALID_STATUSES.has(fields.status))
      errors.push(`Status must be one of: ${[...VALID_STATUSES].join(', ')}`)
  }

  return errors.length ? { valid: false, errors } : { valid: true }
}

module.exports = { validateContactUpdate }
