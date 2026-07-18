BEGIN;
SET LOCAL request.jwt.claim.role = 'service_role';

CREATE TEMPORARY TABLE _qa_deactivation_fixture ON COMMIT DROP AS
SELECT
  ta.task_id,
  ta.cleaner_id,
  ta.id AS assignment_id,
  count(*) OVER (PARTITION BY ta.task_id)::integer AS assignments_before
FROM public.task_assignments ta
JOIN public.tasks t ON t.id = ta.task_id
JOIN public.cleaners c ON c.id = ta.cleaner_id
WHERE t.date >= (now() AT TIME ZONE 'Europe/Madrid')::date
  AND coalesce(t.status, 'pending') NOT IN ('completed', 'cancelled')
  AND c.is_active = true
  AND (SELECT count(*) FROM public.task_assignments x WHERE x.task_id = ta.task_id) >= 2
ORDER BY t.date, t.start_time NULLS LAST, ta.task_id, ta.assigned_at
LIMIT 1;

DO $test$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM _qa_deactivation_fixture) THEN
    RAISE EXCEPTION 'No hay una tarea futura compartida apta para la prueba reversible';
  END IF;
END
$test$;

CREATE TEMPORARY TABLE _qa_expected ON COMMIT DROP AS
SELECT count(DISTINCT t.id)::integer AS expected_unassigned
FROM public.tasks t
JOIN public.cleaners c ON c.id = (SELECT cleaner_id FROM _qa_deactivation_fixture)
WHERE t.date >= (now() AT TIME ZONE 'Europe/Madrid')::date
  AND coalesce(t.status, 'pending') NOT IN ('completed', 'cancelled')
  AND (
    EXISTS (
      SELECT 1 FROM public.task_assignments ta
      WHERE ta.task_id = t.id
        AND ta.cleaner_id = c.id
    )
    OR t.cleaner_id = c.id
    OR (t.cleaner_id IS NULL AND t.cleaner = c.name)
  );

CREATE TEMPORARY TABLE _qa_result ON COMMIT DROP AS
SELECT public.deactivate_cleaner_with_future_assignments(
  (SELECT cleaner_id FROM _qa_deactivation_fixture),
  true
) AS result;

DO $test$
DECLARE
  fixture _qa_deactivation_fixture%ROWTYPE;
  actual_unassigned integer;
  expected_unassigned integer;
  remaining_count integer;
  legacy_primary uuid;
BEGIN
  SELECT * INTO fixture FROM _qa_deactivation_fixture;
  SELECT (result->>'unassignedCount')::integer INTO actual_unassigned FROM _qa_result;
  SELECT e.expected_unassigned INTO expected_unassigned FROM _qa_expected e;

  IF actual_unassigned <> expected_unassigned THEN
    RAISE EXCEPTION 'Conteo incorrecto: esperado %, recibido %', expected_unassigned, actual_unassigned;
  END IF;

  IF (SELECT is_active FROM public.cleaners WHERE id = fixture.cleaner_id) IS DISTINCT FROM false THEN
    RAISE EXCEPTION 'El operario no quedó inactivo dentro de la transacción';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.task_assignments
    WHERE task_id = fixture.task_id
      AND cleaner_id = fixture.cleaner_id
  ) THEN
    RAISE EXCEPTION 'La asignación objetivo no fue retirada';
  END IF;

  SELECT count(*) INTO remaining_count
  FROM public.task_assignments
  WHERE task_id = fixture.task_id;

  IF remaining_count <> fixture.assignments_before - 1 THEN
    RAISE EXCEPTION 'No se preservaron las asignaciones compartidas: antes %, después %',
      fixture.assignments_before, remaining_count;
  END IF;

  SELECT cleaner_id INTO legacy_primary
  FROM public.tasks
  WHERE id = fixture.task_id;

  IF legacy_primary IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.task_assignments
    WHERE task_id = fixture.task_id
      AND cleaner_id = legacy_primary
  ) THEN
    RAISE EXCEPTION 'Los campos legados no quedaron sincronizados con los operarios restantes';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.notification_events e
    WHERE e.task_id = fixture.task_id
      AND e.cleaner_id = fixture.cleaner_id
      AND e.event_type = 'task_cancelled'
      AND e.payload->>'assignment_id' = fixture.assignment_id::text
      AND e.status = 'pending'
  ) THEN
    RAISE EXCEPTION 'No se creó el evento transaccional de cancelación';
  END IF;
END
$test$;

SELECT
  'worker-deactivation-assignment-db-tests: OK' AS result,
  (SELECT result->>'unassignedCount' FROM _qa_result) AS unassigned_count,
  (SELECT assignments_before - 1 FROM _qa_deactivation_fixture) AS preserved_assignments;

ROLLBACK;
