// src/queues/batch.queue.js
const { Queue } = require('bullmq')
const redis = require('../config/redis')

const batchQueue = new Queue('batch', {
  connection: redis,
  defaultJobOptions: {
    attempts:    5,
    backoff:     { type: 'exponential', delay: 1000 },
    removeOnComplete: 1000,
    removeOnFail:     2000,
  },
})

module.exports = batchQueue
