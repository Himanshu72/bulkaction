// src/app.js
const express      = require('express')
const errorHandler = require('./api/middlewares/errorHandler')
const bulkRoutes   = require('./api/routes/bulkAction.routes')

const app = express()
app.use(express.json())
app.use('/bulk-actions', bulkRoutes)
app.use(errorHandler)

module.exports = app
