-- Public, minimal operational status projection for the Turquoise day portal.
-- It derives "in-progress" from a started task report without mutating tasks,
-- invoking planning guards, or exposing report content/media.

CREATE OR REPLACE FUNCTION public.get_client_portal_operational_statuses(
  _client_id uuid,
  _task_ids uuid[]
)
RETURNS TABLE (
  task_id uuid,
  operational_status text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT
    task.id AS task_id,
    CASE
      WHEN task.status = 'completed'
        OR COALESCE(bool_or(report.overall_status = 'completed'), false)
        THEN 'completed'
      WHEN task.status = 'in-progress'
        OR COALESCE(bool_or(report.overall_status = 'in_progress'), false)
        THEN 'in-progress'
      ELSE 'pending'
    END AS operational_status
  FROM public.tasks AS task
  JOIN public.clients AS client
    ON client.id = task.cliente_id
  LEFT JOIN public.task_reports AS report
    ON report.task_id = task.id
  WHERE task.cliente_id = _client_id
    AND task.id = ANY(COALESCE(_task_ids, ARRAY[]::uuid[]))
    AND task.status <> 'cancelled'
    AND client.operational_portal_enabled = true
    AND cardinality(COALESCE(_task_ids, ARRAY[]::uuid[])) BETWEEN 1 AND 20000
    AND EXISTS (
      SELECT 1
      FROM public.client_portal_access AS portal_access
      WHERE portal_access.client_id = _client_id
        AND portal_access.is_active = true
    )
  GROUP BY task.id, task.status;
$$;

REVOKE ALL ON FUNCTION public.get_client_portal_operational_statuses(uuid, uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_client_portal_operational_statuses(uuid, uuid[]) TO anon, authenticated;
