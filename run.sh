#!/bin/bash
# A4CHAND Jaan ji — run the built website + API server on this machine.
# Needs: Node.js 24+ and a PostgreSQL database (see README.md).
# First time: create the database and push the schema (schema SQL is in
# the original project under lib/db — run `pnpm --filter @workspace/db run push`
# from the original project folder with the same DATABASE_URL).
set -e
cd "$(dirname "$0")"
: "${DATABASE_URL:?Set DATABASE_URL, e.g. postgres://a4chand:PASSWORD@localhost:5432/a4chand}"
: "${SESSION_SECRET:?Set SESSION_SECRET to a long random string}"
PORT="${PORT:-5000}" API_PORT="${API_PORT:-5001}" node server.mjs
