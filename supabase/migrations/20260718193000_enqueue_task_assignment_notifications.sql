-- Centraliza las altas y bajas de responsables en la base de datos.
-- Cualquier escritura válida en task_assignments genera exactamente un evento
-- pendiente; el cron whatsapp-process-pending lo procesa cada dos minutos.

CREATE OR REPLACE FUNCTION public.enqueue_task_assignment_notification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  assignment_row public.task_assignments%ROWTYPE;
  notification_type text;
  task_sede_id uuid;
BEGIN
  IF TG_OP = 'INSERT' THEN
    assignment_row := NEW;
    notification_type := 'task_assigned';
  ELSE
    assignment_row := OLD;
    notification_type := 'task_cancelled';
  END IF;

  SELECT sede_id
    INTO task_sede_id
    FROM public.tasks
    WHERE id = assignment_row.task_id;

  -- Una eliminación en cascada de la propia tarea no puede notificarse porque
  -- el sender ya no dispondría de los datos necesarios para la plantilla.
  IF NOT FOUND OR assignment_row.cleaner_id IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  INSERT INTO public.notification_events (
    event_type,
    entity_type,
    entity_id,
    task_id,
    cleaner_id,
    sede_id,
    payload,
    dedupe_key,
    status
  ) VALUES (
    notification_type,
    'tasks',
    assignment_row.task_id,
    assignment_row.task_id,
    assignment_row.cleaner_id,
    task_sede_id,
    jsonb_build_object(
      'source', 'task_assignments_after_write_trigger',
      'assignment_id', assignment_row.id,
      'operation', lower(TG_OP)
    ),
    concat(
      notification_type,
      ':',
      assignment_row.task_id::text,
      ':',
      assignment_row.cleaner_id::text,
      ':assignment:',
      assignment_row.id::text
    ),
    'pending'
  )
  ON CONFLICT (dedupe_key) DO NOTHING;

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_task_assignments_enqueue_notification
  ON public.task_assignments;

CREATE TRIGGER trg_task_assignments_enqueue_notification
AFTER INSERT OR DELETE ON public.task_assignments
FOR EACH ROW
EXECUTE FUNCTION public.enqueue_task_assignment_notification();

REVOKE ALL ON FUNCTION public.enqueue_task_assignment_notification() FROM PUBLIC;

COMMENT ON FUNCTION public.enqueue_task_assignment_notification() IS
  'Encola task_assigned/task_cancelled de forma canónica al insertar o borrar una asignación.';
