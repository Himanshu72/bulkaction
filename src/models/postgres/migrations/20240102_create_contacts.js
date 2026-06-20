exports.up = async (knex) => {
  await knex.schema.createTable('contacts', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'))
    t.uuid('account_id').notNullable().references('id').inTable('accounts').onDelete('CASCADE')
    t.string('name', 255)
    t.string('email', 255).notNullable()
    t.integer('age')
    t.string('status', 50).defaultTo('active')
    t.jsonb('metadata').defaultTo('{}')
    t.timestamp('created_at').defaultTo(knex.fn.now())
    t.timestamp('updated_at').defaultTo(knex.fn.now())
  })
  await knex.raw('CREATE UNIQUE INDEX idx_contacts_email ON contacts(email)')
  await knex.raw('CREATE INDEX idx_contacts_account_status ON contacts(account_id, status)')
}

exports.down = (knex) => knex.schema.dropTableIfExists('contacts')
