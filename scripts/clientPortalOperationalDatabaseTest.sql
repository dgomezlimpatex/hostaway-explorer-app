BEGIN;

DO $$
BEGIN
  IF to_regprocedure('public.get_client_portal_operational_statuses(uuid,uuid[])') IS NULL THEN
    RAISE EXCEPTION 'portal_operational_status_function_missing';
  END IF;
END;
$$;

CREATE TEMP TABLE portal_operational_test_fixture (
  client_id uuid NOT NULL,
  sede_id uuid NOT NULL,
  progress_task_id uuid NOT NULL,
  completed_task_id uuid NOT NULL,
  other_client_task_id uuid
) ON COMMIT DROP;

INSERT INTO portal_operational_test_fixture (
  client_id,
  sede_id,
  progress_task_id,
  completed_task_id,
  other_client_task_id
)
SELECT
  client.id,
  (
    SELECT task.sede_id
    FROM public.tasks AS task
    WHERE task.cliente_id = client.id
      AND task.sede_id IS NOT NULL
    LIMIT 1
  ),
  gen_random_uuid(),
  gen_random_uuid(),
  (
    SELECT task.id
    FROM public.tasks AS task
    WHERE task.cliente_id IS DISTINCT FROM client.id
    LIMIT 1
  )
FROM public.clients AS client
JOIN public.client_portal_access AS portal_access
  ON portal_access.client_id = client.id
WHERE client.nombre = 'Turquoise Apartments SL'
  AND client.operational_portal_enabled = true
  AND portal_access.is_active = true
LIMIT 1;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM portal_operational_test_fixture) THEN
    RAISE EXCEPTION 'turquoise_operational_portal_fixture_unavailable';
  END IF;
END;
$$;

INSERT INTO public.tasks (
  id, property, address, start_time, end_time, type, status,
  check_out, check_in, date, cliente_id, sede_id
)
SELECT
  fixture.progress_task_id, 'Hermes status probe progress', 'Test only',
  TIME '11:00', TIME '12:00', 'limpieza-turistica', 'pending',
  TIME '11:00', TIME '15:00', CURRENT_DATE, fixture.client_id, fixture.sede_id
FROM portal_operational_test_fixture AS fixture
UNION ALL
SELECT
  fixture.completed_task_id, 'Hermes status probe completed', 'Test only',
  TIME '12:00', TIME '13:00', 'limpieza-turistica', 'pending',
  TIME '11:00', TIME '15:00', CURRENT_DATE, fixture.client_id, fixture.sede_id
FROM portal_operational_test_fixture AS fixture;

INSERT INTO public.task_reports (task_id, overall_status, start_time)
SELECT progress_task_id, 'in_progress'::public.report_status, now()
FROM portal_operational_test_fixture
UNION ALL
SELECT completed_task_id, 'in_progress'::public.report_status, now()
FROM portal_operational_test_fixture
UNION ALL
SELECT completed_task_id, 'completed'::public.report_status, now()
FROM portal_operational_test_fixture;

GRANT SELECT ON portal_operational_test_fixture TO anon;
SET LOCAL ROLE anon;

DO $$
DECLARE
  fixture portal_operational_test_fixture%ROWTYPE;
  projected_status text;
  visible_started_reports integer;
BEGIN
  SELECT * INTO fixture FROM portal_operational_test_fixture;

  SELECT status.operational_status
  INTO projected_status
  FROM public.get_client_portal_operational_statuses(
    fixture.client_id,
    ARRAY[fixture.progress_task_id]
  ) AS status;

  IF projected_status IS DISTINCT FROM 'in-progress' THEN
    RAISE EXCEPTION 'started_report_not_projected_as_in_progress: %', projected_status;
  END IF;

  SELECT status.operational_status
  INTO projected_status
  FROM public.get_client_portal_operational_statuses(
    fixture.client_id,
    ARRAY[fixture.completed_task_id]
  ) AS status;

  IF projected_status IS DISTINCT FROM 'completed' THEN
    RAISE EXCEPTION 'completed_report_did_not_take_precedence: %', projected_status;
  END IF;

  IF fixture.other_client_task_id IS NOT NULL AND EXISTS (
    SELECT 1
    FROM public.get_client_portal_operational_statuses(
      fixture.client_id,
      ARRAY[fixture.other_client_task_id]
    )
  ) THEN
    RAISE EXCEPTION 'cross_client_task_status_exposed';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.get_client_portal_operational_statuses(
      fixture.client_id,
      ARRAY['00000000-0000-0000-0000-000000000001'::uuid]
    )
  ) THEN
    RAISE EXCEPTION 'unknown_task_status_exposed';
  END IF;

  SELECT count(*)
  INTO visible_started_reports
  FROM public.task_reports AS report
  WHERE report.task_id = fixture.progress_task_id
    AND report.overall_status = 'in_progress';

  IF visible_started_reports <> 0 THEN
    RAISE EXCEPTION 'in_progress_report_visible_to_anon';
  END IF;
END;
$$;

RESET ROLE;

DO $$
DECLARE
  fixture portal_operational_test_fixture%ROWTYPE;
BEGIN
  SELECT * INTO fixture FROM portal_operational_test_fixture;

  IF EXISTS (
    SELECT 1
    FROM public.tasks AS task
    WHERE task.id IN (fixture.progress_task_id, fixture.completed_task_id)
      AND task.status <> 'pending'
  ) THEN
    RAISE EXCEPTION 'portal_projection_mutated_task_status';
  END IF;

  IF NOT has_function_privilege(
    'anon',
    'public.get_client_portal_operational_statuses(uuid,uuid[])',
    'EXECUTE'
  ) THEN
    RAISE EXCEPTION 'anon_execute_grant_missing';
  END IF;
END;
$$;

ROLLBACK;
