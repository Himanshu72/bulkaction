// seeds/contacts.seed.js
require('dotenv').config()
const db = require('../src/config/postgres')

const ACCOUNT_ID = 'dddddddd-dddd-dddd-dddd-dddddddddddd'
const STATUSES   = ['active', 'inactive', 'churned', 'lead']

function randomEmail(i) {
  return `contact${i}_${Math.random().toString(36).slice(2, 7)}@example.com`
}

async function seed() {
  await db('accounts').insert({ id: ACCOUNT_ID, name: 'Demo Account' }).onConflict('id').ignore()
  console.log('Account seeded')

  const batchSize = 200
  const total     = 2000

  for (let i = 0; i < total; i += batchSize) {
    const batch = Array.from({ length: batchSize }, (_, j) => ({
      account_id: ACCOUNT_ID,
      name:       `Contact ${i + j + 1}`,
      email:      randomEmail(i + j + 1),
      age:        Math.floor(Math.random() * 60) + 18,
      status:     STATUSES[Math.floor(Math.random() * STATUSES.length)],
    }))
    await db('contacts').insert(batch).onConflict('email').ignore()
    console.log(`Seeded ${Math.min(i + batchSize, total)} / ${total}`)
  }

  console.log(`Done. Account ID: ${ACCOUNT_ID}`)
  await db.destroy()
}

seed().catch(err => { console.error(err); process.exit(1) })
