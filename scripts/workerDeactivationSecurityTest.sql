BEGIN;

CREATE TEMPORARY TABLE _qa_security_fixture ON COMMIT DROP AS
SELECT
  (SELECT id FROM public.cleaners ORDER BY created_at LIMIT 1) AS cleaner_id,
  (SELECT id FROM public.tasks ORDER BY created_at DESC LIMIT 1) AS task_id;

DO $test$
DECLARE
  fixture _qa_security_fixture%ROWTYPE;
  rejected_preview boolean := false;
  rejected_deactivate boolean := false;
  rejected_assignment boolean := false;
BEGIN
  SELECT * INTO fixture FROM _qa_security_fixture;
  IF fixture.cleaner_id IS NULL OR fixture.task_id IS NULL THEN
    RAISE EXCEPTION 'Faltan datos mínimos para la prueba de seguridad';
  END IF;

  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
  PERFORM set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000001', true);

  BEGIN
    PERFORM 1 FROM public.get_future_pending_tasks_for_cleaner(fixture.cleaner_id);
  EXCEPTION WHEN insufficient_privilege THEN
    rejected_preview := true;
  END;

  BEGIN
    PERFORM public.deactivate_cleaner_with_future_assignments(fixture.cleaner_id, false);
  EXCEPTION WHEN insufficient_privilege THEN
    rejected_deactivate := true;
  END;

  BEGIN
    PERFORM public.set_task_assignments(fixture.task_id, '{}'::uuid[]);
  EXCEPTION WHEN insufficient_privilege THEN
    rejected_assignment := true;
  END;

  IF NOT rejected_preview OR NOT rejected_deactivate OR NOT rejected_assignment THEN
    RAISE EXCEPTION 'Una RPC SECURITY DEFINER aceptó un usuario autenticado sin rol: preview %, baja %, asignación %',
      rejected_preview, rejected_deactivate, rejected_assignment;
  END IF;

  PERFORM set_config('request.jwt.claim.role', 'service_role', true);
  PERFORM set_config('request.jwt.claim.sub', '', true);
  PERFORM 1 FROM public.get_future_pending_tasks_for_cleaner(fixture.cleaner_id);
END
$test$;

SELECT
  'worker-deactivation-security-tests: OK' AS result,
  has_function_privilege('anon', 'public.set_task_assignments(uuid,uuid[])', 'EXECUTE') AS anon_set_assignment,
  has_function_privilege('anon', 'public.get_future_pending_tasks_for_cleaner(uuid)', 'EXECUTE') AS anon_preview,
  has_function_privilege('anon', 'public.deactivate_cleaner_with_future_assignments(uuid,boolean)', 'EXECUTE') AS anon_deactivate;

ROLLBACK;
