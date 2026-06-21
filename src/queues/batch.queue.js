// src/queues/batch.queue.js
const { Queue } = require('bullmq')
const redis = require('../config/redis')

const batchQueue = new Queue('batch', {
  connection: redis,
  defaultJobOptions: {
    removeOnComplete: 1000,
    removeOnFail:     2000,
  },
})

module.exports = batchQueue
