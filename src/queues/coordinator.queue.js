// src/queues/coordinator.queue.js
const { Queue } = require('bullmq')
const redis = require('../config/redis')

const coordinatorQueue = new Queue('coordinator', {
  connection: redis,
  defaultJobOptions: {
    attempts:    3,
    backoff:     { type: 'exponential', delay: 2000 },
    removeOnComplete: 100,
    removeOnFail:     500,
  },
})

module.exports = coordinatorQueue
