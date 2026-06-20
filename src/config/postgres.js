require('dotenv').config()
const knex = require('knex')

const isTest = process.env.NODE_ENV === 'test'

const db = knex({
  client: 'pg',
  connection: {
    host:     process.env.POSTGRES_HOST     || 'localhost',
    port:     parseInt(process.env.POSTGRES_PORT || '5432'),
    database: isTest
      ? (process.env.POSTGRES_DB_TEST || 'crm_bulk_test')
      : (process.env.POSTGRES_DB     || 'crm_bulk'),
    user:     process.env.POSTGRES_USER     || 'postgres',
    password: process.env.POSTGRES_PASSWORD || 'postgres',
  },
  pool: { min: 2, max: 10 },
})

module.exports = db
