#!/usr/bin/env bash
set -euo pipefail
container="${1:?container requerido}"
db="${2:?database requerida}"
repo="$(cd "$(dirname "$0")/.." && pwd)"
tmp_dir="$repo/.planning-cleaner-delete-race-$$"
mkdir -p "$tmp_dir"
first_pid=""
second_pid=""
cleanup() {
  [[ -n "$first_pid" ]] && kill "$first_pid" >/dev/null 2>&1 || true
  [[ -n "$second_pid" ]] && kill "$second_pid" >/dev/null 2>&1 || true
  rm -rf "$tmp_dir"
}
trap cleanup EXIT

query_scalar() {
  docker exec "$container" psql -X -v ON_ERROR_STOP=1 -Atq -U postgres -d "$db" -c "$1"
}

wait_for_true() {
  local description="$1" sql="$2" result="" attempt
  for attempt in $(seq 1 120); do
    result="$(query_scalar "$sql" 2>/dev/null || true)"
    [[ "$result" == "t" ]] && return 0
  done
  echo "TIMEOUT fail-closed esperando $description; último resultado: ${result:-<vacío>}" >&2
  query_scalar "SELECT application_name,state,wait_event_type,wait_event,pg_blocking_pids(pid) FROM pg_stat_activity WHERE datname=current_database() AND application_name LIKE 'planning-race-%' ORDER BY application_name;" >&2 || true
  return 1
}

run_pair() {
  local label="$1" first_body="$2" second_body="$3" assertion_sql="$4"
  local first_app="planning-race-${label}-first-$$"
  local second_app="planning-race-${label}-second-$$"
  local log_a="$tmp_dir/${label}-first.log"
  local log_b="$tmp_dir/${label}-second.log"

  docker exec "$container" psql -X -v ON_ERROR_STOP=1 -Atq -U postgres -d "$db" \
    -c "BEGIN; SET LOCAL application_name='$first_app'; SET LOCAL lock_timeout='5s'; SET LOCAL statement_timeout='10s'; SET LOCAL deadlock_timeout='100ms'; $first_body; SELECT public.planning_test_wait_for_release('$label'); COMMIT;" >"$log_a" 2>&1 &
  first_pid=$!

  wait_for_true "$label: primera sesión en barrera con lock real" \
    "SELECT EXISTS(SELECT 1 FROM pg_stat_activity a WHERE a.datname=current_database() AND a.application_name='$first_app' AND a.state='active' AND a.query LIKE '%planning_test_wait_for_release%' AND a.xact_start IS NOT NULL AND EXISTS(SELECT 1 FROM pg_locks l WHERE l.pid=a.pid AND l.granted AND l.locktype IN ('relation','tuple','transactionid')));" \
    || { cat "$log_a" >&2; return 1; }

  docker exec "$container" psql -X -v ON_ERROR_STOP=1 -Atq -U postgres -d "$db" \
    -c "SET application_name='$second_app'; SET lock_timeout='5s'; SET statement_timeout='10s'; SET deadlock_timeout='100ms'; $second_body" >"$log_b" 2>&1 &
  second_pid=$!

  wait_for_true "$label: segunda sesión realmente bloqueada por la primera" \
    "SELECT EXISTS(SELECT 1 FROM pg_stat_activity second JOIN pg_stat_activity first ON first.application_name='$first_app' WHERE second.datname=current_database() AND second.application_name='$second_app' AND second.wait_event_type='Lock' AND first.pid=ANY(pg_blocking_pids(second.pid)));" \
    || { cat "$log_a" >&2; cat "$log_b" >&2; return 1; }

  [[ "$(query_scalar "UPDATE public.planning_test_barriers SET released=true WHERE label='$label' RETURNING true;")" == "t" ]] || {
    echo "$label no pudo liberar barrera" >&2
    return 1
  }
  wait "$first_pid" || { echo "$label primera sesión falló" >&2; cat "$log_a" >&2; return 1; }
  first_pid=""
  wait "$second_pid" || { echo "$label segunda sesión falló" >&2; cat "$log_b" >&2; return 1; }
  second_pid=""

  local result
  result="$(query_scalar "$assertion_sql")"
  [[ "$result" == "t" ]] || {
    echo "$label estado/shape inválido: $result" >&2
    cat "$log_a" >&2
    cat "$log_b" >&2
    query_scalar "SELECT label,result FROM public.planning_test_race_results ORDER BY label;" >&2 || true
    return 1
  }
  echo "PLANNING_CLEANER_DELETE_RACE_${label}_PASS"
}

# Dirección 1: DELETE confirma la mutación dentro de una transacción abierta. Solo
# entonces se lanza el batch y se demuestra su espera real antes del COMMIT.
run_pair "DELETE_FIRST" \
 "DELETE FROM public.cleaners WHERE id='33000000-0000-0000-0000-000000000001'" \
 "INSERT INTO public.planning_test_race_results(label,result) SELECT 'DELETE_FIRST',public.planning_integrated_apply('53000000-0000-4000-8000-000000000001','integrated-delete-first','43000000-0000-0000-0000-000000000001','33000000-0000-0000-0000-000000000001','2027-01-11')" \
 "SELECT public.planning_test_result_is_canonical(result) AND result->>'batch_id'='53000000-0000-4000-8000-000000000001' AND result->>'status'='validation_failed' AND result->>'idempotent_replay'='false' AND NOT EXISTS(SELECT 1 FROM public.cleaners WHERE id='33000000-0000-0000-0000-000000000001') AND EXISTS(SELECT 1 FROM public.planning_apply_batches WHERE id='53000000-0000-4000-8000-000000000001' AND status='validation_failed' AND result_summary->>'applied_task_count'='0' AND result_summary->>'applied_assignment_count'='0') AND NOT EXISTS(SELECT 1 FROM public.task_assignments WHERE task_id='43000000-0000-0000-0000-000000000001') AND NOT EXISTS(SELECT 1 FROM public.planning_assignment_audit WHERE batch_id='53000000-0000-4000-8000-000000000001') AND NOT EXISTS(SELECT 1 FROM public.notification_events WHERE batch_id='53000000-0000-4000-8000-000000000001') FROM public.planning_test_race_results WHERE label='DELETE_FIRST';"

# Dirección 2: el batch aplica y queda abierto con sus locks. DELETE se lanza solo
# después del marker observable y debe esperar al backend exacto del batch.
run_pair "BATCH_FIRST" \
 "INSERT INTO public.planning_test_race_results(label,result) SELECT 'BATCH_FIRST',public.planning_integrated_apply('53000000-0000-4000-8000-000000000002','integrated-batch-first','43000000-0000-0000-0000-000000000002','33000000-0000-0000-0000-000000000002','2027-01-12')" \
 "BEGIN; DELETE FROM public.cleaners WHERE id='33000000-0000-0000-0000-000000000002'; COMMIT" \
 "SELECT public.planning_test_result_is_canonical(result) AND result->>'batch_id'='53000000-0000-4000-8000-000000000002' AND result->>'status'='applied' AND result->>'idempotent_replay'='false' AND NOT EXISTS(SELECT 1 FROM public.cleaners WHERE id='33000000-0000-0000-0000-000000000002') AND NOT EXISTS(SELECT 1 FROM public.task_assignments WHERE task_id='43000000-0000-0000-0000-000000000002') AND EXISTS(SELECT 1 FROM public.tasks WHERE id='43000000-0000-0000-0000-000000000002' AND cleaner_id IS NULL) AND (SELECT count(*) FROM public.notification_events WHERE event_type='task_cancelled' AND snapshot->'assignment'->>'cleaner_id'='33000000-0000-0000-0000-000000000002')=1 AND EXISTS(SELECT 1 FROM public.notification_events WHERE event_type='task_cancelled' AND recipient_worker_id='33000000-0000-0000-0000-000000000002' AND entity_id='43000000-0000-0000-0000-000000000002' AND snapshot->'task'->>'id'='43000000-0000-0000-0000-000000000002' AND snapshot->'assignment'->>'cleaner_id'='33000000-0000-0000-0000-000000000002' AND snapshot->'recipient' ? 'effective_phone_e164' AND dedupe_key LIKE 'task_cancelled:43000000-0000-0000-0000-000000000002:%:assignment:%') FROM public.planning_test_race_results WHERE label='BATCH_FIRST';"

echo PLANNING_CLEANER_DELETE_RACE_PASS
