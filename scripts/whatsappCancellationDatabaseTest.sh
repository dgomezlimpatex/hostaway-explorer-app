#!/usr/bin/env bash
set -euo pipefail
repo="$(pwd)"
repo_native="$(cygpath -w "$repo")"
name="hermes-cancellation-db-$$"
cleanup() {
  docker rm -f "$name" >/dev/null 2>&1 || true
  rm -f "$repo/.whatsapp-cancellation-"*.out
}
trap cleanup EXIT

docker run -d --name "$name" -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=cancellation postgres:16-alpine >/dev/null
for _ in $(seq 1 60); do
  docker exec "$name" pg_isready -U postgres >/dev/null 2>&1 && break
  sleep 1
done

docker cp "$repo_native/scripts/whatsappCancellationDatabaseBaseline.sql" "$name:/baseline.sql"
docker cp "$repo_native/supabase/migrations/20260721151000_fix_deleted_task_cancellation_notifications.sql" "$name:/migration-151.sql"
docker cp "$repo_native/supabase/migrations/20260721152000_add_whatsapp_attempt_history_and_recipient_snapshot.sql" "$name:/migration-152.sql"
docker cp "$repo_native/scripts/whatsappCancellationRecipientDatabaseTest.sql" "$name:/recipient-test.sql"
docker cp "$repo_native/scripts/whatsappMetaAttemptHistoryDatabaseTest.sql" "$name:/attempt-test.sql"
docker cp "$repo_native/scripts/whatsappCancellationConcurrencySetup.sql" "$name:/concurrency-setup.sql"

docker exec "$name" psql -v ON_ERROR_STOP=1 -U postgres -d cancellation -f /baseline.sql >/dev/null
docker exec "$name" psql -v ON_ERROR_STOP=1 -U postgres -d cancellation -f /migration-151.sql >/dev/null
docker exec "$name" psql -v ON_ERROR_STOP=1 -v pre_migration=true -U postgres -d cancellation -f /concurrency-setup.sql >/dev/null
docker exec "$name" psql -v ON_ERROR_STOP=1 -U postgres -d cancellation -f /migration-152.sql >/dev/null
docker exec "$name" psql -v ON_ERROR_STOP=1 -U postgres -d cancellation -f /recipient-test.sql
docker exec "$name" psql -v ON_ERROR_STOP=1 -U postgres -d cancellation -f /attempt-test.sql

docker exec "$name" psql -v ON_ERROR_STOP=1 -v pre_migration=false -U postgres -d cancellation -f /concurrency-setup.sql >/dev/null
claim_a="$repo/.whatsapp-cancellation-claim-a.out"
claim_b="$repo/.whatsapp-cancellation-claim-b.out"
docker exec "$name" psql -v ON_ERROR_STOP=1 -At -U postgres -d cancellation -c \
  "SELECT public.claim_bounded_whatsapp_retry('50000000-0000-0000-0000-000000000010','60000000-0000-0000-0000-000000000002');" >"$claim_a" &
pid_a=$!
docker exec "$name" psql -v ON_ERROR_STOP=1 -At -U postgres -d cancellation -c \
  "SELECT public.claim_bounded_whatsapp_retry('50000000-0000-0000-0000-000000000010','60000000-0000-0000-0000-000000000003');" >"$claim_b" &
pid_b=$!
wait "$pid_a"; wait "$pid_b"
result_a="$(tr -d '\r\n' <"$claim_a")"
result_b="$(tr -d '\r\n' <"$claim_b")"
if [[ "$result_a" == "70000000-0000-0000-0000-000000000010" && -z "$result_b" ]]; then
  winner_lease='60000000-0000-0000-0000-000000000002'
elif [[ "$result_b" == "70000000-0000-0000-0000-000000000010" && -z "$result_a" ]]; then
  winner_lease='60000000-0000-0000-0000-000000000003'
else
  echo "FAIL: two-worker retry claims were not exactly-one (A='$result_a', B='$result_b')" >&2
  exit 1
fi

begin_a="$repo/.whatsapp-cancellation-begin-a.out"
begin_b="$repo/.whatsapp-cancellation-begin-b.out"
docker exec "$name" psql -v ON_ERROR_STOP=1 -At -U postgres -d cancellation -c \
  "SELECT claimed FROM public.begin_whatsapp_send_attempt('70000000-0000-0000-0000-000000000010','50000000-0000-0000-0000-000000000010','$winner_lease','80000000-0000-0000-0000-000000000002','{}');" >"$begin_a" &
pid_a=$!
docker exec "$name" psql -v ON_ERROR_STOP=1 -At -U postgres -d cancellation -c \
  "SELECT claimed FROM public.begin_whatsapp_send_attempt('70000000-0000-0000-0000-000000000010','50000000-0000-0000-0000-000000000010','$winner_lease','80000000-0000-0000-0000-000000000003','{}');" >"$begin_b" &
pid_b=$!
wait "$pid_a"; wait "$pid_b"
begin_result_a="$(tr -d '\r\n' <"$begin_a")"
begin_result_b="$(tr -d '\r\n' <"$begin_b")"
if [[ ! ( "$begin_result_a" == 't' && "$begin_result_b" == 'f' ) && ! ( "$begin_result_a" == 'f' && "$begin_result_b" == 't' ) ]]; then
  echo "FAIL: two-worker begin was not exactly-one (A='$begin_result_a', B='$begin_result_b')" >&2
  exit 1
fi

docker exec "$name" psql -v ON_ERROR_STOP=1 -U postgres -d cancellation -c \
  "DO \$\$ BEGIN
     IF (SELECT count(*) FROM public.notification_delivery_attempts WHERE delivery_id='70000000-0000-0000-0000-000000000010') <> 2 THEN RAISE EXCEPTION 'attempt_count_not_two'; END IF;
     IF NOT EXISTS (SELECT 1 FROM public.notification_delivery_attempts WHERE delivery_id='70000000-0000-0000-0000-000000000010' AND attempt_no=1 AND state='completed_uncertain' AND error_code='worker_crash_recovered') THEN RAISE EXCEPTION 'attempt_one_not_recovered'; END IF;
     IF NOT EXISTS (SELECT 1 FROM public.notification_delivery_attempts WHERE delivery_id='70000000-0000-0000-0000-000000000010' AND attempt_no=2 AND claim_token IN ('80000000-0000-0000-0000-000000000002','80000000-0000-0000-0000-000000000003')) THEN RAISE EXCEPTION 'legacy_attempt_two_identity_missing'; END IF;
     IF EXISTS (SELECT 1 FROM public.notification_delivery_attempts WHERE delivery_id='70000000-0000-0000-0000-000000000010' AND attempt_no>2) THEN RAISE EXCEPTION 'attempt_three_exists'; END IF;
   END \$\$;" >/dev/null

# Dos sesiones arrancan detrás de una barrera advisory compartida. El trigger de
# prueba ensancha exactamente la ventana attempt-lock -> aggregate-lock que tenía
# el wrapper antiguo; con el orden global ambas funciones serializan sin deadlock.
barrier="$repo/.whatsapp-cancellation-barrier.out"
race_finalize="$repo/.whatsapp-cancellation-race-finalize.out"
race_status="$repo/.whatsapp-cancellation-race-status.out"
docker exec "$name" psql -v ON_ERROR_STOP=1 -At -U postgres -d cancellation -c \
  "BEGIN; SELECT pg_advisory_xact_lock(20260721152000); SELECT pg_sleep(1); COMMIT;" >"$barrier" &
barrier_pid=$!
docker exec "$name" psql -v ON_ERROR_STOP=1 -At -U postgres -d cancellation -c \
  "BEGIN; SET LOCAL lock_timeout='5s'; SET LOCAL deadlock_timeout='200ms'; SET LOCAL hermes.pause_uncertain_attempt='on';
   SELECT pg_advisory_xact_lock_shared(20260721152000);
   SELECT effective_status FROM public.finalize_whatsapp_send_attempt_uncertain(
     '80000000-0000-0000-0000-000000000020','90000000-0000-0000-0000-000000000020','{}','race uncertain');
   COMMIT;" >"$race_finalize" &
race_finalize_pid=$!
docker exec "$name" psql -v ON_ERROR_STOP=1 -At -U postgres -d cancellation -c \
  "BEGIN; SET LOCAL lock_timeout='5s'; SET LOCAL deadlock_timeout='200ms';
   SELECT pg_advisory_xact_lock_shared(20260721152000);
   SELECT effective_status FROM public.apply_whatsapp_delivery_status(
     'wamid.race-provisional','delivered',now(),NULL);
   COMMIT;" >"$race_status" &
race_status_pid=$!
wait "$barrier_pid"
wait "$race_finalize_pid"
wait "$race_status_pid"

docker exec "$name" psql -v ON_ERROR_STOP=1 -U postgres -d cancellation -c \
  "DO \$\$ BEGIN
     IF NOT EXISTS (SELECT 1 FROM public.notification_deliveries WHERE id='70000000-0000-0000-0000-000000000020' AND status='delivered' AND provider_message_id='wamid.race-provisional') THEN RAISE EXCEPTION 'race_delivery_inconsistent'; END IF;
     IF NOT EXISTS (SELECT 1 FROM public.notification_events WHERE id='50000000-0000-0000-0000-000000000020' AND status='sent') THEN RAISE EXCEPTION 'race_event_inconsistent'; END IF;
     IF NOT EXISTS (SELECT 1 FROM public.notification_delivery_attempts WHERE id='80000000-0000-0000-0000-000000000020' AND state='completed_uncertain' AND last_status='delivered') THEN RAISE EXCEPTION 'race_attempt_inconsistent'; END IF;
   END \$\$;
   DROP TRIGGER hermes_pause_uncertain_attempt_update ON public.notification_delivery_attempts;
   DROP FUNCTION public.hermes_pause_uncertain_attempt_update();" >/dev/null

echo 'whatsapp-cancellation-db-runner: OK (ephemeral PostgreSQL 16, two real psql workers)'
