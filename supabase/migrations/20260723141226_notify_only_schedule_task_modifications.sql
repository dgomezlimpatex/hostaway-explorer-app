-- task_modified es exclusivamente un aviso de reprogramación.
-- Ningún cambio de reporte, checklist, estado, dirección, asignación o metadato
-- técnico debe generar este WhatsApp.

CREATE OR REPLACE FUNCTION public.enqueue_task_modified_notifications()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  changed_fields jsonb := '[]'::jsonb;
  change_token uuid := gen_random_uuid();
  assigned_cleaner_id uuid;
BEGIN
  -- Allowlist cerrada: solamente día y horas planificadas.
  IF ROW(OLD.date, OLD.start_time, OLD.end_time)
     IS NOT DISTINCT FROM
     ROW(NEW.date, NEW.start_time, NEW.end_time) THEN
    RETURN NEW;
  END IF;

  IF OLD.date IS DISTINCT FROM NEW.date THEN
    changed_fields := changed_fields || jsonb_build_array('date');
  END IF;
  IF OLD.start_time IS DISTINCT FROM NEW.start_time THEN
    changed_fields := changed_fields || jsonb_build_array('start_time');
  END IF;
  IF OLD.end_time IS DISTINCT FROM NEW.end_time THEN
    changed_fields := changed_fields || jsonb_build_array('end_time');
  END IF;

  FOR assigned_cleaner_id IN
    SELECT current_assignments.cleaner_id
    FROM (
      SELECT cleaner_id
      FROM public.task_assignments
      WHERE task_id = NEW.id
        AND cleaner_id IS NOT NULL

      UNION

      SELECT NEW.cleaner_id
      WHERE NEW.cleaner_id IS NOT NULL
        AND NOT EXISTS (
          SELECT 1
          FROM public.task_assignments
          WHERE task_id = NEW.id
            AND cleaner_id IS NOT NULL
        )
    ) AS current_assignments
  LOOP
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
      'task_modified',
      'tasks',
      NEW.id,
      NEW.id,
      assigned_cleaner_id,
      NEW.sede_id,
      jsonb_build_object(
        'source', 'tasks_after_update_trigger',
        'changed_fields', changed_fields
      ),
      concat(
        'task_modified:',
        NEW.id::text,
        ':',
        assigned_cleaner_id::text,
        ':',
        change_token::text
      ),
      'pending'
    )
    ON CONFLICT (dedupe_key) DO NOTHING;
  END LOOP;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.enqueue_task_modified_notifications()
  FROM PUBLIC, anon, authenticated;

COMMENT ON FUNCTION public.enqueue_task_modified_notifications() IS
  'Crea task_modified únicamente si cambia tasks.date, tasks.start_time o tasks.end_time.';
