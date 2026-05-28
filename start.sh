#!/bin/sh
set -e

echo "Running database schema sync..."
cd lib/db
npx drizzle-kit push --config ./drizzle.config.ts --force

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

echo "Running snapshot backfill migration..."
node -e "
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
async function run() {
  const client = await pool.connect();
  try {
    await client.query('ALTER TABLE sessions ADD COLUMN IF NOT EXISTS snapshot_plan_name TEXT');
    await client.query('ALTER TABLE session_logs ADD COLUMN IF NOT EXISTS snapshot_exercise_name TEXT');
    await client.query('ALTER TABLE session_logs ADD COLUMN IF NOT EXISTS snapshot_measurement_type TEXT');
    await client.query('ALTER TABLE session_logs ADD COLUMN IF NOT EXISTS snapshot_set_description TEXT');
    await client.query('ALTER TABLE plan_sets ADD COLUMN IF NOT EXISTS description TEXT');
    await client.query('ALTER TABLE sessions ALTER COLUMN plan_id DROP NOT NULL');
    await client.query('ALTER TABLE session_logs ALTER COLUMN plan_set_id DROP NOT NULL');
    await client.query('ALTER TABLE session_logs ALTER COLUMN exercise_id DROP NOT NULL');
    await client.query('ALTER TABLE session_set_notes ALTER COLUMN plan_set_id DROP NOT NULL');

    const fks = [
      { t: 'sessions', c: 'sessions_plan_id_plans_id_fk', col: 'plan_id', ref: 'plans(id)' },
      { t: 'session_logs', c: 'session_logs_plan_set_id_plan_sets_id_fk', col: 'plan_set_id', ref: 'plan_sets(id)' },
      { t: 'session_logs', c: 'session_logs_exercise_id_exercises_id_fk', col: 'exercise_id', ref: 'exercises(id)' },
      { t: 'session_set_notes', c: 'session_set_notes_plan_set_id_plan_sets_id_fk', col: 'plan_set_id', ref: 'plan_sets(id)' },
    ];
    for (const fk of fks) {
      await client.query('ALTER TABLE ' + fk.t + ' DROP CONSTRAINT IF EXISTS ' + fk.c);
      await client.query('ALTER TABLE ' + fk.t + ' ADD CONSTRAINT ' + fk.c + ' FOREIGN KEY (' + fk.col + ') REFERENCES ' + fk.ref + ' ON DELETE SET NULL');
    }

    await client.query(\`
      UPDATE sessions s SET snapshot_plan_name = p.name
      FROM plans p WHERE s.plan_id = p.id AND s.snapshot_plan_name IS NULL
    \`);
    await client.query(\`
      UPDATE session_logs sl SET snapshot_exercise_name = e.name, snapshot_measurement_type = e.measurement_type
      FROM exercises e WHERE sl.exercise_id = e.id AND sl.snapshot_exercise_name IS NULL
    \`);
    await client.query(\`
      UPDATE session_logs sl SET snapshot_set_description = ps.description
      FROM plan_sets ps
      WHERE sl.plan_set_id = ps.id
        AND ps.type = 'conditioning'
        AND sl.snapshot_set_description IS NULL
        AND ps.description IS NOT NULL
    \`);
    console.log('Snapshot backfill complete');
  } finally {
    client.release();
    await pool.end();
  }
}
run().catch(e => { console.error('Backfill error:', e); process.exit(1); });
"

cd /app

echo "Starting server..."
node artifacts/api-server/dist/index.cjs
