#!/usr/bin/env bash
set -euo pipefail
repo="$(cd "$(dirname "$0")/.." && pwd)"
repo_native="$(cygpath -w "$repo")"
export MSYS_NO_PATHCONV=1
name="planning-hermes-integrated-$RANDOM"
db="planning_integrated"
cleanup() { docker rm -f "$name" >/dev/null 2>&1 || true; }
trap cleanup EXIT

docker run -d --name "$name" -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB="$db" postgres:16-alpine >/dev/null
for _ in $(seq 1 60); do
  docker exec "$name" psql -v ON_ERROR_STOP=1 -U postgres -d "$db" -Atc 'SELECT 1' >/dev/null 2>&1 && break
  sleep 1
done
docker exec "$name" psql -v ON_ERROR_STOP=1 -U postgres -d "$db" -Atc 'SELECT 1' >/dev/null

files=(
  scripts/planningBatchTestBaseline.sql
  scripts/planningHermes150IntegratedBaseline.sql
  supabase/migrations/20260717160000_notify_all_assigned_cleaners_on_task_changes.sql
  supabase/migrations/20260721130000_transactional_canonical_assignment_writers.sql
  supabase/migrations/20260721150000_planning_batch_transactional_apply.sql
  supabase/migrations/20260721151000_fix_deleted_task_cancellation_notifications.sql
  supabase/migrations/20260721152000_add_whatsapp_attempt_history_and_recipient_snapshot.sql
  supabase/migrations/20260721164500_ignore_planning_version_in_task_modified_notifications.sql
  supabase/migrations/20260721171000_restore_legacy_assignment_overrides.sql
  supabase/migrations/20260722135500_ignore_report_completion_task_modified.sql
  scripts/planningHermes150IntegratedSmoke.sql
)
for file in "${files[@]}"; do
  docker cp "$repo_native/$file" "$name:/tmp/$(basename "$file")" >/dev/null
done

docker exec "$name" psql -v ON_ERROR_STOP=1 -U postgres -d "$db" -f /tmp/planningHermes150IntegratedBaseline.sql >/dev/null
for migration in \
  20260717160000_notify_all_assigned_cleaners_on_task_changes.sql \
  20260721130000_transactional_canonical_assignment_writers.sql \
  20260721150000_planning_batch_transactional_apply.sql \
  20260721151000_fix_deleted_task_cancellation_notifications.sql \
  20260721152000_add_whatsapp_attempt_history_and_recipient_snapshot.sql \
  20260721164500_ignore_planning_version_in_task_modified_notifications.sql \
  20260721171000_restore_legacy_assignment_overrides.sql \
  20260722135500_ignore_report_completion_task_modified.sql; do
  docker exec "$name" psql -v ON_ERROR_STOP=1 -U postgres -d "$db" -f "/tmp/$migration" >/dev/null
done
docker exec "$name" psql -v ON_ERROR_STOP=1 -U postgres -d "$db" -f /tmp/planningHermes150IntegratedSmoke.sql
bash "$repo/scripts/planningCleanerDeleteRaceTest.sh" "$name" "$db"
echo PLANNING_HERMES_150_INTEGRATED_RUNNER_PASS
