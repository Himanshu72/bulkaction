// src/workers/flush.worker.js
const progressService = require('../services/progress.service')
const bulkActionRepo  = require('../repositories/bulkAction.repository')

const INTERVAL_MS = 10000

let intervalHandle = null

async function flush() {
  try {
    const active = await bulkActionRepo.findStuck()
    await Promise.all(
      active.map(ba => progressService.flush(ba.id, bulkActionRepo).catch(console.error))
    )
  } catch (err) {
    console.error('Flush worker error:', err.message)
  }
}

function start() {
  intervalHandle = setInterval(flush, INTERVAL_MS)
}

function stop() {
  if (intervalHandle) clearInterval(intervalHandle)
}

module.exports = { start, stop }
