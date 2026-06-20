require('dotenv').config()
const mongoose = require('mongoose')

const isTest = process.env.NODE_ENV === 'test'
const uri = isTest
  ? (process.env.MONGO_URI_TEST || 'mongodb://localhost:27017/crm_bulk_test')
  : (process.env.MONGO_URI      || 'mongodb://localhost:27017/crm_bulk')

async function connectMongo() {
  await mongoose.connect(uri)
}

module.exports = { connectMongo, mongoose }
