-- Correctiva incremental: 20260720191000 ya estaba aplicada en producción cuando
-- se detectó que task_approval_events conservaba escritura autenticada y lectura
-- global. Este archivo posterior garantiza que las bases actualizadas reciban el
-- hardening sin reejecutar ni modificar el historial de migraciones aplicado.

ALTER TABLE public.task_approval_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "task_approval_events_admin_manager_all" ON public.task_approval_events;
DROP POLICY IF EXISTS "task_approval_events_supervisor_read" ON public.task_approval_events;
DROP POLICY IF EXISTS "task_approval_events_admin_read" ON public.task_approval_events;
DROP POLICY IF EXISTS "task_approval_events_sede_read" ON public.task_approval_events;

-- El navegador solo puede leer la auditoría. Las inserciones y modificaciones
-- quedan exclusivamente en service_role/backend.
REVOKE ALL ON public.task_approval_events FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.task_approval_events TO authenticated;

CREATE POLICY "task_approval_events_admin_read"
ON public.task_approval_events
FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "task_approval_events_sede_read"
ON public.task_approval_events
FOR SELECT TO authenticated
USING (
  (
    public.has_role(auth.uid(), 'manager')
    OR public.has_role(auth.uid(), 'supervisor')
  )
  AND EXISTS (
    SELECT 1
    FROM public.tasks task
    WHERE task.id = task_approval_events.task_id
      AND task.sede_id IS NOT NULL
      AND public.user_has_sede_access(auth.uid(), task.sede_id)
  )
);
