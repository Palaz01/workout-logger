#!/bin/sh
set -e

echo "Running database schema sync..."
cd lib/db
npx drizzle-kit push --config ./drizzle.config.ts --force
cd /app

echo "Creating session table if not exists..."
node -e "
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
pool.query(\`
  CREATE TABLE IF NOT EXISTS \"session\" (
    \"sid\" varchar NOT NULL COLLATE \"default\",
    \"sess\" json NOT NULL,
    \"expire\" timestamp(6) NOT NULL,
    CONSTRAINT \"session_pkey\" PRIMARY KEY (\"sid\")
  );
  CREATE INDEX IF NOT EXISTS \"IDX_session_expire\" ON \"session\" (\"expire\");
\`).then(() => { console.log('Session table ready'); pool.end(); }).catch(e => { console.error('Session table error:', e); pool.end(); process.exit(1); });
"

echo "Starting server..."
node artifacts/api-server/dist/index.cjs
