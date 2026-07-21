#!/usr/bin/env bash
set -euo pipefail
repo="$(cd "$(dirname "$0")/.." && pwd)"
repo_native="$(cygpath -w "$repo")"
export MSYS_NO_PATHCONV=1
name="planning-batch-pg-$RANDOM"
db="planning"
cleanup() { docker rm -f "$name" >/dev/null 2>&1 || true; rm -f /tmp/planning-concurrency-a.log /tmp/planning-concurrency-b.log; }
trap cleanup EXIT

node "$(cygpath -w "$repo/scripts/planningBatchClientTest.mjs")"

docker run -d --name "$name" -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB="$db" postgres:16-alpine >/dev/null
for _ in $(seq 1 60); do
  docker exec "$name" psql -v ON_ERROR_STOP=1 -U postgres -d "$db" -Atc 'SELECT 1' >/dev/null 2>&1 && break
  sleep 1
done
docker exec "$name" psql -v ON_ERROR_STOP=1 -U postgres -d "$db" -Atc 'SELECT 1' >/dev/null
for file in \
  scripts/planningBatchTestBaseline.sql \
  supabase/migrations/20260721150000_planning_batch_transactional_apply.sql \
  scripts/planningBatchTransactionTest.sql \
  scripts/planningBatchAdversarialTest.sql; do
  docker cp "$repo_native/$file" "$name:/tmp/$(basename "$file")" >/dev/null
done

docker exec "$name" psql -v ON_ERROR_STOP=1 -U postgres -d "$db" -f /tmp/planningBatchTestBaseline.sql >/dev/null
docker exec "$name" psql -v ON_ERROR_STOP=1 -U postgres -d "$db" -f /tmp/20260721150000_planning_batch_transactional_apply.sql >/dev/null
docker exec "$name" psql -v ON_ERROR_STOP=1 -U postgres -d "$db" -f /tmp/planningBatchTransactionTest.sql
docker exec "$name" psql -v ON_ERROR_STOP=1 -U postgres -d "$db" -f /tmp/planningBatchAdversarialTest.sql
bash "$repo/scripts/planningBatchConcurrencyTest.sh" "$name" "$db"
echo PLANNING_BATCH_DATABASE_TESTS_PASS
