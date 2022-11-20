export function up(knex) {
  return knex.schema
    .createTable('user_images', function (table) {
        table.string('id', 255).notNullable();
        table.string('twitchId', 255).notNullable();
        table.foreign('twitchId').references('user_data.twitchId');
        table.string('url', 1024).notNullable();
        table.string('altText', 2048);
        table.datetime('createdAt').notNullable().defaultTo(knex.fn.now());
    });
};

export function down(knex) {
  return knex.schema
      .dropTable("user_images");
};