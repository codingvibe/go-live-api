export function up(knex) {
  return knex.schema
    .createTable('user_data', function (table) {
        table.string('twitchId', 255).primary().unique().notNullable();
        table.string('connections', 2048);
        table.string('goLiveText', 2048);
        table.datetime('createdAt').notNullable().defaultTo(knex.fn.now());
        table.datetime('updatedAt').notNullable().defaultTo(knex.fn.now());
    });
};

export function down(knex) {
  return knex.schema
      .dropTable("user_data");
};