exports.up = (knex) => knex.schema.table('bulk_actions', (t) => {
  t.text('error_message').nullable()
})

exports.down = (knex) => knex.schema.table('bulk_actions', (t) => {
  t.dropColumn('error_message')
})
