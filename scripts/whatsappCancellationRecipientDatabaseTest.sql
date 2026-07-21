BEGIN;
SET LOCAL request.jwt.claim.role = 'service_role';

-- Paridad exacta con el proveedor: un fijo en telefono no puede tapar el móvil
-- explícito de WhatsApp, y los flags no participan en la selección del snapshot.
DO $test$
DECLARE
  cleaner_probe public.cleaners%ROWTYPE;
  recipient jsonb;
BEGIN
  cleaner_probe.name := 'Phone parity probe';
  cleaner_probe.telefono := '912 345 678';
  cleaner_probe.whatsapp_phone_e164 := '+34 612 345 678';
  cleaner_probe.whatsapp_notifications_enabled := false;
  cleaner_probe.whatsapp_opt_in := false;
  recipient := public.snapshot_notification_recipient(cleaner_probe);

  IF recipient->>'effective_phone_e164' IS DISTINCT FROM '+34612345678' THEN
    RAISE EXCEPTION 'fixed_phone_masked_valid_whatsapp_mobile: %', recipient;
  END IF;

  cleaner_probe.whatsapp_phone_e164 := '+34 912 345 678';
  recipient := public.snapshot_notification_recipient(cleaner_probe);
  IF recipient->>'effective_phone_e164' IS NOT NULL THEN
    RAISE EXCEPTION 'spanish_landline_was_accepted_as_whatsapp_mobile: %', recipient;
  END IF;
END
$test$;

CREATE TEMPORARY TABLE _qa_cleaner_delete_fixture ON COMMIT DROP AS
SELECT ta.cleaner_id, array_agg(ta.id ORDER BY ta.id) AS assignment_ids,
       c.name, c.email
FROM public.task_assignments ta
JOIN public.tasks t ON t.id = ta.task_id
JOIN public.cleaners c ON c.id = ta.cleaner_id
GROUP BY ta.cleaner_id, c.name, c.email
HAVING count(*) >= 2
ORDER BY count(*) DESC
LIMIT 1;

DO $test$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM _qa_cleaner_delete_fixture) THEN
    RAISE EXCEPTION 'cleaner_with_multiple_assignments_fixture_missing';
  END IF;
END
$test$;

-- Fuerza el caso exacto fijo + móvil válido y flags apagados. El DELETE es
-- directo: simula que la UI falló al borrar previamente las asignaciones.
UPDATE public.cleaners
SET telefono = '912345678',
    whatsapp_phone_e164 = '+34612345678',
    whatsapp_notifications_enabled = false,
    whatsapp_opt_in = false
WHERE id = (SELECT cleaner_id FROM _qa_cleaner_delete_fixture);

DELETE FROM public.cleaners
WHERE id = (SELECT cleaner_id FROM _qa_cleaner_delete_fixture);

DO $test$
DECLARE
  fixture _qa_cleaner_delete_fixture%ROWTYPE;
  expected_count integer;
  actual_count integer;
BEGIN
  SELECT * INTO fixture FROM _qa_cleaner_delete_fixture;
  expected_count := cardinality(fixture.assignment_ids);

  IF EXISTS (
    SELECT 1 FROM public.task_assignments assignment
    WHERE assignment.id = ANY (fixture.assignment_ids)
  ) THEN
    RAISE EXCEPTION 'cleaner_delete_did_not_cascade_assignments';
  END IF;

  SELECT count(*) INTO actual_count
  FROM public.notification_events event
  WHERE event.event_type = 'task_cancelled'
    AND event.payload->>'assignment_id' = ANY (
      SELECT assignment_id::text FROM unnest(fixture.assignment_ids) assignment_id
    );
  IF actual_count <> expected_count THEN
    RAISE EXCEPTION 'expected_one_cancellation_per_assignment: expected %, got %', expected_count, actual_count;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.notification_events event
    WHERE event.event_type = 'task_cancelled'
      AND event.payload->>'assignment_id' = ANY (
        SELECT assignment_id::text FROM unnest(fixture.assignment_ids) assignment_id
      )
      AND (
        event.cleaner_id IS NOT NULL
        OR event.snapshot->'recipient'->>'name' IS DISTINCT FROM fixture.name
        OR event.snapshot->'recipient'->>'email' IS DISTINCT FROM fixture.email
        OR event.snapshot->'recipient'->>'effective_phone_e164' IS DISTINCT FROM '+34612345678'
        OR event.snapshot->'recipient'->>'telefono' IS DISTINCT FROM '+34612345678'
        OR event.snapshot->'recipient'->>'whatsapp_phone_e164' IS DISTINCT FROM '+34612345678'
      )
  ) THEN
    RAISE EXCEPTION 'immutable_effective_recipient_snapshot_missing_after_cleaner_delete';
  END IF;

  IF EXISTS (
    SELECT event.payload->>'assignment_id'
    FROM public.notification_events event
    WHERE event.event_type = 'task_cancelled'
      AND event.payload->>'assignment_id' = ANY (
        SELECT assignment_id::text FROM unnest(fixture.assignment_ids) assignment_id
      )
    GROUP BY event.payload->>'assignment_id'
    HAVING count(*) <> 1
  ) THEN
    RAISE EXCEPTION 'cascade_and_after_delete_duplicated_assignment_cancellation';
  END IF;
END
$test$;

SELECT 'whatsapp-cancellation-recipient-db-tests: OK' AS result;
ROLLBACK;
