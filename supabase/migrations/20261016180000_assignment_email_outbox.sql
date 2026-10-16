-- Cola de correos de asignación (alta/baja de responsable).
--
-- Los correos se apuntan en la MISMA transacción que guarda el responsable
-- (igual que el trigger de WhatsApp) y un proceso automático los envía con
-- reintentos. No cambia set_task_assignments (el de producción lleva bloqueos
-- propios): lo envuelve. Esta migración es inerte hasta que el proceso
-- `process-assignment-email-outbox` esté programado y la app llame a la función.

CREATE TABLE IF NOT EXISTS public.assignment_email_outbox (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL CHECK (kind IN ('assigned', 'unassigned')),
  task_id uuid REFERENCES public.tasks(id) ON DELETE SET NULL,
  cleaner_id uuid REFERENCES public.cleaners(id) ON DELETE SET NULL,
  recipient_email text NOT NULL,
  recipient_name text NOT NULL,
  worker_count integer NOT NULL DEFAULT 1 CHECK (worker_count >= 1),
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'sending', 'sent', 'failed', 'skipped')),
  attempts integer NOT NULL DEFAULT 0,
  max_attempts integer NOT NULL DEFAULT 5 CHECK (max_attempts >= 1),
  next_attempt_at timestamptz NOT NULL DEFAULT now(),
  lease_token uuid,
  lease_expires_at timestamptz,
  last_error text,
  skip_reason text,
  -- Solo una prueba manual puede desactivar la comprobación de que la
  -- asignación sigue vigente al enviar.
  verify_assignment boolean NOT NULL DEFAULT true,
  dedupe_key text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz
);

CREATE INDEX IF NOT EXISTS assignment_email_outbox_due_idx
  ON public.assignment_email_outbox (status, next_attempt_at)
  WHERE status IN ('pending', 'sending');

ALTER TABLE public.assignment_email_outbox ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.assignment_email_outbox FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.assignment_email_outbox TO service_role;

DROP POLICY IF EXISTS assignment_email_outbox_service_role ON public.assignment_email_outbox;
CREATE POLICY assignment_email_outbox_service_role
  ON public.assignment_email_outbox
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Guarda responsables y apunta sus correos en una sola transacción.
CREATE OR REPLACE FUNCTION public.set_task_assignments_queue_email(
  _task_id uuid,
  _cleaner_ids uuid[]
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public'
AS $$
DECLARE
  result jsonb;
  worker_total integer;
  kind_value text;
  item jsonb;
  tx text := txid_current()::text;
BEGIN
  -- La autorización y los bloqueos son los de la función existente.
  result := public.set_task_assignments(_task_id, _cleaner_ids);
  worker_total := GREATEST(1, COALESCE(jsonb_array_length(result -> 'final'), 0));

  FOR kind_value, item IN
    SELECT 'assigned', value FROM jsonb_array_elements(COALESCE(result -> 'added', '[]'::jsonb))
    UNION ALL
    SELECT 'unassigned', value FROM jsonb_array_elements(COALESCE(result -> 'removed', '[]'::jsonb))
  LOOP
    CONTINUE WHEN NULLIF(btrim(COALESCE(item ->> 'email', '')), '') IS NULL;
    INSERT INTO public.assignment_email_outbox (
      kind, task_id, cleaner_id, recipient_email, recipient_name, worker_count, dedupe_key
    ) VALUES (
      kind_value,
      _task_id,
      (item ->> 'id')::uuid,
      btrim(item ->> 'email'),
      COALESCE(NULLIF(btrim(COALESCE(item ->> 'name', '')), ''), 'Equipo'),
      worker_total,
      concat_ws(':', kind_value, _task_id::text, item ->> 'id', tx)
    )
    ON CONFLICT (dedupe_key) DO NOTHING;
  END LOOP;

  RETURN result;
END;
$$;

REVOKE ALL ON FUNCTION public.set_task_assignments_queue_email(uuid, uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_task_assignments_queue_email(uuid, uuid[]) TO authenticated, service_role;

-- Reserva un lote para enviarlo. Solo envía si la asignación sigue como
-- cuando se apuntó el correo: un reparto revertido o corregido antes del envío
-- no genera avisos falsos.
CREATE OR REPLACE FUNCTION public.claim_assignment_emails(_limit integer DEFAULT 20)
RETURNS TABLE (
  id uuid,
  kind text,
  task_id uuid,
  cleaner_id uuid,
  recipient_email text,
  recipient_name text,
  worker_count integer,
  attempts integer,
  max_attempts integer,
  lease_token uuid,
  skip_reason text,
  task jsonb
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public'
AS $$
#variable_conflict use_column
BEGIN
  -- Un envío que perdió su reserva sin confirmar y agotó los intentos no se
  -- repite a ciegas: podría haber salido ya. Queda a la vista como fallido.
  UPDATE public.assignment_email_outbox o
     SET status = 'failed',
         lease_token = NULL,
         lease_expires_at = NULL,
         finished_at = now(),
         last_error = COALESCE(o.last_error, 'Sin confirmación del envío tras agotar los intentos')
   WHERE o.status = 'sending'
     AND o.lease_expires_at < now()
     AND o.attempts >= o.max_attempts;

  RETURN QUERY
  WITH due AS (
    SELECT o.id
      FROM public.assignment_email_outbox o
     WHERE o.attempts < o.max_attempts
       AND (
         (o.status = 'pending' AND o.next_attempt_at <= now())
         OR (o.status = 'sending' AND o.lease_expires_at < now())
       )
     ORDER BY o.created_at, o.id
     LIMIT LEAST(GREATEST(COALESCE(_limit, 20), 1), 50)
     FOR UPDATE SKIP LOCKED
  ),
  claimed AS (
    UPDATE public.assignment_email_outbox o
       SET status = 'sending',
           attempts = o.attempts + 1,
           lease_token = gen_random_uuid(),
           lease_expires_at = now() + interval '3 minutes'
      FROM due
     WHERE o.id = due.id
    RETURNING o.*
  )
  SELECT
    c.id,
    c.kind,
    c.task_id,
    c.cleaner_id,
    c.recipient_email,
    c.recipient_name,
    c.worker_count,
    c.attempts,
    c.max_attempts,
    c.lease_token,
    CASE
      WHEN t.id IS NULL THEN 'task_deleted'
      WHEN c.kind = 'assigned' AND lower(COALESCE(t.status, '')) IN ('cancelled', 'canceled') THEN 'task_cancelled'
      WHEN c.verify_assignment
        AND (c.kind = 'assigned') IS DISTINCT FROM EXISTS (
          SELECT 1 FROM public.task_assignments ta
           WHERE ta.task_id = c.task_id AND ta.cleaner_id = c.cleaner_id
        ) THEN 'assignment_changed'
      ELSE NULL
    END,
    CASE WHEN t.id IS NULL THEN NULL ELSE jsonb_build_object(
      'property', t.property,
      'address', t.address,
      'date', t.date,
      'startTime', t.start_time,
      'endTime', t.end_time,
      'durationMinutes', t.duracion,
      'workerCount', c.worker_count,
      'type', COALESCE(NULLIF(t.type, ''), 'Limpieza general'),
      'notes', CASE WHEN NULLIF(t.supervisor, '') IS NULL THEN NULL ELSE 'Supervisor: ' || t.supervisor END
    ) END
  FROM claimed c
  LEFT JOIN public.tasks t ON t.id = c.task_id
  ORDER BY c.created_at, c.id;
END;
$$;

-- Cierra un envío. Resultados: 'sent', 'skipped' o 'retry' (error temporal).
-- Con 'retry' reprograma con espera creciente y, agotados los intentos, queda
-- 'failed'. Solo cierra quien conserva la reserva vigente.
CREATE OR REPLACE FUNCTION public.finish_assignment_email(
  _id uuid,
  _lease_token uuid,
  _outcome text,
  _detail text DEFAULT NULL
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public'
AS $$
DECLARE
  row_value public.assignment_email_outbox%ROWTYPE;
  final_status text;
BEGIN
  IF _outcome NOT IN ('sent', 'skipped', 'retry') THEN
    RAISE EXCEPTION 'Resultado no válido: %', _outcome;
  END IF;

  SELECT * INTO row_value
    FROM public.assignment_email_outbox
   WHERE id = _id AND lease_token = _lease_token AND status = 'sending'
   FOR UPDATE;
  IF NOT FOUND THEN RETURN 'lease_lost'; END IF;

  IF _outcome = 'sent' THEN
    final_status := 'sent';
  ELSIF _outcome = 'skipped' THEN
    final_status := 'skipped';
  ELSIF row_value.attempts >= row_value.max_attempts THEN
    final_status := 'failed';
  ELSE
    final_status := 'pending';
  END IF;

  UPDATE public.assignment_email_outbox
     SET status = final_status,
         lease_token = NULL,
         lease_expires_at = NULL,
         last_error = CASE WHEN _outcome = 'retry' THEN left(_detail, 500) ELSE last_error END,
         skip_reason = CASE WHEN _outcome = 'skipped' THEN left(_detail, 200) ELSE skip_reason END,
         next_attempt_at = CASE
           WHEN final_status = 'pending'
             THEN now() + (CASE row_value.attempts WHEN 1 THEN interval '1 minute'
                                                   WHEN 2 THEN interval '3 minutes'
                                                   WHEN 3 THEN interval '10 minutes'
                                                   ELSE interval '30 minutes' END)
           ELSE next_attempt_at END,
         finished_at = CASE WHEN final_status = 'pending' THEN NULL ELSE now() END
   WHERE id = _id;

  RETURN final_status;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_assignment_emails(integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.finish_assignment_email(uuid, uuid, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_assignment_emails(integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.finish_assignment_email(uuid, uuid, text, text) TO service_role;
