import { Sequelize } from 'sequelize';
import { env } from './env';

let sequelize: Sequelize;

// Only initialize Sequelize if an architecture that requires a database is chosen.
if (env.ARCHITECTURE !== 'none') {
  // Inside this block, we can now safely assume that the DB env variables *should* exist.
  if (!env.DB_DIALECT || !env.DB_HOST || !env.DB_PORT || !env.DB_USER || !env.DB_NAME) {
    console.error('------------------------------------------------------------------------');
    console.error(`ERROR: The chosen architecture ('${env.ARCHITECTURE}') requires a database.`);
    console.error('Please provide database credentials in your .env file.');
    console.error('------------------------------------------------------------------------');
    process.exit(1);
  }

  sequelize = new Sequelize(env.DB_NAME, env.DB_USER, env.DB_PASSWORD, {
    host: env.DB_HOST,
    port: env.DB_PORT,
    dialect: env.DB_DIALECT as any,
    logging: false,
  });
}

// Export the sequelize instance. It will be undefined if architecture is 'none'.
// The code in application.ts already checks the architecture before using it, so this is safe.
export { sequelize };