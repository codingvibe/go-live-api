// Update with your config settings.
import dotenv from 'dotenv';
dotenv.config();

/**
 * @type { Object.<string, import("knex").Knex.Config> }
 */

const POSTGRES_HOST = process.env.POSTGRES_HOST
const POSTGRES_PORT = process.env.POSTGRES_PORT
const POSTGRES_USERNAME = process.env.POSTGRES_USERNAME
const POSTGRES_PASSWORD = process.env.POSTGRES_PASSWORD
const POSTGRESS_DATABASE = process.env.POSTGRESS_DATABASE

export default {
  development: {
    client: 'postgresql',
    connection: {
      host:     POSTGRES_HOST,
      port:     POSTGRES_PORT,
      database: POSTGRESS_DATABASE,
      user:     POSTGRES_USERNAME,
      password: POSTGRES_PASSWORD
    },
    pool: {
      min: 1,
      max: 10
    },
    migrations: {
      tableName: 'knex_migrations'
    }
  }
};
