const fs = require("fs");

// TLS to the database (RDS enforces it with rds.force_ssl=1). Verifies the server certificate
// against the RDS CA bundle (equivalent of sslmode=verify-full). Off when PROD_DB_SSL isn't "true",
// e.g. for a local Postgres without TLS.
const prodSsl =
  process.env.PROD_DB_SSL === "true"
    ? {
        ssl: {
          require: true,
          rejectUnauthorized: true,
          ca: fs.readFileSync(process.env.PROD_DB_SSL_CA),
        },
      }
    : {};

/** @type {import('sequelize').Options} */
module.exports = {
  development: {
    username: process.env.DEV_DB_USERNAME,
    password: process.env.DEV_DB_PASSWORD,
    database: process.env.DEV_DB_NAME,
    host: process.env.DEV_DB_HOSTNAME,
    dialect: process.env.DEV_DB_DIALECT,
    logging: process.env.DEV_DB_LOGGING,
  },
  test: {
    username: process.env.TEST_DB_USERNAME,
    password: process.env.TEST_DB_PASSWORD,
    database: process.env.TEST_DB_NAME,
    host: process.env.TEST_DB_HOSTNAME,
    dialect: process.env.TEST_DB_DIALECT,
    logging: process.env.TEST_DB_LOGGING,
  },
  production: {
    username: process.env.PROD_DB_USERNAME,
    password: process.env.PROD_DB_PASSWORD,
    database: process.env.PROD_DB_NAME,
    host: process.env.PROD_DB_HOSTNAME,
    dialect: process.env.PROD_DB_DIALECT,
    // env vars are strings: "false" would be truthy and log every SQL query
    logging: process.env.PROD_DB_LOGGING === "true" ? console.log : false,
    dialectOptions: prodSsl,
  },
};
