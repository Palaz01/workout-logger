#!/bin/sh
set -e

echo "Running database schema sync..."
cd lib/db
npx drizzle-kit push --config ./drizzle.config.ts --force
cd /app

echo "Starting server..."
node artifacts/api-server/dist/index.cjs
