require('dotenv').config()
const Redis = require('ioredis')

const isTest = process.env.NODE_ENV === 'test'

// Support REDIS_URL (Upstash / cloud) or individual host/port env vars
const redis = process.env.REDIS_URL
  ? new Redis(process.env.REDIS_URL, {
      maxRetriesPerRequest: null,
      tls: { rejectUnauthorized: false },
    })
  : new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      db:   isTest ? parseInt(process.env.REDIS_DB_TEST || '1') : 0,
      maxRetriesPerRequest: null,
    })

module.exports = redis
