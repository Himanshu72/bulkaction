// src/api/controllers/bulkAction.controller.js
const { validateCreatePayload } = require('../../validators/bulkAction.validator')
const bulkActionService         = require('../../services/bulkAction.service')

async function create(req, res, next) {
  try {
    const { error, value } = validateCreatePayload(req.body)
    if (error) return res.status(400).json({ error: error.details.map(d => d.message) })
    const result = await bulkActionService.createBulkAction(value)
    res.status(201).json(result)
  } catch (err) { next(err) }
}

async function list(req, res, next) {
  try {
    const { accountId, status, page = 1, limit = 20 } = req.query
    if (!accountId) return res.status(400).json({ error: 'accountId is required' })
    const result = await bulkActionService.listBulkActions(accountId, { status }, +page, +limit)
    res.json(result)
  } catch (err) { next(err) }
}

async function getOne(req, res, next) {
  try {
    const result = await bulkActionService.getBulkActionWithProgress(req.params.id)
    if (!result) return res.status(404).json({ error: 'Not found' })
    res.json(result)
  } catch (err) {
    if (err.message && err.message.includes('invalid input syntax for type uuid')) {
      return res.status(404).json({ error: 'Not found' })
    }
    next(err)
  }
}

async function getStats(req, res, next) {
  try {
    const result = await bulkActionService.getBulkActionStats(req.params.id)
    if (!result) return res.status(404).json({ error: 'Not found' })
    res.json(result)
  } catch (err) { next(err) }
}

async function getLogs(req, res, next) {
  try {
    const { status, page = 1, limit = 50 } = req.query
    const result = await bulkActionService.getBulkActionLogs(
      req.params.id, status || null, +page, +limit
    )
    res.json(result)
  } catch (err) { next(err) }
}

module.exports = { create, list, getOne, getStats, getLogs }
