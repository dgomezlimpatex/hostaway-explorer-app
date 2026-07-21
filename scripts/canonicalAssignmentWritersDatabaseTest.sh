#!/usr/bin/env bash
set -euo pipefail
repo="$(cd "$(dirname "$0")/.." && pwd)"
repo_native="$(cygpath -w "$repo")"
export MSYS_NO_PATHCONV=1
name="canonical-writers-pg-$RANDOM"
cleanup() { docker rm -f "$name" >/dev/null 2>&1 || true; rm -f "$repo/.canonical-writers-"*.out; }
trap cleanup EXIT

docker run -d --name "$name" -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=writers postgres:16-alpine >/dev/null
for _ in $(seq 1 60); do docker exec "$name" pg_isready -U postgres >/dev/null 2>&1 && break; sleep 1; done
# El entrypoint expone brevemente el servidor bootstrap y después lo reinicia.
sleep 2
for _ in $(seq 1 60); do docker exec "$name" psql -At -U postgres -d writers -c 'SELECT 1' >/dev/null 2>&1 && break; sleep 1; done
docker cp "$repo_native/scripts/canonicalAssignmentWritersDatabaseBaseline.sql" "$name:/baseline.sql"
docker cp "$repo_native/supabase/migrations/20260721130000_transactional_canonical_assignment_writers.sql" "$name:/migration.sql"
docker cp "$repo_native/scripts/canonicalAssignmentWritersDatabaseTest.sql" "$name:/test.sql"
docker exec "$name" psql -v ON_ERROR_STOP=1 -U postgres -d writers -f /baseline.sql >/dev/null
red="$(docker exec "$name" psql -At -U postgres -d writers -c "SELECT to_regprocedure('public.batch_create_tasks_transactional(uuid,uuid,jsonb,text,text)') IS NOT NULL")"
test "$red" = "f"
echo "canonical-writers-db-red: OK (RPC absent before migration)"
docker exec "$name" psql -v ON_ERROR_STOP=1 -U postgres -d writers -f /migration.sql >/dev/null
docker exec "$name" psql -v ON_ERROR_STOP=1 -U postgres -d writers -f /test.sql

call_auto() {
  local task="$1" out="$2"
  docker exec "$name" psql -v ON_ERROR_STOP=1 -At -U postgres -d writers -c "SELECT set_config('request.jwt.claim.role','service_role',false); SELECT public.auto_assign_task_transactional('$task','20000000-0000-0000-0000-000000000002');" >"$out"
}
call_auto 70000000-0000-0000-0000-000000000010 "$repo/.canonical-writers-auto-a.out" & p1=$!
call_auto 70000000-0000-0000-0000-000000000011 "$repo/.canonical-writers-auto-b.out" & p2=$!
wait "$p1" "$p2"
docker exec "$name" psql -v ON_ERROR_STOP=1 -U postgres -d writers -c "SELECT public.qa_assert((SELECT count(*) FROM public.task_assignments WHERE task_id IN ('70000000-0000-0000-0000-000000000010','70000000-0000-0000-0000-000000000011'))=1,'concurrent auto asignó dos solapes'); SELECT public.qa_assert((SELECT count(*) FROM public.auto_assignment_logs WHERE task_id IN ('70000000-0000-0000-0000-000000000010','70000000-0000-0000-0000-000000000011'))=1,'concurrent auto creó logs incorrectos');"
echo "canonical-writers-db-auto-concurrency: OK"

call_ai() {
  local out="$1"
  docker exec "$name" psql -v ON_ERROR_STOP=1 -At -U postgres -d writers -c "SELECT set_config('request.jwt.claim.role','service_role',false); SELECT public.apply_ai_actions_transactional('80000000-0000-0000-0000-000000000010','20000000-0000-0000-0000-000000000001');" >"$out"
}
call_ai "$repo/.canonical-writers-ai-a.out" & p1=$!
call_ai "$repo/.canonical-writers-ai-b.out" & p2=$!
wait "$p1" "$p2"
docker exec "$name" psql -v ON_ERROR_STOP=1 -U postgres -d writers -c "SELECT public.qa_assert((SELECT status='applied' FROM public.ai_action_proposals WHERE id='80000000-0000-0000-0000-000000000010'),'proposal concurrente no aplicada'); SELECT public.qa_assert((SELECT count(*) FROM public.task_assignments WHERE task_id='70000000-0000-0000-0000-000000000012')=1,'doble aplicación IA'); SELECT public.qa_assert((SELECT count(*) FROM public.ai_action_audit_logs WHERE proposal_id='80000000-0000-0000-0000-000000000010')=1,'doble audit IA');"
echo "canonical-writers-db-ai-concurrency: OK"

# Reproduce la inversión histórica cleaner→task de autoassign frente a task→cleaner de IA.
# IA mantiene la task un segundo; auto debe esperar por task antes de tocar el cleaner.
call_ai_with_task_held() {
  local out="$1"
  docker exec -i "$name" psql -v ON_ERROR_STOP=1 -At -U postgres -d writers >"$out" <<'SQL'
SET deadlock_timeout='100ms';
SET statement_timeout='10s';
SELECT set_config('request.jwt.claim.role','service_role',false);
BEGIN;
SELECT id FROM public.tasks WHERE id='70000000-0000-0000-0000-000000000013' FOR UPDATE;
SELECT pg_advisory_lock(150013);
SELECT pg_sleep(1);
SELECT public.apply_ai_actions_transactional('80000000-0000-0000-0000-000000000011','20000000-0000-0000-0000-000000000001');
COMMIT;
SQL
}
call_auto_vs_ai() {
  local out="$1"
  docker exec "$name" psql -v ON_ERROR_STOP=1 -At -U postgres -d writers -c "SET deadlock_timeout='100ms'; SET statement_timeout='10s'; SELECT set_config('request.jwt.claim.role','service_role',false); SELECT public.auto_assign_task_transactional('70000000-0000-0000-0000-000000000013','20000000-0000-0000-0000-000000000002');" >"$out"
}
call_ai_with_task_held "$repo/.canonical-writers-auto-vs-ai-ai.out" & p1=$!
for _ in $(seq 1 50); do
  ready="$(docker exec "$name" psql -At -U postgres -d writers -c "SELECT pg_try_advisory_xact_lock(150013)")"
  test "$ready" = "f" && break
  sleep 0.05
done
test "$ready" = "f"
call_auto_vs_ai "$repo/.canonical-writers-auto-vs-ai-auto.out" & p2=$!
set +e
wait "$p1"; s1=$?
wait "$p2"; s2=$?
set -e
if test "$s1" -ne 0 || test "$s2" -ne 0; then
  cat "$repo/.canonical-writers-auto-vs-ai-ai.out" "$repo/.canonical-writers-auto-vs-ai-auto.out"
  exit 1
fi
docker exec "$name" psql -v ON_ERROR_STOP=1 -U postgres -d writers -c "SELECT public.qa_assert((SELECT status='applied' FROM public.ai_action_proposals WHERE id='80000000-0000-0000-0000-000000000011'),'IA no terminó frente a autoassign'); SELECT public.qa_assert((SELECT count(*) FROM public.task_assignments WHERE task_id='70000000-0000-0000-0000-000000000013')=1,'autoassign vs IA dejó asignación inconsistente');"
echo "canonical-writers-db-auto-vs-ai-lock-order: OK"

call_ai_ordered() {
  local proposal="$1" out="$2"
  docker exec "$name" psql -v ON_ERROR_STOP=1 -At -U postgres -d writers -c "SET statement_timeout='10s'; SELECT set_config('request.jwt.claim.role','service_role',false); SELECT public.apply_ai_actions_transactional('$proposal','20000000-0000-0000-0000-000000000001');" >"$out"
}
call_ai_ordered 80000000-0000-0000-0000-000000000020 "$repo/.canonical-writers-ai-order-a.out" & p1=$!
call_ai_ordered 80000000-0000-0000-0000-000000000021 "$repo/.canonical-writers-ai-order-b.out" & p2=$!
wait "$p1" "$p2"
docker exec "$name" psql -v ON_ERROR_STOP=1 -U postgres -d writers -c "SELECT public.qa_assert((SELECT count(*) FROM public.ai_action_proposals WHERE id IN ('80000000-0000-0000-0000-000000000020','80000000-0000-0000-0000-000000000021') AND status='applied')=2,'A/B no finalizaron'); SELECT public.qa_assert((SELECT count(*) FROM public.ai_action_audit_logs WHERE proposal_id IN ('80000000-0000-0000-0000-000000000020','80000000-0000-0000-0000-000000000021'))=4,'A/B audit incompleto');"
echo "canonical-writers-db-ai-global-lock-order: OK"
echo "canonical-writers-database-tests: OK"
