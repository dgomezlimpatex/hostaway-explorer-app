-- Conserva cancelaciones enviables cuando una tarea se elimina físicamente y
-- acota los fallos anteriores a cualquier contacto con Meta. Esta migración no
-- reabre ni reencola eventos históricos.

ALTER TABLE public.notification_events
  ADD COLUMN IF NOT EXISTS snapshot jsonb,
  ADD COLUMN IF NOT EXISTS processing_attempts integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS max_attempts integer NOT NULL DEFAULT 3;

ALTER TABLE public.notification_events
  DROP CONSTRAINT IF EXISTS notification_events_status_check;
ALTER TABLE public.notification_events
  ADD CONSTRAINT notification_events_status_check
  CHECK (status IN ('pending', 'processing', 'sent', 'failed', 'cancelled', 'dead_letter'));

ALTER TABLE public.notification_events
  DROP CONSTRAINT IF EXISTS notification_events_processing_attempts_check;
ALTER TABLE public.notification_events
  ADD CONSTRAINT notification_events_processing_attempts_check
  CHECK (processing_attempts >= 0 AND max_attempts BETWEEN 1 AND 20);

CREATE OR REPLACE FUNCTION public.prevent_notification_event_snapshot_mutation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF OLD.snapshot IS NOT NULL AND OLD.snapshot IS DISTINCT FROM NEW.snapshot THEN
    RAISE EXCEPTION 'notification_event_snapshot_is_immutable'
      USING ERRCODE = '22023';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notification_events_snapshot_immutable
  ON public.notification_events;
CREATE TRIGGER trg_notification_events_snapshot_immutable
BEFORE UPDATE OF snapshot ON public.notification_events
FOR EACH ROW
EXECUTE FUNCTION public.prevent_notification_event_snapshot_mutation();

REVOKE ALL ON FUNCTION public.prevent_notification_event_snapshot_mutation()
  FROM PUBLIC, anon, authenticated;

-- Este trigger se ejecuta antes de que la FK de task_assignments aplique su
-- ON DELETE CASCADE y antes de que notification_events.task_id pase a NULL.
-- La clave es idéntica a la del trigger de bajas de asignación: si PostgreSQL
-- también ejecuta ese trigger durante la cascada, ON CONFLICT conserva una fila.
CREATE OR REPLACE FUNCTION public.enqueue_deleted_task_cancellations()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  assignment_row public.task_assignments%ROWTYPE;
  cancellation_snapshot jsonb;
BEGIN
  FOR assignment_row IN
    SELECT candidate.*
    FROM public.task_assignments candidate
    WHERE candidate.task_id = OLD.id
      AND candidate.cleaner_id IS NOT NULL
    ORDER BY candidate.id
  LOOP
    cancellation_snapshot := jsonb_build_object(
      'task', jsonb_build_object(
        'id', OLD.id,
        'property', OLD.property,
        'address', OLD.address,
        'date', OLD.date,
        'start_time', OLD.start_time,
        'end_time', OLD.end_time,
        'sede_id', OLD.sede_id
      ),
      'assignment', jsonb_build_object(
        'id', assignment_row.id,
        'cleaner_id', assignment_row.cleaner_id,
        'cleaner_name', assignment_row.cleaner_name
      )
    );

    INSERT INTO public.notification_events (
      event_type, entity_type, entity_id, task_id, cleaner_id, sede_id,
      payload, snapshot, dedupe_key, status
    ) VALUES (
      'task_cancelled', 'tasks', OLD.id, OLD.id, assignment_row.cleaner_id,
      OLD.sede_id,
      jsonb_build_object(
        'source', 'tasks_before_delete_trigger',
        'assignment_id', assignment_row.id,
        'operation', 'delete'
      ),
      cancellation_snapshot,
      concat(
        'task_cancelled:', OLD.id::text, ':', assignment_row.cleaner_id::text,
        ':assignment:', assignment_row.id::text
      ),
      'pending'
    )
    ON CONFLICT (dedupe_key) DO NOTHING;
  END LOOP;

  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_tasks_enqueue_deleted_task_cancellations
  ON public.tasks;
CREATE TRIGGER trg_tasks_enqueue_deleted_task_cancellations
BEFORE DELETE ON public.tasks
FOR EACH ROW
EXECUTE FUNCTION public.enqueue_deleted_task_cancellations();

REVOKE ALL ON FUNCTION public.enqueue_deleted_task_cancellations()
  FROM PUBLIC, anon, authenticated;

-- Mantiene las bajas manuales de una asignación en el mismo contrato de
-- snapshot/dedupe que el hard-delete de la tarea.
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
  task_snapshot jsonb;
BEGIN
  IF TG_OP = 'INSERT' THEN
    assignment_row := NEW;
    notification_type := 'task_assigned';
  ELSE
    assignment_row := OLD;
    notification_type := 'task_cancelled';
  END IF;

  SELECT task.* INTO task_record
  FROM public.tasks task
  WHERE task.id = assignment_row.task_id;

  -- Durante el cascade del hard-delete, el trigger BEFORE DELETE de tasks ya
  -- conservó el evento. Si la tarea ya no es visible no fabricamos otro.
  IF NOT FOUND OR assignment_row.cleaner_id IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  IF notification_type = 'task_cancelled' THEN
    task_snapshot := jsonb_build_object(
      'task', jsonb_build_object(
        'id', task_record.id,
        'property', task_record.property,
        'address', task_record.address,
        'date', task_record.date,
        'start_time', task_record.start_time,
        'end_time', task_record.end_time,
        'sede_id', task_record.sede_id
      ),
      'assignment', jsonb_build_object(
        'id', assignment_row.id,
        'cleaner_id', assignment_row.cleaner_id,
        'cleaner_name', assignment_row.cleaner_name
      )
    );
  END IF;

  INSERT INTO public.notification_events (
    event_type, entity_type, entity_id, task_id, cleaner_id, sede_id,
    payload, snapshot, dedupe_key, status
  ) VALUES (
    notification_type, 'tasks', assignment_row.task_id,
    assignment_row.task_id, assignment_row.cleaner_id, task_record.sede_id,
    jsonb_build_object(
      'source', 'task_assignments_after_write_trigger',
      'assignment_id', assignment_row.id,
      'operation', lower(TG_OP)
    ),
    task_snapshot,
    concat(
      notification_type, ':', assignment_row.task_id::text, ':',
      assignment_row.cleaner_id::text, ':assignment:', assignment_row.id::text
    ),
    'pending'
  )
  ON CONFLICT (dedupe_key) DO NOTHING;

  RETURN COALESCE(NEW, OLD);
END;
$$;

REVOKE ALL ON FUNCTION public.enqueue_task_assignment_notification()
  FROM PUBLIC, anon, authenticated;

-- Una excepción anterior al POST libera el evento para un número finito de
-- intentos. Solo la generación que conserva el lease puede mutarlo; al agotar
-- el presupuesto queda dead_letter y requiere revisión, nunca processing.
CREATE OR REPLACE FUNCTION public.finalize_whatsapp_pre_delivery_failure(
  _event_id uuid,
  _lease_token uuid,
  _error_message text
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  effective_status text;
BEGIN
  IF _event_id IS NULL OR _lease_token IS NULL THEN
    RETURN NULL;
  END IF;

  UPDATE public.notification_events
  SET status = CASE
        WHEN processing_attempts >= max_attempts THEN 'dead_letter'
        ELSE 'pending'
      END,
      processed_at = now(),
      processing_lease_token = NULL,
      error_message = left(
        COALESCE(NULLIF(btrim(_error_message), ''), 'Fallo anterior al envío WhatsApp'),
        1000
      )
  WHERE id = _event_id
    AND status = 'processing'
    AND processing_lease_token IS NOT DISTINCT FROM _lease_token
  RETURNING status INTO effective_status;

  RETURN effective_status;
END;
$$;

REVOKE ALL ON FUNCTION public.finalize_whatsapp_pre_delivery_failure(uuid, uuid, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.finalize_whatsapp_pre_delivery_failure(uuid, uuid, text)
  TO service_role;

COMMENT ON FUNCTION public.enqueue_deleted_task_cancellations() IS
  'Conserva una cancelación inmutable por asignación antes del hard-delete de tasks.';
COMMENT ON FUNCTION public.finalize_whatsapp_pre_delivery_failure(uuid, uuid, text) IS
  'Libera de forma cercada un fallo pre-delivery y lo lleva a dead_letter al agotar intentos.';
