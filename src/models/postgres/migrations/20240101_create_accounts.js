exports.up = (knex) => knex.schema.createTable('accounts', (t) => {
  t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'))
  t.string('name', 255).notNullable()
  t.integer('rate_limit').notNullable().defaultTo(10000)
  t.timestamp('created_at').defaultTo(knex.fn.now())
})

exports.down = (knex) => knex.schema.dropTableIfExists('accounts')
