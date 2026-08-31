-- Centraliza las notificaciones WhatsApp de modificaciones de tareas.
-- Toda modificación operativa de una tarea ya asignada crea un evento
-- task_modified para cada trabajador de task_assignments. El cron existente
-- whatsapp-process-pending procesa los eventos pendientes cada dos minutos.

CREATE OR REPLACE FUNCTION public.enqueue_task_modified_notifications()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  old_operational jsonb;
  new_operational jsonb;
  changed_fields jsonb;
  change_token uuid := gen_random_uuid();
  assigned_cleaner_id uuid;
BEGIN
  -- Estos campos son técnicos o pertenecen al flujo de respuesta WhatsApp.
  -- No representan una modificación operativa realizada sobre la tarea.
  old_operational := to_jsonb(OLD) - ARRAY[
    'created_at',
    'updated_at',
    'cleaner',
    'cleaner_id',
    'auto_assigned',
    'assignment_confidence',
    'approval_status',
    'approval_requested_at',
    'approved_at',
    'rejected_at',
    'approval_response_source',
    'approval_rejection_reason',
    'last_approval_reminder_at',
    'late_start_reminder_sent_at'
  ]::text[];

  new_operational := to_jsonb(NEW) - ARRAY[
    'created_at',
    'updated_at',
    'cleaner',
    'cleaner_id',
    'auto_assigned',
    'assignment_confidence',
    'approval_status',
    'approval_requested_at',
    'approved_at',
    'rejected_at',
    'approval_response_source',
    'approval_rejection_reason',
    'last_approval_reminder_at',
    'late_start_reminder_sent_at'
  ]::text[];

  IF old_operational IS NOT DISTINCT FROM new_operational THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(jsonb_agg(field_name ORDER BY field_name), '[]'::jsonb)
  INTO changed_fields
  FROM (
    SELECT key AS field_name
    FROM jsonb_object_keys(old_operational || new_operational) AS keys(key)
    WHERE old_operational -> key IS DISTINCT FROM new_operational -> key
  ) AS changed;

  FOR assigned_cleaner_id IN
    SELECT current_assignments.cleaner_id
    FROM (
      SELECT cleaner_id
      FROM public.task_assignments
      WHERE task_id = NEW.id
        AND cleaner_id IS NOT NULL

      UNION

      -- Compatibilidad con tareas antiguas todavía sin task_assignments.
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

DROP TRIGGER IF EXISTS trg_tasks_enqueue_modified_notifications ON public.tasks;

CREATE TRIGGER trg_tasks_enqueue_modified_notifications
AFTER UPDATE ON public.tasks
FOR EACH ROW
EXECUTE FUNCTION public.enqueue_task_modified_notifications();

REVOKE ALL ON FUNCTION public.enqueue_task_modified_notifications() FROM PUBLIC;

COMMENT ON FUNCTION public.enqueue_task_modified_notifications() IS
  'Crea un task_modified por trabajador ante cualquier cambio operativo de una tarea asignada.';
