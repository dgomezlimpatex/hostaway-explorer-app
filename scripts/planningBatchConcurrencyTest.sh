#!/usr/bin/env bash
set -euo pipefail
container="${1:-hermes-planning-pg}"
db="${2:?uso: planningBatchConcurrencyTest.sh [container] database}"
log_a=/tmp/planning-concurrency-a.log
log_b=/tmp/planning-concurrency-b.log

docker cp scripts/planningBatchConcurrencySetup.sql "$container:/tmp/planning-concurrency-setup.sql" >/dev/null
docker exec "$container" psql -U postgres -d "$db" -v ON_ERROR_STOP=1 -f /tmp/planning-concurrency-setup.sql >/dev/null

run_race() {
  local name="$1" writer_sql="$2" batch_sql="$3" assertion_sql="$4"
  docker exec "$container" psql -U postgres -d "$db" -v ON_ERROR_STOP=1 -c "$writer_sql" >"$log_a" 2>&1 &
  local pid_a=$!
  sleep 0.2
  docker exec "$container" psql -U postgres -d "$db" -v ON_ERROR_STOP=1 -c "$batch_sql" >"$log_b" 2>&1 &
  local pid_b=$!
  wait "$pid_a" || { echo "$name: writer falló"; cat "$log_a"; exit 1; }
  wait "$pid_b" || { echo "$name: batch falló"; cat "$log_b"; exit 1; }
  local result
  result="$(docker exec "$container" psql -U postgres -d "$db" -v ON_ERROR_STOP=1 -Atc "$assertion_sql")"
  [[ "$result" == "t" ]] || { echo "$name: estado final inválido: $result"; cat "$log_a"; cat "$log_b"; exit 1; }
  echo "PLANNING_BATCH_CONCURRENCY_${name}_PASS"
}

# El writer externo canónico set_task_assignments gana el lock; el batch espera,
# revalida y rechaza el solape. Nunca quedan ambos compromisos activos.
run_race "ASSIGNMENT" \
 "BEGIN; SET LOCAL request.jwt.claim.role='service_role'; SELECT public.set_task_assignments('42000000-0000-0000-0000-000000000011',ARRAY['32000000-0000-0000-0000-000000000001'::uuid]); SELECT pg_sleep(1); COMMIT;" \
 "SELECT public.planning_concurrency_apply('52000000-0000-0000-0000-000000000001','race-assignment','42000000-0000-0000-0000-000000000001','32000000-0000-0000-0000-000000000001','2026-11-02','10:00','11:00');" \
 "SELECT EXISTS(SELECT 1 FROM public.planning_apply_batches WHERE id='52000000-0000-0000-0000-000000000001' AND status='validation_failed') AND NOT EXISTS(SELECT 1 FROM public.task_assignments WHERE task_id='42000000-0000-0000-0000-000000000001');"

run_race "ABSENCE" \
 "BEGIN; INSERT INTO public.worker_absences(cleaner_id,start_date,end_date) VALUES('32000000-0000-0000-0000-000000000002','2026-11-03','2026-11-03'); SELECT pg_sleep(1); COMMIT;" \
 "SELECT public.planning_concurrency_apply('52000000-0000-0000-0000-000000000002','race-absence','42000000-0000-0000-0000-000000000002','32000000-0000-0000-0000-000000000002','2026-11-03','10:00','11:00');" \
 "SELECT EXISTS(SELECT 1 FROM public.planning_apply_batches WHERE id='52000000-0000-0000-0000-000000000002' AND status='validation_failed') AND NOT EXISTS(SELECT 1 FROM public.task_assignments WHERE task_id='42000000-0000-0000-0000-000000000002');"

run_race "MAINTENANCE" \
 "BEGIN; INSERT INTO public.worker_maintenance_cleanings(cleaner_id,days_of_week,start_time,end_time,is_active) VALUES('32000000-0000-0000-0000-000000000003',ARRAY[3],'09:30','11:30',true); SELECT pg_sleep(1); COMMIT;" \
 "SELECT public.planning_concurrency_apply('52000000-0000-0000-0000-000000000003','race-maintenance','42000000-0000-0000-0000-000000000003','32000000-0000-0000-0000-000000000003','2026-11-04','10:00','11:00');" \
 "SELECT EXISTS(SELECT 1 FROM public.planning_apply_batches WHERE id='52000000-0000-0000-0000-000000000003' AND status='validation_failed') AND NOT EXISTS(SELECT 1 FROM public.task_assignments WHERE task_id='42000000-0000-0000-0000-000000000003');"

run_race "DEACTIVATION" \
 "BEGIN; UPDATE public.cleaners SET is_active=false WHERE id='32000000-0000-0000-0000-000000000004'; SELECT pg_sleep(1); COMMIT;" \
 "SELECT public.planning_concurrency_apply('52000000-0000-0000-0000-000000000004','race-deactivation','42000000-0000-0000-0000-000000000004','32000000-0000-0000-0000-000000000004','2026-11-05','10:00','11:00');" \
 "SELECT EXISTS(SELECT 1 FROM public.planning_apply_batches WHERE id='52000000-0000-0000-0000-000000000004' AND status='validation_failed') AND NOT EXISTS(SELECT 1 FROM public.task_assignments WHERE task_id='42000000-0000-0000-0000-000000000004');"

# RPC productiva fiel, orden 1: la baja toma sus tasks y cleaner; el batch
# espera y revalida el estado inactivo. La transacción mantiene locks un segundo.
run_race "CANONICAL_DEACTIVATION_FIRST" \
 "BEGIN; SET LOCAL request.jwt.claim.role='service_role'; SELECT public.deactivate_cleaner_with_future_assignments('32000000-0000-0000-0000-000000000007',true); SELECT pg_sleep(1); COMMIT;" \
 "SELECT public.planning_concurrency_apply('52000000-0000-0000-0000-000000000007','race-canonical-deactivation-first','42000000-0000-0000-0000-000000000007','32000000-0000-0000-0000-000000000007','2026-11-10','10:00','11:00');" \
 "SELECT EXISTS(SELECT 1 FROM public.planning_apply_batches WHERE id='52000000-0000-0000-0000-000000000007' AND status='validation_failed') AND NOT (SELECT is_active FROM public.cleaners WHERE id='32000000-0000-0000-0000-000000000007') AND NOT EXISTS(SELECT 1 FROM public.task_assignments WHERE cleaner_id='32000000-0000-0000-0000-000000000007');"

# Orden 2: el batch confirma una asignación mientras la baja ya hizo su primera
# lectura. Tras conseguir cleaner, la RPC debe releer, incluirla y retirarla.
run_race "CANONICAL_DEACTIVATION_BATCH_FIRST" \
 "BEGIN; SELECT public.planning_concurrency_apply('52000000-0000-0000-0000-000000000008','race-canonical-batch-first','42000000-0000-0000-0000-000000000008','32000000-0000-0000-0000-000000000008','2026-11-11','10:00','11:00'); SELECT pg_sleep(1); COMMIT;" \
 "BEGIN; SET LOCAL request.jwt.claim.role='service_role'; SELECT public.deactivate_cleaner_with_future_assignments('32000000-0000-0000-0000-000000000008',true); COMMIT;" \
 "SELECT EXISTS(SELECT 1 FROM public.planning_apply_batches WHERE id='52000000-0000-0000-0000-000000000008' AND status='applied') AND NOT (SELECT is_active FROM public.cleaners WHERE id='32000000-0000-0000-0000-000000000008') AND NOT EXISTS(SELECT 1 FROM public.task_assignments WHERE cleaner_id='32000000-0000-0000-0000-000000000008') AND NOT EXISTS(SELECT 1 FROM public.tasks WHERE id='42000000-0000-0000-0000-000000000008' AND cleaner_id IS NOT NULL);"

run_race "SCHEDULE" \
 "BEGIN; UPDATE public.tasks SET start_time='10:30',end_time='11:30' WHERE id='42000000-0000-0000-0000-000000000015'; SELECT pg_sleep(1); COMMIT;" \
 "SELECT public.planning_concurrency_apply('52000000-0000-0000-0000-000000000005','race-schedule','42000000-0000-0000-0000-000000000005','32000000-0000-0000-0000-000000000005','2026-11-06','10:00','11:00');" \
 "SELECT EXISTS(SELECT 1 FROM public.planning_apply_batches WHERE id='52000000-0000-0000-0000-000000000005' AND status='validation_failed') AND NOT EXISTS(SELECT 1 FROM public.task_assignments WHERE task_id='42000000-0000-0000-0000-000000000005');"

run_race "AVAILABILITY" \
 "BEGIN; INSERT INTO public.cleaner_availability(cleaner_id,day_of_week,is_available,start_time,end_time) VALUES('32000000-0000-0000-0000-000000000006',6,false,NULL,NULL); SELECT pg_sleep(1); COMMIT;" \
 "SELECT public.planning_concurrency_apply('52000000-0000-0000-0000-000000000006','race-availability','42000000-0000-0000-0000-000000000006','32000000-0000-0000-0000-000000000006','2026-11-07','10:00','11:00');" \
 "SELECT EXISTS(SELECT 1 FROM public.planning_apply_batches WHERE id='52000000-0000-0000-0000-000000000006' AND status='validation_failed') AND NOT EXISTS(SELECT 1 FROM public.task_assignments WHERE task_id='42000000-0000-0000-0000-000000000006');"

# A: el writer AI real gana; batch espera y revalida.
run_race "AI_FIRST" \
 "BEGIN; SELECT public.apply_ai_actions_transactional('42000000-0000-0000-0000-000000000022','32000000-0000-0000-0000-000000000001','10:30','11:30'); SELECT pg_sleep(1); COMMIT;" \
 "SELECT public.planning_concurrency_apply('52000000-0000-0000-0000-000000000021','race-ai-first','42000000-0000-0000-0000-000000000021','32000000-0000-0000-0000-000000000001','2026-11-08','10:00','11:00');" \
 "SELECT EXISTS(SELECT 1 FROM public.planning_apply_batches WHERE id='52000000-0000-0000-0000-000000000021' AND status='validation_failed') AND EXISTS(SELECT 1 FROM public.task_assignments WHERE task_id='42000000-0000-0000-0000-000000000022');"

# B: batch gana; el writer AI real debe fallar por el guard, sin deadlock.
docker exec "$container" psql -U postgres -d "$db" -v ON_ERROR_STOP=1 -c \
 "BEGIN; SELECT public.planning_concurrency_apply('52000000-0000-0000-0000-000000000023','race-batch-first','42000000-0000-0000-0000-000000000023','32000000-0000-0000-0000-000000000001','2026-11-09','10:00','11:00'); SELECT pg_sleep(1); COMMIT;" >"$log_a" 2>&1 &
pid_a=$!
sleep 0.2
set +e
docker exec "$container" psql -U postgres -d "$db" -v ON_ERROR_STOP=1 -c \
 "SELECT public.apply_ai_actions_transactional('42000000-0000-0000-0000-000000000024','32000000-0000-0000-0000-000000000001','10:30','11:30');" >"$log_b" 2>&1
ai_rc=$?
set -e
wait "$pid_a" || { cat "$log_a"; exit 1; }
[[ "$ai_rc" -ne 0 ]] || { echo 'AI_BATCH_FIRST: writer AI debía ser rechazado'; cat "$log_b"; exit 1; }
result="$(docker exec "$container" psql -U postgres -d "$db" -Atc "SELECT EXISTS(SELECT 1 FROM public.planning_apply_batches WHERE id='52000000-0000-0000-0000-000000000023' AND status='applied') AND NOT EXISTS(SELECT 1 FROM public.task_assignments WHERE task_id='42000000-0000-0000-0000-000000000024');")"
[[ "$result" == "t" ]] || { echo "AI_BATCH_FIRST estado inválido: $result"; cat "$log_a"; cat "$log_b"; exit 1; }
echo PLANNING_BATCH_CONCURRENCY_AI_BATCH_FIRST_PASS

echo PLANNING_BATCH_CONCURRENCY_TEST_PASS
