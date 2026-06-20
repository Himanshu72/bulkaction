require('dotenv').config()

module.exports = {
  development: {
    client: 'pg',
    connection: {
      host:     process.env.POSTGRES_HOST,
      port:     process.env.POSTGRES_PORT,
      database: process.env.POSTGRES_DB,
      user:     process.env.POSTGRES_USER,
      password: process.env.POSTGRES_PASSWORD,
    },
    migrations: { directory: './src/models/postgres/migrations' },
    seeds:      { directory: './seeds' },
  },
  test: {
    client: 'pg',
    connection: {
      host:     process.env.POSTGRES_HOST,
      port:     process.env.POSTGRES_PORT,
      database: process.env.POSTGRES_DB_TEST || 'crm_bulk_test',
      user:     process.env.POSTGRES_USER,
      password: process.env.POSTGRES_PASSWORD,
    },
    migrations: { directory: './src/models/postgres/migrations' },
  },
}
