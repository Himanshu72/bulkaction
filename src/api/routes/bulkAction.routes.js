// src/api/routes/bulkAction.routes.js
const { Router } = require('express')
const ctrl = require('../controllers/bulkAction.controller')

const router = Router()
router.post('/',              ctrl.create)
router.get('/',               ctrl.list)
router.get('/:id',            ctrl.getOne)
router.get('/:id/stats',      ctrl.getStats)
router.get('/:id/logs',       ctrl.getLogs)

module.exports = router
