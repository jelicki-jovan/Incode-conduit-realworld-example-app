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

// IAM database authentication (PROD_DB_IAM_AUTH=true, only the running app; migrations use the
// master password): no password, a 15-min token is signed with the pod's IAM role (IRSA) before
// every NEW connection. Signing is local (no AWS call per connection); pooled connections stay open
// after the token expires, it's only checked at login. Needs TLS (above).
const prodIamAuth =
  process.env.PROD_DB_IAM_AUTH === "true"
    ? (() => {
        const { Signer } = require("@aws-sdk/rds-signer");
        const signer = new Signer({
          hostname: process.env.PROD_DB_HOSTNAME,
          port: 5432,
          username: process.env.PROD_DB_USERNAME,
          region: process.env.AWS_REGION,
        });
        return {
          hooks: {
            beforeConnect: async (connectionConfig) => {
              connectionConfig.password = await signer.getAuthToken();
            },
          },
        };
      })()
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
    ...prodIamAuth,
  },
};
