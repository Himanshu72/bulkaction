require('dotenv').config()
const Redis = require('ioredis')

const isTest = process.env.NODE_ENV === 'test'

const redis = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  db:   isTest ? parseInt(process.env.REDIS_DB_TEST || '1') : 0,
  maxRetriesPerRequest: null,  // required by BullMQ
})

module.exports = redis
