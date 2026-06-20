// src/models/mongodb/bulkActionLog.model.js
const { mongoose } = require('../../config/mongodb')

const schema = new mongoose.Schema({
  bulkActionId: { type: String, required: true },
  entityId:     { type: String, required: true },
  entityType:   { type: String, required: true },
  status:       { type: String, enum: ['success', 'failure', 'skipped'], required: true },
  errorMessage: { type: String, default: null },
  processedAt:  { type: Date,   default: Date.now },
  metadata:     { type: mongoose.Schema.Types.Mixed, default: {} },
}, { versionKey: false })

schema.index({ bulkActionId: 1, status: 1 })
schema.index({ bulkActionId: 1, processedAt: -1 })

module.exports = mongoose.model('BulkActionLog', schema)
