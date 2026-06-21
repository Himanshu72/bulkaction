// src/app.js
const express        = require('express')
const errorHandler   = require('./api/middlewares/errorHandler')
const bulkRoutes     = require('./api/routes/bulkAction.routes')
const healthRoutes   = require('./api/routes/health.routes')
const { connectMongo } = require('./config/mongodb')

// Connect MongoDB once per process (works for both long-running server and Vercel cold starts)
connectMongo().catch(err => console.error('MongoDB connect error:', err.message))

const app = express()
app.use(express.json())
app.use('/health',       healthRoutes)
app.use('/bulk-actions', bulkRoutes)
app.use(errorHandler)

module.exports = app
