-- Mantiene en el snapshot de notificación la duración total y el número de
-- trabajadores de la tarea. El procesador puede calcular el horario individual
-- aunque la asignación ya no exista cuando se procesa una cancelación.

CREATE OR REPLACE FUNCTION public.enqueue_task_assignment_notification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  assignment_row public.task_assignments%ROWTYPE;
  notification_type text;
  task_record public.tasks%ROWTYPE;
  cleaner_row public.cleaners%ROWTYPE;
  event_snapshot jsonb;
  worker_count integer;
BEGIN
  IF TG_OP = 'INSERT' THEN
    assignment_row := NEW;
    notification_type := 'task_assigned';
  ELSE
    assignment_row := OLD;
    notification_type := 'task_cancelled';
  END IF;

  SELECT task.* INTO task_record FROM public.tasks task
  WHERE task.id = assignment_row.task_id;
  IF NOT FOUND OR assignment_row.cleaner_id IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  SELECT COUNT(*)::integer + CASE WHEN TG_OP = 'DELETE' THEN 1 ELSE 0 END
    INTO worker_count
    FROM public.task_assignments
   WHERE task_id = assignment_row.task_id
     AND cleaner_id IS NOT NULL;
  worker_count := GREATEST(COALESCE(worker_count, 1), 1);

  SELECT cleaner.* INTO cleaner_row FROM public.cleaners cleaner
  WHERE cleaner.id = assignment_row.cleaner_id;
  event_snapshot := jsonb_build_object(
      'task', jsonb_build_object(
        'id', task_record.id, 'property', task_record.property,
        'address', task_record.address, 'date', task_record.date,
        'start_time', task_record.start_time, 'end_time', task_record.end_time,
        'duracion', task_record.duracion,
        'worker_count', worker_count,
        'sede_id', task_record.sede_id
      ),
      'assignment', jsonb_build_object(
        'id', assignment_row.id, 'cleaner_id', assignment_row.cleaner_id,
        'cleaner_name', assignment_row.cleaner_name
      ),
      'recipient', CASE WHEN cleaner_row.id IS NOT NULL
        THEN public.snapshot_notification_recipient(cleaner_row)
        ELSE jsonb_build_object(
          'name', assignment_row.cleaner_name, 'email', NULL, 'telefono', NULL,
          'whatsapp_phone_e164', NULL, 'effective_phone_e164', NULL,
          'whatsapp_notifications_enabled', false, 'whatsapp_opt_in', false
        ) END
  );

  INSERT INTO public.notification_events (
    event_type, entity_type, entity_id, task_id, cleaner_id, sede_id,
    payload, snapshot, dedupe_key, status
  ) VALUES (
    notification_type, 'tasks', assignment_row.task_id, assignment_row.task_id,
    assignment_row.cleaner_id, task_record.sede_id,
    jsonb_build_object(
      'source', 'task_assignments_after_write_trigger',
      'assignment_id', assignment_row.id,
      'operation', lower(TG_OP),
      'worker_count', worker_count
    ),
    event_snapshot,
    concat(notification_type, ':', assignment_row.task_id::text, ':',
      assignment_row.cleaner_id::text, ':assignment:', assignment_row.id::text),
    'pending'
  )
  ON CONFLICT (dedupe_key) DO NOTHING;
  RETURN COALESCE(NEW, OLD);
END;
$$;

REVOKE ALL ON FUNCTION public.enqueue_task_assignment_notification()
  FROM PUBLIC, anon, authenticated;

COMMENT ON FUNCTION public.enqueue_task_assignment_notification() IS
  'Encola asignaciones/cancelaciones con duración total y número de trabajadores para calcular horarios individuales.';
