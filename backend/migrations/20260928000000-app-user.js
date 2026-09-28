"use strict";

// Least-privilege database user for the running app. Migrations keep running as the master user
// (they change the schema); the app only reads/writes rows. On RDS the app logs in with IAM auth
// (rds_iam role → 15-min token from its IAM role, no password). Idempotent: safe to re-run.
module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'app_user') THEN
          CREATE ROLE app_user WITH LOGIN;
        END IF;
        -- rds_iam only exists on RDS (not in a local Postgres)
        IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'rds_iam') THEN
          GRANT rds_iam TO app_user;
        END IF;
        EXECUTE format('GRANT CONNECT ON DATABASE %I TO app_user', current_database());
      END
      $$;

      GRANT USAGE ON SCHEMA public TO app_user;
      GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app_user;
      GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO app_user;
      -- Migrations bookkeeping is not the app's business
      REVOKE ALL ON "SequelizeMeta" FROM app_user;

      -- Tables/sequences created by future migrations (run as this same master user)
      ALTER DEFAULT PRIVILEGES IN SCHEMA public
        GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO app_user;
      ALTER DEFAULT PRIVILEGES IN SCHEMA public
        GRANT USAGE, SELECT ON SEQUENCES TO app_user;
    `);
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(`
      DROP OWNED BY app_user;
      DROP ROLE IF EXISTS app_user;
    `);
  },
};
