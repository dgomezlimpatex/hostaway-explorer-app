-- Aplica estados de Meta de forma transaccional y monotónica.
-- Evita que webhooks repetidos o fuera de orden degraden delivered/read.

-- Fail-closed: no intentamos decidir automáticamente cuál de dos filas históricas
-- representa el mensaje real. El despliegue debe detenerse y sanearse con auditoría.
DO $provider_id_preflight$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.notification_deliveries delivery
    WHERE delivery.provider_message_id IS NOT NULL
    GROUP BY delivery.channel, delivery.provider, delivery.provider_message_id
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'duplicate_provider_message_id_prevents_whatsapp_hardening';
  END IF;
END;
$provider_id_preflight$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_notification_deliveries_provider_message_unique
ON public.notification_deliveries (channel, provider, provider_message_id)
WHERE provider_message_id IS NOT NULL;

ALTER TABLE public.notification_events
  ADD COLUMN IF NOT EXISTS processing_lease_token uuid;

DO $active_whatsapp_preflight$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.notification_deliveries delivery
    WHERE delivery.channel = 'whatsapp'
      AND delivery.provider = 'meta_cloud_api'
      AND delivery.status IN ('queued', 'sent', 'delivered', 'read')
    GROUP BY delivery.notification_event_id
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'duplicate_active_whatsapp_delivery_prevents_lease_hardening';
  END IF;
END;
$active_whatsapp_preflight$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_notification_deliveries_one_active_whatsapp
ON public.notification_deliveries (notification_event_id)
WHERE channel = 'whatsapp'
  AND provider = 'meta_cloud_api'
  AND status IN ('queued', 'sent', 'delivered', 'read');

-- Bandeja duradera para callbacks firmados que pueden llegar antes de que la
-- respuesta del POST a Meta se haya persistido. No se expone al navegador.
CREATE TABLE IF NOT EXISTS public.whatsapp_webhook_inbox (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  callback_key text NOT NULL UNIQUE,
  callback_kind text NOT NULL CHECK (callback_kind IN ('status', 'button', 'quarantine')),
  provider_message_id text NOT NULL,
  whatsapp_message_id text,
  sender text,
  button_payload text,
  action text,
  task_id uuid,
  delivery_status text,
  occurred_at timestamptz NOT NULL,
  error_message text,
  processing_status text NOT NULL DEFAULT 'pending'
    CHECK (processing_status IN ('pending', 'processing', 'processed', 'manual_review')),
  outcome text,
  attempts integer NOT NULL DEFAULT 0,
  received_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz,
  claimed_at timestamptz,
  callback_claim_token uuid,
  last_error text
);

ALTER TABLE public.whatsapp_webhook_inbox
  ADD COLUMN IF NOT EXISTS callback_claim_token uuid;

CREATE INDEX IF NOT EXISTS idx_whatsapp_webhook_inbox_pending
ON public.whatsapp_webhook_inbox (provider_message_id, occurred_at)
WHERE processing_status = 'pending';

CREATE INDEX IF NOT EXISTS idx_whatsapp_webhook_inbox_claimable
ON public.whatsapp_webhook_inbox (received_at)
WHERE processing_status IN ('pending', 'processing');

ALTER TABLE public.whatsapp_webhook_inbox ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.whatsapp_webhook_inbox FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.whatsapp_webhook_inbox TO service_role;

-- Retención mínima de PII: los callbacks ya procesados se eliminan a los 30
-- días y cualquier callback pendiente/manual se conserva como máximo 90 días.
-- Las métricas operativas necesarias permanecen agregadas en deliveries/events.
CREATE OR REPLACE FUNCTION public.purge_whatsapp_webhook_inbox()
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  deleted_count bigint;
BEGIN
  DELETE FROM public.whatsapp_webhook_inbox inbox
  WHERE (
      inbox.processing_status = 'processed'
      AND inbox.received_at < now() - interval '30 days'
    )
    OR inbox.received_at < now() - interval '90 days';
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;

REVOKE ALL ON FUNCTION public.purge_whatsapp_webhook_inbox()
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.purge_whatsapp_webhook_inbox()
  TO service_role;

-- pg_cron ya forma parte de la infraestructura de notificaciones. Se reemplaza
-- solo este job para que reaplicar la migración no duplique tareas de purga.
DO $retention$
DECLARE
  existing_job_id bigint;
BEGIN
  FOR existing_job_id IN
    SELECT jobid FROM cron.job
    WHERE jobname = 'whatsapp-webhook-inbox-retention'
  LOOP
    PERFORM cron.unschedule(existing_job_id);
  END LOOP;

  PERFORM cron.schedule(
    'whatsapp-webhook-inbox-retention',
    '17 3 * * *',
    'SELECT public.purge_whatsapp_webhook_inbox();'
  );
END;
$retention$;

CREATE OR REPLACE FUNCTION public.record_whatsapp_webhook_callback(
  _callback_key text,
  _callback_kind text,
  _provider_message_id text,
  _whatsapp_message_id text,
  _sender text,
  _button_payload text,
  _action text,
  _task_id uuid,
  _delivery_status text,
  _occurred_at timestamptz,
  _error_message text DEFAULT NULL
)
RETURNS TABLE (callback_id uuid, processing_status text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF COALESCE(btrim(_callback_key), '') = ''
     OR _callback_kind NOT IN ('status', 'button')
     OR COALESCE(btrim(_provider_message_id), '') = ''
     OR _occurred_at IS NULL THEN
    RAISE EXCEPTION 'invalid_whatsapp_callback' USING ERRCODE = '22023';
  END IF;

  RETURN QUERY
  INSERT INTO public.whatsapp_webhook_inbox AS inbox (
    callback_key, callback_kind, provider_message_id, whatsapp_message_id,
    sender, button_payload, action, task_id, delivery_status, occurred_at,
    error_message
  ) VALUES (
    left(_callback_key, 500), _callback_kind, left(_provider_message_id, 500),
    NULLIF(left(COALESCE(_whatsapp_message_id, ''), 500), ''),
    NULLIF(left(COALESCE(_sender, ''), 100), ''),
    NULLIF(left(COALESCE(_button_payload, ''), 500), ''),
    NULLIF(left(COALESCE(_action, ''), 50), ''), _task_id,
    NULLIF(left(COALESCE(_delivery_status, ''), 30), ''), _occurred_at,
    NULLIF(left(COALESCE(_error_message, ''), 1000), '')
  )
  ON CONFLICT (callback_key) DO UPDATE
    SET received_at = LEAST(inbox.received_at, EXCLUDED.received_at)
  RETURNING inbox.id, inbox.processing_status;
END;
$$;

-- Cuarentena mínima para payloads firmados que no pueden interpretarse de
-- forma segura. Solo guarda un hash determinista y el motivo; nunca el cuerpo
-- completo ni PII adicional. La fila queda visible para revisión operativa.
CREATE OR REPLACE FUNCTION public.record_whatsapp_webhook_quarantine(
  _callback_key text,
  _reason text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  quarantined_id uuid;
BEGIN
  IF COALESCE(btrim(_callback_key), '') = ''
     OR COALESCE(btrim(_reason), '') = '' THEN
    RAISE EXCEPTION 'invalid_whatsapp_quarantine' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.whatsapp_webhook_inbox AS inbox (
    callback_key, callback_kind, provider_message_id, occurred_at,
    processing_status, outcome, attempts, processed_at, last_error
  ) VALUES (
    left(_callback_key, 500), 'quarantine', left(_callback_key, 500), now(),
    'manual_review', left(_reason, 100), 1, now(), left(_reason, 1000)
  )
  ON CONFLICT (callback_key) DO UPDATE
    SET received_at = LEAST(inbox.received_at, EXCLUDED.received_at),
        processing_status = 'manual_review',
        outcome = EXCLUDED.outcome,
        attempts = inbox.attempts + 1,
        processed_at = COALESCE(inbox.processed_at, now()),
        last_error = EXCLUDED.last_error
  RETURNING inbox.id INTO quarantined_id;

  RETURN quarantined_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.mark_whatsapp_webhook_callback(
  _callback_id uuid,
  _outcome text,
  _processed boolean,
  _last_error text DEFAULT NULL,
  _claim_token uuid DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  UPDATE public.whatsapp_webhook_inbox inbox
  SET processing_status = CASE
        WHEN _processed THEN 'processed'
        WHEN _outcome = 'retry_failed' THEN 'pending'
        WHEN _outcome IN (
          'unsupported_status', 'invalid_reconciliation_payload',
          'unsupported_action', 'correlation_exhausted'
        ) THEN 'manual_review'
        ELSE 'pending'
      END,
      outcome = left(COALESCE(_outcome, 'unknown'), 100),
      attempts = attempts + 1,
      processed_at = CASE
        WHEN _processed OR _outcome IN (
          'unsupported_status', 'invalid_reconciliation_payload',
          'unsupported_action', 'correlation_exhausted'
        ) THEN now()
        ELSE processed_at
      END,
      claimed_at = NULL,
      callback_claim_token = NULL,
      last_error = NULLIF(left(COALESCE(_last_error, ''), 1000), '')
  WHERE inbox.id = _callback_id
    AND (
      (
        inbox.processing_status = 'processing'
        AND _claim_token IS NOT NULL
        AND inbox.callback_claim_token = _claim_token
      )
      OR (
        inbox.processing_status = 'pending'
        AND _claim_token IS NULL
        AND inbox.callback_claim_token IS NULL
      )
    );
END;
$$;

-- Reclama filas de forma atómica para que dos ejecuciones del cron no puedan
-- cerrar el mismo callback en paralelo. Los claims abandonados vuelven a ser
-- elegibles después de diez minutos.
CREATE OR REPLACE FUNCTION public.claim_whatsapp_webhook_callbacks(
  _limit integer DEFAULT 50
)
RETURNS SETOF public.whatsapp_webhook_inbox
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  RETURN QUERY
  WITH candidates AS (
    SELECT inbox.id
    FROM public.whatsapp_webhook_inbox inbox
    WHERE inbox.processing_status = 'pending'
       OR (
         inbox.processing_status = 'processing'
         AND inbox.claimed_at < now() - interval '10 minutes'
       )
    ORDER BY inbox.received_at
    FOR UPDATE SKIP LOCKED
    LIMIT GREATEST(1, LEAST(_limit, 100))
  )
  UPDATE public.whatsapp_webhook_inbox inbox
  SET processing_status = 'processing',
      claimed_at = now(),
      callback_claim_token = gen_random_uuid()
  FROM candidates
  WHERE inbox.id = candidates.id
  RETURNING inbox.*;
END;
$$;

REVOKE ALL ON FUNCTION public.record_whatsapp_webhook_callback(text, text, text, text, text, text, text, uuid, text, timestamptz, text)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.record_whatsapp_webhook_quarantine(text, text)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.mark_whatsapp_webhook_callback(uuid, text, boolean, text, uuid)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.claim_whatsapp_webhook_callbacks(integer)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_whatsapp_webhook_callback(text, text, text, text, text, text, text, uuid, text, timestamptz, text)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.record_whatsapp_webhook_quarantine(text, text)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.mark_whatsapp_webhook_callback(uuid, text, boolean, text, uuid)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.claim_whatsapp_webhook_callbacks(integer)
  TO service_role;

-- Un estado temprano solo puede vincularse cuando el provider_message_id ya
-- existe en una delivery. El teléfono y una ventana temporal no demuestran qué
-- mensaje originó el callback; los no correlacionados permanecen en el inbox.
CREATE OR REPLACE FUNCTION public.bind_whatsapp_delivery_from_status(
  _provider_message_id text,
  _recipient text,
  _occurred_at timestamptz
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  bound_id uuid;
BEGIN
  IF COALESCE(btrim(_provider_message_id), '') = '' OR _occurred_at IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT delivery.id INTO bound_id
  FROM public.notification_deliveries delivery
  WHERE delivery.channel = 'whatsapp'
    AND delivery.provider = 'meta_cloud_api'
    AND delivery.provider_message_id = _provider_message_id;

  RETURN bound_id;
END;
$$;

-- Persiste la respuesta síncrona sin degradar un callback que se adelantó.
CREATE OR REPLACE FUNCTION public.prepare_whatsapp_send_delivery(
  _event_id uuid,
  _lease_token uuid,
  _recipient text,
  _template_name text,
  _provider_payload jsonb
)
RETURNS TABLE (
  delivery_id uuid,
  ready_to_send boolean,
  effective_status text,
  provider_message_id text,
  reconciliation_required boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  event_row public.notification_events%ROWTYPE;
  delivery public.notification_deliveries%ROWTYPE;
  fallback public.notification_deliveries%ROWTYPE;
BEGIN
  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(_event_id::text, 20260720)
  );

  SELECT * INTO event_row
  FROM public.notification_events
  WHERE id = _event_id
  FOR UPDATE;

  IF event_row.id IS NULL
     OR event_row.status <> 'processing'
     OR event_row.processing_lease_token IS DISTINCT FROM _lease_token THEN
    RETURN QUERY SELECT NULL::uuid, false, 'stale_lease'::text, NULL::text, false;
    RETURN;
  END IF;

  -- Una vez reclamado el canal de respaldo, el corte multicanal es durable.
  -- Aunque el evento padre quedase processing por un crash, no se vuelve a Meta.
  SELECT * INTO fallback
  FROM public.notification_deliveries fallback_row
  WHERE fallback_row.notification_event_id = _event_id
    AND fallback_row.channel = 'email'
    AND fallback_row.template_name = 'task_rejected_admin_fallback_email'
  FOR UPDATE;
  IF fallback.id IS NOT NULL THEN
    UPDATE public.notification_events
    SET status = CASE WHEN fallback.status = 'sent' THEN 'sent' ELSE 'failed' END,
        processed_at = now(),
        processing_lease_token = NULL,
        error_message = CASE
          WHEN fallback.status = 'sent' THEN 'WhatsApp falló; correo de respaldo enviado'
          ELSE COALESCE(fallback.error_message, 'Fallback email reclamado o pendiente de conciliación')
        END
    WHERE id = _event_id;
    RETURN QUERY SELECT NULL::uuid, false,
      CASE WHEN fallback.status = 'sent' THEN 'fallback_sent' ELSE 'fallback_committed' END,
      fallback.provider_message_id, fallback.status = 'queued';
    RETURN;
  END IF;

  SELECT * INTO delivery
  FROM public.notification_deliveries
  WHERE notification_event_id = _event_id
    AND channel = 'whatsapp'
    AND provider = 'meta_cloud_api'
    AND status IN ('queued', 'sent', 'delivered', 'read')
  ORDER BY created_at DESC
  LIMIT 1
  FOR UPDATE;

  IF delivery.id IS NOT NULL THEN
    IF delivery.status IN ('sent', 'delivered', 'read') THEN
      RETURN QUERY SELECT delivery.id, false, delivery.status,
        delivery.provider_message_id, false;
      RETURN;
    END IF;

    IF delivery.provider_message_id IS NOT NULL
       OR COALESCE(delivery.provider_payload, '{}'::jsonb) ? 'send_started_at' THEN
      RETURN QUERY SELECT delivery.id, false, delivery.status,
        delivery.provider_message_id, true;
      RETURN;
    END IF;

    UPDATE public.notification_deliveries
    SET recipient = _recipient,
        template_name = _template_name,
        provider_payload = COALESCE(_provider_payload, '{}'::jsonb),
        error_code = NULL,
        error_message = NULL
    WHERE id = delivery.id;

    RETURN QUERY SELECT delivery.id, true, 'queued'::text, NULL::text, false;
    RETURN;
  END IF;

  INSERT INTO public.notification_deliveries (
    notification_event_id, channel, provider, recipient, template_name,
    status, provider_payload
  ) VALUES (
    _event_id, 'whatsapp', 'meta_cloud_api', _recipient, _template_name,
    'queued', COALESCE(_provider_payload, '{}'::jsonb)
  )
  RETURNING * INTO delivery;

  RETURN QUERY SELECT delivery.id, true, delivery.status,
    delivery.provider_message_id, false;
END;
$$;

REVOKE ALL ON FUNCTION public.prepare_whatsapp_send_delivery(uuid, uuid, text, text, jsonb)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.prepare_whatsapp_send_delivery(uuid, uuid, text, text, jsonb)
  TO service_role;

CREATE OR REPLACE FUNCTION public.begin_whatsapp_send_delivery(
  _delivery_id uuid,
  _event_id uuid,
  _lease_token uuid,
  _provider_payload jsonb
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  event_row public.notification_events%ROWTYPE;
  delivery public.notification_deliveries%ROWTYPE;
BEGIN
  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(_event_id::text, 20260720)
  );

  SELECT * INTO event_row
  FROM public.notification_events
  WHERE id = _event_id
  FOR UPDATE;

  IF event_row.id IS NULL
     OR event_row.status <> 'processing'
     OR event_row.processing_lease_token IS DISTINCT FROM _lease_token THEN
    RETURN false;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.notification_deliveries fallback
    WHERE fallback.notification_event_id = _event_id
      AND fallback.channel = 'email'
      AND fallback.template_name = 'task_rejected_admin_fallback_email'
  ) THEN
    RETURN false;
  END IF;

  SELECT * INTO delivery
  FROM public.notification_deliveries
  WHERE id = _delivery_id
    AND notification_event_id = _event_id
  FOR UPDATE;

  IF delivery.id IS NULL
     OR delivery.channel <> 'whatsapp'
     OR delivery.provider <> 'meta_cloud_api'
     OR delivery.status <> 'queued'
     OR delivery.provider_message_id IS NOT NULL
     OR COALESCE(delivery.provider_payload, '{}'::jsonb) ? 'send_started_at' THEN
    RETURN false;
  END IF;

  UPDATE public.notification_deliveries
  SET provider_payload = COALESCE(_provider_payload, '{}'::jsonb)
    || jsonb_build_object(
      'send_started_at', now(),
      'meta_attempt_state', 'contacting_meta',
      'send_lease_token', _lease_token
    )
  WHERE id = _delivery_id;

  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.begin_whatsapp_send_delivery(uuid, uuid, uuid, jsonb)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.begin_whatsapp_send_delivery(uuid, uuid, uuid, jsonb)
  TO service_role;

CREATE OR REPLACE FUNCTION public.finalize_whatsapp_unavailable_delivery(
  _delivery_id uuid,
  _event_id uuid,
  _lease_token uuid,
  _reason text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  event_row public.notification_events%ROWTYPE;
  delivery public.notification_deliveries%ROWTYPE;
BEGIN
  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(_event_id::text, 20260720)
  );

  SELECT * INTO event_row FROM public.notification_events
  WHERE id = _event_id FOR UPDATE;
  IF event_row.id IS NULL
     OR event_row.status <> 'processing'
     OR event_row.processing_lease_token IS DISTINCT FROM _lease_token THEN
    RETURN false;
  END IF;

  SELECT * INTO delivery FROM public.notification_deliveries
  WHERE id = _delivery_id
    AND notification_event_id = _event_id
  FOR UPDATE;
  IF delivery.id IS NULL
     OR delivery.channel <> 'whatsapp'
     OR delivery.provider <> 'meta_cloud_api'
     OR delivery.status <> 'queued'
     OR delivery.provider_message_id IS NOT NULL
     OR COALESCE(delivery.provider_payload, '{}'::jsonb) ? 'send_started_at' THEN
    RETURN false;
  END IF;

  UPDATE public.notification_deliveries
  SET status = 'skipped',
      error_code = 'channel_unavailable',
      error_message = left(COALESCE(_reason, 'Canal WhatsApp no disponible'), 1000)
  WHERE id = _delivery_id;

  UPDATE public.notification_events
  SET status = 'failed',
      processed_at = now(),
      processing_lease_token = NULL,
      error_message = left(COALESCE(_reason, 'Canal WhatsApp no disponible'), 1000)
  WHERE id = _event_id;

  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.finalize_whatsapp_unavailable_delivery(uuid, uuid, uuid, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.finalize_whatsapp_unavailable_delivery(uuid, uuid, uuid, text)
  TO service_role;

-- Cierra respuestas deterministas sin ID (rechazo explícito de Meta, validación
-- local o dry-run). Comparte el lock por evento y el token generacional con los
-- demás finalizadores: una respuesta tardía nunca puede degradar sent/delivered/read.
CREATE OR REPLACE FUNCTION public.finalize_whatsapp_non_delivery_result(
  _delivery_id uuid,
  _lease_token uuid,
  _result_status text,
  _provider_response jsonb,
  _error_code text,
  _error_message text
)
RETURNS TABLE (
  effective_status text,
  provider_message_id text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  delivery public.notification_deliveries%ROWTYPE;
  locked_event_id uuid;
BEGIN
  IF _result_status NOT IN ('failed', 'skipped') THEN
    RAISE EXCEPTION 'invalid_non_delivery_status' USING ERRCODE = '22023';
  END IF;

  SELECT row.notification_event_id INTO locked_event_id
  FROM public.notification_deliveries row
  WHERE row.id = _delivery_id
    AND row.channel = 'whatsapp'
    AND row.provider = 'meta_cloud_api';

  IF locked_event_id IS NULL THEN
    RAISE EXCEPTION 'whatsapp_delivery_not_found' USING ERRCODE = 'P0002';
  END IF;

  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(locked_event_id::text, 20260720)
  );

  SELECT row.* INTO delivery
  FROM public.notification_deliveries row
  WHERE row.id = _delivery_id FOR UPDATE;

  IF NOT FOUND OR delivery.channel <> 'whatsapp' OR delivery.provider <> 'meta_cloud_api'
     OR delivery.notification_event_id <> locked_event_id THEN
    RAISE EXCEPTION 'whatsapp_delivery_not_found' USING ERRCODE = 'P0002';
  END IF;

  -- Un callback, un botón o una decisión administrativa pudieron completar el
  -- envío mientras este worker esperaba la respuesta síncrona de Meta.
  IF delivery.status IN ('sent', 'delivered', 'read')
     OR delivery.provider_message_id IS NOT NULL THEN
    RETURN QUERY SELECT delivery.status, delivery.provider_message_id;
    RETURN;
  END IF;

  -- Una generación obsoleta solo observa. No modifica una delivery recuperada
  -- o finalizada por otro worker.
  IF delivery.status <> 'queued'
     OR delivery.provider_payload->>'send_lease_token' IS DISTINCT FROM _lease_token::text
     OR delivery.provider_payload->>'meta_attempt_state' IS DISTINCT FROM 'contacting_meta' THEN
    RETURN QUERY SELECT delivery.status, delivery.provider_message_id;
    RETURN;
  END IF;

  UPDATE public.notification_deliveries row
  SET status = _result_status,
      provider_payload = COALESCE(delivery.provider_payload, '{}'::jsonb)
        || jsonb_build_object(
          'meta_attempt_state', 'completed_not_sent',
          'meta_attempt_completed_at', now()
        ),
      provider_response = COALESCE(delivery.provider_response, '{}'::jsonb)
        || jsonb_build_object('sync_send_response', COALESCE(_provider_response, '{}'::jsonb)),
      error_code = NULLIF(left(COALESCE(_error_code, ''), 255), ''),
      error_message = NULLIF(left(COALESCE(_error_message, ''), 1000), ''),
      failed_at = CASE WHEN _result_status = 'failed' THEN now() ELSE delivery.failed_at END
  WHERE row.id = _delivery_id
  RETURNING row.status, row.provider_message_id
  INTO effective_status, provider_message_id;

  RETURN NEXT;
END;
$$;

REVOKE ALL ON FUNCTION public.finalize_whatsapp_non_delivery_result(uuid, uuid, text, jsonb, text, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.finalize_whatsapp_non_delivery_result(uuid, uuid, text, jsonb, text, text)
  TO service_role;

CREATE OR REPLACE FUNCTION public.finalize_whatsapp_send_delivery(
  _delivery_id uuid,
  _lease_token uuid,
  _provider_message_id text,
  _provider_response jsonb,
  _sent_at timestamptz
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  delivery public.notification_deliveries%ROWTYPE;
  locked_event_id uuid;
BEGIN
  SELECT row.notification_event_id INTO locked_event_id
  FROM public.notification_deliveries row
  WHERE row.id = _delivery_id
    AND row.channel = 'whatsapp'
    AND row.provider = 'meta_cloud_api';

  IF locked_event_id IS NULL THEN
    RAISE EXCEPTION 'whatsapp_delivery_not_found' USING ERRCODE = 'P0002';
  END IF;

  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(locked_event_id::text, 20260720)
  );

  SELECT row.* INTO delivery
  FROM public.notification_deliveries row
  WHERE row.id = _delivery_id FOR UPDATE;
  IF NOT FOUND OR delivery.channel <> 'whatsapp' OR delivery.provider <> 'meta_cloud_api'
     OR delivery.notification_event_id <> locked_event_id THEN
    RAISE EXCEPTION 'whatsapp_delivery_not_found' USING ERRCODE = 'P0002';
  END IF;
  IF COALESCE(btrim(_provider_message_id), '') = '' THEN
    RAISE EXCEPTION 'provider_message_id_required' USING ERRCODE = '22023';
  END IF;
  IF delivery.provider_payload->>'send_lease_token' IS DISTINCT FROM _lease_token::text
     OR delivery.provider_payload->>'meta_attempt_state' IS DISTINCT FROM 'contacting_meta' THEN
    RAISE EXCEPTION 'stale_whatsapp_send_generation' USING ERRCODE = '22023';
  END IF;
  IF delivery.provider_message_id IS NOT NULL AND delivery.provider_message_id <> _provider_message_id THEN
    RAISE EXCEPTION 'provider_message_id_conflict' USING ERRCODE = '23505';
  END IF;

  UPDATE public.notification_deliveries row
  SET provider_message_id = _provider_message_id,
      status = CASE WHEN delivery.status = 'queued' THEN 'sent' ELSE delivery.status END,
      provider_response = COALESCE(delivery.provider_response, '{}'::jsonb)
        || jsonb_build_object('sync_send_response', COALESCE(_provider_response, '{}'::jsonb)),
      sent_at = COALESCE(delivery.sent_at, _sent_at),
      error_code = CASE WHEN delivery.status = 'queued' THEN NULL ELSE delivery.error_code END,
      error_message = CASE WHEN delivery.status = 'queued' THEN NULL ELSE delivery.error_message END
  WHERE row.id = _delivery_id
  RETURNING row.status INTO delivery.status;
  RETURN delivery.status;
END;
$$;

-- Un timeout local no puede degradar un estado que un callback o botón ya
-- haya conciliado mientras el POST a Meta seguía en curso.
CREATE OR REPLACE FUNCTION public.finalize_uncertain_whatsapp_send_delivery(
  _delivery_id uuid,
  _lease_token uuid,
  _provider_response jsonb,
  _error_message text
)
RETURNS TABLE (
  effective_status text,
  provider_message_id text,
  reconciliation_required boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  delivery public.notification_deliveries%ROWTYPE;
  locked_event_id uuid;
BEGIN
  SELECT row.notification_event_id INTO locked_event_id
  FROM public.notification_deliveries row
  WHERE row.id = _delivery_id
    AND row.channel = 'whatsapp'
    AND row.provider = 'meta_cloud_api';

  IF locked_event_id IS NULL THEN
    RAISE EXCEPTION 'whatsapp_delivery_not_found' USING ERRCODE = 'P0002';
  END IF;

  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(locked_event_id::text, 20260720)
  );

  SELECT row.* INTO delivery
  FROM public.notification_deliveries row
  WHERE row.id = _delivery_id FOR UPDATE;
  IF NOT FOUND OR delivery.channel <> 'whatsapp' OR delivery.provider <> 'meta_cloud_api'
     OR delivery.notification_event_id <> locked_event_id THEN
    RAISE EXCEPTION 'whatsapp_delivery_not_found' USING ERRCODE = 'P0002';
  END IF;

  IF delivery.provider_message_id IS NOT NULL OR delivery.status <> 'queued' THEN
    RETURN QUERY SELECT delivery.status, delivery.provider_message_id, false;
    RETURN;
  END IF;

  -- Una recuperación que no posee la generación original solo puede observar.
  -- No convierte un POST quizá todavía activo en evidencia de terminación.
  IF _lease_token IS NULL
     OR delivery.provider_payload->>'send_lease_token' IS DISTINCT FROM _lease_token::text
     OR delivery.provider_payload->>'meta_attempt_state' IS DISTINCT FROM 'contacting_meta' THEN
    RETURN QUERY SELECT delivery.status, delivery.provider_message_id, true;
    RETURN;
  END IF;

  UPDATE public.notification_deliveries row
  SET provider_payload = COALESCE(delivery.provider_payload, '{}'::jsonb)
        || jsonb_build_object('meta_attempt_state', 'completed_uncertain', 'meta_attempt_completed_at', now()),
      provider_response = COALESCE(delivery.provider_response, '{}'::jsonb)
        || jsonb_build_object('sync_send_response', COALESCE(_provider_response, '{}'::jsonb)),
      error_code = 'reconciliation_required',
      error_message = _error_message
  WHERE row.id = _delivery_id;

  RETURN QUERY SELECT 'queued'::text, NULL::text, true;
END;
$$;

-- Cierra el estado lógico usando el estado real de la delivery bajo bloqueo. De
-- este modo un callback aplicado durante el replay no puede ser sobrescrito por
-- una lectura obsoleta del worker y delivered/read se normalizan a event.sent.
CREATE OR REPLACE FUNCTION public.finalize_whatsapp_notification_event(
  _delivery_id uuid,
  _fallback_ok boolean,
  _fallback_error text,
  _send_error text
)
RETURNS TABLE (
  effective_delivery_status text,
  event_status text,
  send_ok boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  target public.notification_deliveries%ROWTYPE;
  locked_event_id uuid;
  resolved_event_status text;
  resolved_send_ok boolean;
  resolved_error text;
  successful_whatsapp boolean;
BEGIN
  SELECT delivery.notification_event_id INTO locked_event_id
  FROM public.notification_deliveries delivery
  WHERE delivery.id = _delivery_id
    AND delivery.channel = 'whatsapp'
    AND delivery.provider = 'meta_cloud_api';

  IF locked_event_id IS NULL THEN
    RAISE EXCEPTION 'whatsapp_delivery_not_found' USING ERRCODE = 'P0002';
  END IF;

  -- Todas las mutaciones que agregan deliveries hermanas usan primero esta
  -- misma exclusión por evento. Así no existe un orden delivery->evento capaz
  -- de interbloquear o calcular successful_whatsapp sobre una foto obsoleta.
  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(locked_event_id::text, 20260720)
  );

  SELECT delivery.* INTO target
  FROM public.notification_deliveries delivery
  WHERE delivery.id = _delivery_id
  FOR UPDATE;

  IF NOT FOUND OR target.channel <> 'whatsapp' OR target.provider <> 'meta_cloud_api'
     OR target.notification_event_id <> locked_event_id THEN
    RAISE EXCEPTION 'whatsapp_delivery_not_found' USING ERRCODE = 'P0002';
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public.notification_deliveries sibling
    WHERE sibling.notification_event_id = target.notification_event_id
      AND sibling.channel = 'whatsapp'
      AND sibling.provider = 'meta_cloud_api'
      AND sibling.status IN ('sent', 'delivered', 'read')
  ) INTO successful_whatsapp;

  resolved_send_ok := target.status IN ('sent', 'delivered', 'read') OR successful_whatsapp;
  resolved_event_status := CASE
    WHEN COALESCE(_fallback_ok, false) THEN 'sent'
    WHEN resolved_send_ok THEN 'sent'
    WHEN target.status IN ('failed', 'undeliverable', 'skipped') THEN 'failed'
    ELSE 'processing'
  END;
  resolved_error := CASE
    WHEN COALESCE(_fallback_ok, false) AND NOT resolved_send_ok
      THEN 'WhatsApp falló; correo de respaldo enviado: '
        || left(COALESCE(target.error_message, _send_error, 'error desconocido'), 900)
    WHEN resolved_send_ok THEN NULL
    ELSE left(COALESCE(_fallback_error, target.error_message, _send_error), 1000)
  END;

  UPDATE public.notification_events event
  SET status = CASE WHEN event.status = 'cancelled' THEN 'cancelled' ELSE resolved_event_status END,
      processed_at = now(),
      error_message = CASE WHEN event.status = 'cancelled' THEN event.error_message ELSE resolved_error END
  WHERE event.id = target.notification_event_id
  RETURNING event.status INTO resolved_event_status;

  RETURN QUERY SELECT target.status, resolved_event_status, resolved_send_ok;
END;
$$;

REVOKE ALL ON FUNCTION public.bind_whatsapp_delivery_from_status(text, text, timestamptz)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.finalize_whatsapp_send_delivery(uuid, uuid, text, jsonb, timestamptz)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.finalize_uncertain_whatsapp_send_delivery(uuid, uuid, jsonb, text)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.finalize_whatsapp_notification_event(uuid, boolean, text, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.bind_whatsapp_delivery_from_status(text, text, timestamptz)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.finalize_whatsapp_send_delivery(uuid, uuid, text, jsonb, timestamptz)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.finalize_uncertain_whatsapp_send_delivery(uuid, uuid, jsonb, text)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.finalize_whatsapp_notification_event(uuid, boolean, text, text)
  TO service_role;

CREATE OR REPLACE FUNCTION public.get_whatsapp_webhook_pending_count(_days integer DEFAULT 7)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT (
    public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager')
  ) THEN
    RAISE EXCEPTION 'not_authorized' USING ERRCODE = '42501';
  END IF;

  -- Un callback aún no correlacionado no tiene sede fiable. Solo administración
  -- puede ver el agregado global; los managers reciben cero.
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RETURN 0;
  END IF;

  RETURN (
    SELECT count(*)
    FROM public.whatsapp_webhook_inbox inbox
    WHERE inbox.processing_status IN ('pending', 'manual_review')
      AND inbox.received_at >= now() - make_interval(days => GREATEST(1, LEAST(_days, 31)))
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_whatsapp_webhook_pending_count(integer)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_whatsapp_webhook_pending_count(integer)
  TO authenticated;

-- Cola global saneada para que administración pueda distinguir un estado no
-- soportado de una correlación pendiente sin exponer teléfonos ni IDs completos.
CREATE OR REPLACE FUNCTION public.get_whatsapp_webhook_reconciliation_queue(
  _limit integer DEFAULT 50
)
RETURNS TABLE (
  callback_kind text,
  provider_message_ref text,
  sender_masked text,
  callback_state text,
  detail text,
  attempts integer,
  received_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT (
    public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager')
  ) THEN
    RAISE EXCEPTION 'not_authorized' USING ERRCODE = '42501';
  END IF;

  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    inbox.callback_kind,
    '…' || right(inbox.provider_message_id, 8),
    CASE WHEN inbox.sender IS NULL THEN '—'
      ELSE '•••• ' || right(regexp_replace(inbox.sender, '[^0-9]', '', 'g'), 4) END,
    inbox.processing_status,
    left(regexp_replace(
      COALESCE(inbox.outcome, inbox.last_error, 'Pendiente de correlación'),
      '\+?[0-9][0-9 ()-]{6,}', '[teléfono oculto]', 'g'
    ), 200),
    inbox.attempts,
    inbox.received_at
  FROM public.whatsapp_webhook_inbox inbox
  WHERE inbox.processing_status IN ('pending', 'manual_review')
  ORDER BY inbox.received_at
  LIMIT GREATEST(1, LEAST(_limit, 100));
END;
$$;

REVOKE ALL ON FUNCTION public.get_whatsapp_webhook_reconciliation_queue(integer)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_whatsapp_webhook_reconciliation_queue(integer)
  TO authenticated;

-- Mantiene coherentes las alertas, el badge y el filtro del monitor con los
-- intentos inciertos que no deben reenviarse automáticamente.
CREATE OR REPLACE FUNCTION public.get_whatsapp_delivery_monitor_stats(_days integer DEFAULT 7)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  result jsonb;
BEGIN
  IF auth.uid() IS NULL OR NOT (
    public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager')
  ) THEN
    RAISE EXCEPTION 'not_authorized' USING ERRCODE = '42501';
  END IF;

  SELECT jsonb_build_object(
    'sent', count(*) FILTER (WHERE delivery.status = 'sent'),
    'delivered', count(*) FILTER (WHERE delivery.status IN ('delivered', 'read')),
    'read', count(*) FILTER (WHERE delivery.status = 'read'),
    'failed', count(*) FILTER (WHERE delivery.status IN ('failed', 'undeliverable')),
    'skipped', count(*) FILTER (WHERE delivery.status = 'skipped'),
    'unconfirmed', count(*) FILTER (
      WHERE delivery.status = 'sent'
        AND COALESCE(delivery.sent_at, delivery.created_at) < now() - interval '30 minutes'
    ),
    'unresolved', count(*) FILTER (
      WHERE delivery.status IN ('failed', 'undeliverable', 'skipped')
         OR (
           delivery.status = 'sent'
           AND COALESCE(delivery.sent_at, delivery.created_at) < now() - interval '30 minutes'
         )
         OR (
           delivery.status = 'queued'
           AND delivery.error_code = 'reconciliation_required'
         )
    )
  ) INTO result
  FROM public.notification_deliveries delivery
  JOIN public.notification_events event ON event.id = delivery.notification_event_id
  JOIN public.tasks task ON task.id = event.task_id
  LEFT JOIN public.cleaners cleaner ON cleaner.id = event.cleaner_id
  WHERE delivery.channel = 'whatsapp'
    AND delivery.created_at >= now() - make_interval(days => GREATEST(1, LEAST(_days, 31)))
    AND (
      public.has_role(auth.uid(), 'admin')
      OR (
        event.sede_id IS NOT NULL
        AND task.sede_id = event.sede_id
        AND (event.cleaner_id IS NULL OR cleaner.sede_id = event.sede_id)
        AND public.user_has_sede_access(auth.uid(), event.sede_id)
      )
    );
  RETURN COALESCE(result, '{}'::jsonb);
END;
$$;

CREATE OR REPLACE FUNCTION public.get_whatsapp_delivery_monitor(
  _days integer DEFAULT 7,
  _status text DEFAULT 'all',
  _search text DEFAULT '',
  _limit integer DEFAULT 50,
  _offset integer DEFAULT 0
)
RETURNS TABLE (
  id uuid,
  notification_event_id uuid,
  provider_message_ref text,
  recipient_masked text,
  template_name text,
  status text,
  error_code text,
  error_detail text,
  sent_at timestamptz,
  delivered_at timestamptz,
  read_at timestamptz,
  failed_at timestamptz,
  created_at timestamptz,
  event_type text,
  cleaner_name text,
  property text,
  task_date date,
  total_count bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT (
    public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager')
  ) THEN
    RAISE EXCEPTION 'not_authorized' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT
    delivery.id,
    delivery.notification_event_id,
    CASE WHEN delivery.provider_message_id IS NULL THEN NULL
      ELSE '…' || right(delivery.provider_message_id, 8) END,
    CASE WHEN length(delivery.recipient) <= 4 THEN '••••'
      ELSE '•••• ' || right(delivery.recipient, 4) END,
    delivery.template_name,
    delivery.status,
    delivery.error_code,
    left(regexp_replace(COALESCE(delivery.error_message, ''), '\+?[0-9][0-9 ()-]{6,}', '[teléfono oculto]', 'g'), 300),
    delivery.sent_at,
    delivery.delivered_at,
    delivery.read_at,
    delivery.failed_at,
    delivery.created_at,
    event.event_type,
    cleaner.name,
    task.property,
    task.date,
    count(*) OVER ()
  FROM public.notification_deliveries delivery
  JOIN public.notification_events event ON event.id = delivery.notification_event_id
  LEFT JOIN public.cleaners cleaner ON cleaner.id = event.cleaner_id
  LEFT JOIN public.tasks task ON task.id = event.task_id
  WHERE delivery.channel = 'whatsapp'
    AND delivery.created_at >= now() - make_interval(days => GREATEST(1, LEAST(_days, 31)))
    AND (
      public.has_role(auth.uid(), 'admin')
      OR (
        event.sede_id IS NOT NULL
        AND task.sede_id = event.sede_id
        AND (event.cleaner_id IS NULL OR cleaner.sede_id = event.sede_id)
        AND public.user_has_sede_access(auth.uid(), event.sede_id)
      )
    )
    AND (
      _status = 'all'
      OR delivery.status = _status
      OR (_status = 'failed' AND delivery.status = 'undeliverable')
      OR (
        _status = 'attention'
        AND (
          delivery.status IN ('failed', 'undeliverable', 'skipped')
          OR (
            delivery.status = 'sent'
            AND COALESCE(delivery.sent_at, delivery.created_at) < now() - interval '30 minutes'
          )
          OR (
            delivery.status = 'queued'
            AND delivery.error_code = 'reconciliation_required'
          )
        )
      )
    )
    AND (
      btrim(_search) = ''
      OR cleaner.name ILIKE '%' || btrim(_search) || '%'
      OR task.property ILIKE '%' || btrim(_search) || '%'
      OR delivery.template_name ILIKE '%' || btrim(_search) || '%'
    )
  ORDER BY delivery.created_at DESC
  LIMIT GREATEST(1, LEAST(_limit, 100))
  OFFSET GREATEST(0, _offset);
END;
$$;

REVOKE ALL ON FUNCTION public.get_whatsapp_delivery_monitor_stats(integer) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_whatsapp_delivery_monitor(integer, text, text, integer, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_whatsapp_delivery_monitor_stats(integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_whatsapp_delivery_monitor(integer, text, text, integer, integer) TO authenticated;

DROP FUNCTION IF EXISTS public.apply_whatsapp_delivery_status(text, text, timestamptz, text);

CREATE OR REPLACE FUNCTION public.apply_whatsapp_delivery_status(
  _provider_message_id text,
  _status text,
  _occurred_at timestamptz,
  _error_message text DEFAULT NULL
)
RETURNS TABLE (
  delivery_id uuid,
  notification_event_id uuid,
  applied boolean,
  effective_status text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  target public.notification_deliveries%ROWTYPE;
  locked_event_id uuid;
  current_rank integer;
  incoming_rank integer;
  current_occurred_at timestamptz;
  successful_whatsapp boolean;
BEGIN
  IF _provider_message_id IS NULL OR btrim(_provider_message_id) = '' THEN
    RAISE EXCEPTION 'provider_message_id_required' USING ERRCODE = '22023';
  END IF;

  IF _status NOT IN ('sent', 'delivered', 'read', 'failed') THEN
    RAISE EXCEPTION 'unsupported_whatsapp_status' USING ERRCODE = '22023';
  END IF;

  SELECT delivery.notification_event_id INTO locked_event_id
  FROM public.notification_deliveries delivery
  WHERE delivery.channel = 'whatsapp'
    AND delivery.provider = 'meta_cloud_api'
    AND delivery.provider_message_id = _provider_message_id;

  IF locked_event_id IS NULL THEN
    RETURN;
  END IF;

  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(locked_event_id::text, 20260720)
  );

  SELECT delivery.* INTO target
  FROM public.notification_deliveries delivery
  WHERE delivery.channel = 'whatsapp'
    AND delivery.provider = 'meta_cloud_api'
    AND delivery.provider_message_id = _provider_message_id
  FOR UPDATE;

  IF NOT FOUND OR target.notification_event_id <> locked_event_id THEN
    -- Meta puede reenviar callbacks históricos o de números gestionados fuera
    -- de esta aplicación. No son un error transitorio de nuestra base.
    RETURN;
  END IF;

  -- Meta documenta failed como resultado terminal. No permitimos que una
  -- entrega que ya autorizó fallback vuelva a éxito y produzca dos canales.
  IF target.status = 'failed' AND _status <> 'failed' THEN
    RETURN QUERY SELECT target.id, target.notification_event_id, false, target.status;
    RETURN;
  END IF;

  current_rank := CASE target.status
    WHEN 'queued' THEN 0
    WHEN 'sent' THEN 1
    WHEN 'failed' THEN 2
    WHEN 'undeliverable' THEN 2
    WHEN 'delivered' THEN 3
    WHEN 'read' THEN 4
    ELSE 0
  END;
  incoming_rank := CASE _status
    WHEN 'sent' THEN 1
    WHEN 'failed' THEN 2
    WHEN 'delivered' THEN 3
    WHEN 'read' THEN 4
  END;

  IF COALESCE(target.provider_response->>'whatsapp_status_occurred_at', '')
      ~ '^\d{4}-\d{2}-\d{2}T' THEN
    current_occurred_at := (target.provider_response->>'whatsapp_status_occurred_at')::timestamptz;
  END IF;

  -- Los timestamps de Meta tienen resolución de segundos. A igualdad temporal,
  -- una transición de mayor rango (sent -> delivered -> read) todavía debe
  -- aplicarse; duplicados o estados de igual/menor rango se ignoran.
  IF (
       current_occurred_at IS NOT NULL
       AND (
         _occurred_at < current_occurred_at
         OR (_occurred_at = current_occurred_at AND incoming_rank <= current_rank)
       )
     )
     OR incoming_rank < current_rank THEN
    RETURN QUERY SELECT target.id, target.notification_event_id, false, target.status;
    RETURN;
  END IF;

  UPDATE public.notification_deliveries delivery
  SET
    status = _status,
    provider_response = COALESCE(delivery.provider_response, '{}'::jsonb)
      || jsonb_build_object(
        'whatsapp_status', _status,
        'whatsapp_status_occurred_at', _occurred_at
      ),
    sent_at = CASE WHEN _status = 'sent' THEN COALESCE(delivery.sent_at, _occurred_at) ELSE delivery.sent_at END,
    delivered_at = CASE WHEN _status = 'delivered' THEN COALESCE(delivery.delivered_at, _occurred_at) ELSE delivery.delivered_at END,
    read_at = CASE WHEN _status = 'read' THEN COALESCE(delivery.read_at, _occurred_at) ELSE delivery.read_at END,
    failed_at = CASE WHEN _status = 'failed' THEN COALESCE(delivery.failed_at, _occurred_at) ELSE delivery.failed_at END,
    error_code = CASE WHEN _status = 'failed' THEN 'meta_delivery_failed' ELSE NULL END,
    error_message = CASE WHEN _status = 'failed' THEN left(COALESCE(_error_message, 'Meta informó de un fallo'), 1000) ELSE NULL END
  WHERE delivery.id = target.id;

  SELECT EXISTS (
    SELECT 1
    FROM public.notification_deliveries sibling
    WHERE sibling.notification_event_id = target.notification_event_id
      AND sibling.channel = 'whatsapp'
      AND sibling.provider = 'meta_cloud_api'
      AND sibling.status IN ('sent', 'delivered', 'read')
  ) INTO successful_whatsapp;

  -- El evento lógico solo admite sent/failed, no delivered/read. Se actualiza en
  -- la misma transacción y bajo el mismo bloqueo para que un callback que compita
  -- con el worker no deje event y delivery en estados contradictorios.
  UPDATE public.notification_events event
  SET status = CASE
        WHEN event.status = 'cancelled' THEN 'cancelled'
        WHEN _status IN ('sent', 'delivered', 'read') THEN 'sent'
        WHEN successful_whatsapp THEN 'sent'
        WHEN EXISTS (
          SELECT 1 FROM public.notification_deliveries fallback
          WHERE fallback.notification_event_id = target.notification_event_id
            AND fallback.channel = 'email'
            AND fallback.template_name = 'task_rejected_admin_fallback_email'
            AND fallback.status = 'sent'
        ) THEN 'sent'
        ELSE 'failed'
      END,
      processed_at = now(),
      error_message = CASE
        WHEN event.status = 'cancelled'
          OR _status IN ('sent', 'delivered', 'read')
          OR successful_whatsapp THEN NULL
        WHEN EXISTS (
          SELECT 1 FROM public.notification_deliveries fallback
          WHERE fallback.notification_event_id = target.notification_event_id
            AND fallback.channel = 'email'
            AND fallback.template_name = 'task_rejected_admin_fallback_email'
            AND fallback.status = 'sent'
        ) THEN 'WhatsApp falló; correo de respaldo enviado'
        ELSE left(COALESCE(_error_message, 'Meta informó de un fallo'), 1000)
      END
  WHERE event.id = target.notification_event_id;

  RETURN QUERY SELECT target.id, target.notification_event_id, true, _status;
END;
$$;

REVOKE ALL ON FUNCTION public.apply_whatsapp_delivery_status(text, text, timestamptz, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.apply_whatsapp_delivery_status(text, text, timestamptz, text)
  TO service_role;

COMMENT ON FUNCTION public.apply_whatsapp_delivery_status(text, text, timestamptz, text) IS
  'Aplica estados WhatsApp bajo bloqueo de fila, ignorando duplicados y transiciones regresivas.';

-- Un botón contiene un payload único persistido antes del POST a Meta. Si la
-- respuesta HTTP se perdió, permite enlazar de forma inequívoca el ID del
-- proveedor sin adivinar por teléfono u horario.
CREATE OR REPLACE FUNCTION public.bind_whatsapp_delivery_from_button(
  _source_provider_message_id text,
  _sender text,
  _button_payload text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  candidate_ids uuid[];
  bound_id uuid;
  locked_event_id uuid;
  normalized_sender text;
BEGIN
  normalized_sender := regexp_replace(COALESCE(_sender, ''), '[^0-9]', '', 'g');
  IF COALESCE(btrim(_source_provider_message_id), '') = ''
     OR normalized_sender = ''
     OR COALESCE(btrim(_button_payload), '') = '' THEN
    RETURN NULL;
  END IF;

  SELECT array_agg(delivery.id ORDER BY delivery.created_at)
  INTO candidate_ids
  FROM public.notification_deliveries delivery
  WHERE delivery.channel = 'whatsapp'
    AND delivery.provider = 'meta_cloud_api'
    AND delivery.status = 'queued'
    AND delivery.provider_message_id IS NULL
    AND delivery.provider_payload->>'send_started_at' IS NOT NULL
    AND regexp_replace(delivery.recipient, '[^0-9]', '', 'g') = normalized_sender
    AND COALESCE(delivery.provider_payload->'buttonPayloads', '[]'::jsonb) ? _button_payload;

  IF cardinality(COALESCE(candidate_ids, '{}'::uuid[])) <> 1 THEN
    SELECT delivery.id INTO bound_id
    FROM public.notification_deliveries delivery
    WHERE delivery.channel = 'whatsapp'
      AND delivery.provider = 'meta_cloud_api'
      AND delivery.provider_message_id = _source_provider_message_id;
    RETURN bound_id;
  END IF;

  SELECT delivery.notification_event_id INTO locked_event_id
  FROM public.notification_deliveries delivery
  WHERE delivery.id = candidate_ids[1];

  IF locked_event_id IS NULL THEN
    RETURN NULL;
  END IF;

  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(locked_event_id::text, 20260720)
  );

  BEGIN
    UPDATE public.notification_deliveries delivery
    SET provider_message_id = _source_provider_message_id,
        status = 'sent',
        sent_at = COALESCE(delivery.sent_at, now()),
        error_code = NULL,
        error_message = NULL,
        provider_response = COALESCE(delivery.provider_response, '{}'::jsonb)
          || jsonb_build_object(
            'reconciled_from_button', true,
            'reconciliation_diagnostic', jsonb_build_object(
              'previous_error_code', delivery.error_code,
              'previous_error_message', delivery.error_message
            )
          )
    WHERE delivery.id = candidate_ids[1]
      AND delivery.provider_message_id IS NULL
      AND delivery.status = 'queued'
    RETURNING delivery.id INTO bound_id;
  EXCEPTION WHEN unique_violation THEN
    SELECT delivery.id INTO bound_id
    FROM public.notification_deliveries delivery
    WHERE delivery.channel = 'whatsapp'
      AND delivery.provider = 'meta_cloud_api'
      AND delivery.provider_message_id = _source_provider_message_id;
  END;

  IF bound_id IS NOT NULL THEN
    UPDATE public.notification_events event
    SET status = CASE WHEN event.status = 'cancelled' THEN 'cancelled' ELSE 'sent' END,
        processed_at = now(),
        error_message = CASE WHEN event.status = 'cancelled' THEN event.error_message ELSE NULL END
    FROM public.notification_deliveries delivery
    WHERE delivery.id = bound_id
      AND event.id = delivery.notification_event_id;
  END IF;

  RETURN bound_id;
END;
$$;

-- Reproduce estados que llegaron antes de persistir provider_message_id.
CREATE OR REPLACE FUNCTION public.replay_whatsapp_status_callbacks(
  _provider_message_id text
)
RETURNS TABLE (
  callback_id uuid,
  notification_event_id uuid,
  effective_status text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  pending public.whatsapp_webhook_inbox%ROWTYPE;
  transition record;
BEGIN
  FOR pending IN
    SELECT inbox.*
    FROM public.whatsapp_webhook_inbox inbox
    WHERE inbox.callback_kind = 'status'
      AND inbox.processing_status = 'pending'
      AND inbox.provider_message_id = _provider_message_id
    ORDER BY inbox.occurred_at, inbox.received_at
    FOR UPDATE
  LOOP
    SELECT * INTO transition
    FROM public.apply_whatsapp_delivery_status(
      pending.provider_message_id,
      pending.delivery_status,
      pending.occurred_at,
      pending.error_message
    );

    IF FOUND THEN
      UPDATE public.whatsapp_webhook_inbox inbox
      SET processing_status = CASE
            WHEN transition.effective_status = 'failed' THEN 'pending'
            ELSE 'processed'
          END,
          outcome = transition.effective_status,
          attempts = inbox.attempts + 1,
          processed_at = CASE
            WHEN transition.effective_status = 'failed' THEN NULL
            ELSE now()
          END,
          last_error = CASE
            WHEN transition.effective_status = 'failed' THEN 'awaiting_admin_fallback'
            ELSE NULL
          END
      WHERE inbox.id = pending.id;
      callback_id := pending.id;
      notification_event_id := transition.notification_event_id;
      effective_status := transition.effective_status;
      RETURN NEXT;
    END IF;
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION public.bind_whatsapp_delivery_from_button(text, text, text)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.replay_whatsapp_status_callbacks(text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.bind_whatsapp_delivery_from_button(text, text, text)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.replay_whatsapp_status_callbacks(text)
  TO service_role;

-- Aplica botones bajo bloqueo de la tarea. Valida la entrega de origen, el
-- payload/nonce, el remitente, la vigencia y la transición en una transacción.
DROP FUNCTION IF EXISTS public.apply_whatsapp_approval_response(text, text, text, text, uuid, timestamptz);
DROP FUNCTION IF EXISTS public.apply_whatsapp_approval_response(text, text, text, text, text, uuid, timestamptz);

CREATE FUNCTION public.apply_whatsapp_approval_response(
  _whatsapp_message_id text,
  _source_provider_message_id text,
  _sender text,
  _button_payload text,
  _action text,
  _task_id uuid,
  _occurred_at timestamptz
)
RETURNS TABLE (outcome text, rejection_event_id uuid)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  task_record public.tasks%ROWTYPE;
  source_delivery public.notification_deliveries%ROWTYPE;
  source_event public.notification_events%ROWTYPE;
  latest_decision_at timestamptz;
  alert_id uuid;
  alert_dedupe text;
  normalized_sender text;
  normalized_recipient text;
BEGIN
  IF _action NOT IN ('approve', 'reject', 'late_started', 'late_issue')
     OR COALESCE(_whatsapp_message_id, '') = ''
     OR COALESCE(_source_provider_message_id, '') = ''
     OR COALESCE(_sender, '') = ''
     OR COALESCE(_button_payload, '') = ''
     OR _occurred_at IS NULL THEN
    RETURN QUERY SELECT 'invalid'::text, NULL::uuid; RETURN;
  END IF;

  SELECT task.* INTO task_record FROM public.tasks task
  WHERE task.id = _task_id FOR UPDATE;
  IF NOT FOUND THEN RETURN QUERY SELECT 'invalid'::text, NULL::uuid; RETURN; END IF;

  SELECT delivery.* INTO source_delivery FROM public.notification_deliveries delivery
  WHERE delivery.channel = 'whatsapp'
    AND delivery.provider = 'meta_cloud_api'
    AND delivery.provider_message_id = _source_provider_message_id;
  IF NOT FOUND THEN
    RETURN QUERY SELECT 'source_not_found'::text, NULL::uuid; RETURN;
  END IF;
  IF source_delivery.status NOT IN ('sent', 'delivered', 'read')
     OR NOT (COALESCE(source_delivery.provider_payload->'buttonPayloads', '[]'::jsonb) ? _button_payload) THEN
    RETURN QUERY SELECT 'invalid'::text, NULL::uuid; RETURN;
  END IF;

  normalized_sender := regexp_replace(_sender, '[^0-9]', '', 'g');
  normalized_recipient := regexp_replace(source_delivery.recipient, '[^0-9]', '', 'g');
  IF normalized_sender = '' OR normalized_sender <> normalized_recipient THEN
    RETURN QUERY SELECT 'unauthorized_sender'::text, NULL::uuid; RETURN;
  END IF;

  SELECT event.* INTO source_event FROM public.notification_events event
  WHERE event.id = source_delivery.notification_event_id;
  IF NOT FOUND
     OR source_event.task_id <> _task_id
     OR (_action IN ('approve', 'reject') AND source_event.event_type NOT IN ('task_assigned', 'task_modified', 'task_approval_reminder'))
     OR (_action IN ('late_started', 'late_issue') AND source_event.event_type <> 'task_late_start_reminder') THEN
    RETURN QUERY SELECT 'invalid'::text, NULL::uuid; RETURN;
  END IF;

  -- task_assignments es la fuente canónica cuando existe. tasks.cleaner_id solo
  -- representa la primera trabajadora y se conserva como fallback para tareas
  -- antiguas que todavía no tienen filas en task_assignments.
  IF source_event.cleaner_id IS NULL OR NOT (
    EXISTS (
      SELECT 1
      FROM public.task_assignments assignment
      WHERE assignment.task_id = _task_id
        AND assignment.cleaner_id = source_event.cleaner_id
    )
    OR (
      NOT EXISTS (
        SELECT 1 FROM public.task_assignments assignment
        WHERE assignment.task_id = _task_id
      )
      AND source_event.cleaner_id = task_record.cleaner_id
    )
  ) THEN
    RETURN QUERY SELECT 'invalid'::text, NULL::uuid; RETURN;
  END IF;

  -- Un botón no puede permanecer operativo indefinidamente. Los recordatorios
  -- se emiten el mismo día y las asignaciones tienen un máximo de siete días.
  IF _occurred_at < source_event.created_at - interval '5 minutes'
     OR _occurred_at > source_event.created_at + interval '7 days' THEN
    RETURN QUERY SELECT 'expired'::text, NULL::uuid; RETURN;
  END IF;

  IF EXISTS (SELECT 1 FROM public.task_approval_events approval
             WHERE approval.whatsapp_message_id = _whatsapp_message_id) THEN
    RETURN QUERY SELECT 'duplicate'::text,
      (SELECT event.id FROM public.notification_events event
       WHERE event.dedupe_key = 'task_rejected_alert:' || _task_id::text || ':' || _whatsapp_message_id
       LIMIT 1);
    RETURN;
  END IF;

  -- La comparación usa el evento lógico, no la inserción tardía de delivery.
  IF _action IN ('approve', 'reject') AND EXISTS (
    SELECT 1 FROM public.notification_events newer
    WHERE newer.task_id = _task_id
      AND newer.cleaner_id IS NOT DISTINCT FROM source_event.cleaner_id
      AND newer.event_type IN ('task_assigned', 'task_modified', 'task_cancelled')
      AND newer.created_at > source_event.created_at
  ) THEN
    RETURN QUERY SELECT 'superseded'::text, NULL::uuid; RETURN;
  END IF;

  latest_decision_at := GREATEST(task_record.approved_at, task_record.rejected_at);
  IF latest_decision_at IS NOT NULL AND _occurred_at <= latest_decision_at THEN
    RETURN QUERY SELECT 'stale'::text, NULL::uuid; RETURN;
  END IF;

  IF _action IN ('approve', 'reject') THEN
    IF task_record.approval_status <> 'pending'
       OR task_record.status IN ('completed', 'cancelled') THEN
      RETURN QUERY SELECT 'not_actionable'::text, NULL::uuid; RETURN;
    END IF;

    UPDATE public.tasks SET
      approval_status = CASE WHEN _action = 'approve' THEN 'approved' ELSE 'rejected' END,
      approved_at = CASE WHEN _action = 'approve' THEN _occurred_at ELSE NULL END,
      rejected_at = CASE WHEN _action = 'reject' THEN _occurred_at ELSE NULL END,
      approval_response_source = 'whatsapp'
    WHERE id = _task_id;

    INSERT INTO public.task_approval_events (
      task_id, cleaner_id, action, source, whatsapp_message_id
    ) VALUES (
      _task_id, source_event.cleaner_id,
      CASE WHEN _action = 'approve' THEN 'approved' ELSE 'rejected' END,
      'whatsapp', _whatsapp_message_id
    );

    IF _action = 'reject' THEN
      alert_dedupe := 'task_rejected_alert:' || _task_id::text || ':' || _whatsapp_message_id;
      INSERT INTO public.notification_events (
        event_type, entity_type, entity_id, task_id, cleaner_id, sede_id, dedupe_key, payload
      ) VALUES (
        'task_rejected_alert', 'tasks', _task_id, _task_id, source_event.cleaner_id,
        source_event.sede_id, alert_dedupe,
        jsonb_build_object('source', 'whatsapp', 'whatsapp_message_id', _whatsapp_message_id)
      )
      ON CONFLICT (dedupe_key) DO UPDATE SET dedupe_key = EXCLUDED.dedupe_key
      RETURNING id INTO alert_id;
    END IF;
  ELSE
    IF task_record.status <> 'pending' THEN
      RETURN QUERY SELECT 'not_actionable'::text, NULL::uuid; RETURN;
    END IF;
    INSERT INTO public.task_approval_events (
      task_id, cleaner_id, action, source, whatsapp_message_id, reason
    ) VALUES (
      _task_id, source_event.cleaner_id, 'admin_override', 'whatsapp',
      _whatsapp_message_id, _action
    );
  END IF;

  RETURN QUERY SELECT 'applied'::text, alert_id;
END;
$$;

REVOKE ALL ON FUNCTION public.apply_whatsapp_approval_response(text, text, text, text, text, uuid, timestamptz)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.apply_whatsapp_approval_response(text, text, text, text, text, uuid, timestamptz)
  TO service_role;

-- Claim atómico del correo de respaldo administrativo. El índice parcial
-- existente garantiza una sola fila lógica por evento. Solo un fallo explícito
-- puede reclamarse de nuevo: queued puede significar que Resend aceptó el email
-- y el proceso cayó antes de persistir su ID, por lo que nunca se auto-reenvía.
CREATE UNIQUE INDEX IF NOT EXISTS idx_notification_deliveries_rejected_email_once
ON public.notification_deliveries (notification_event_id)
WHERE channel = 'email'
  AND template_name = 'task_rejected_admin_fallback_email';

DROP FUNCTION IF EXISTS public.claim_whatsapp_admin_fallback(uuid, text, text);

CREATE OR REPLACE FUNCTION public.claim_whatsapp_admin_fallback(
  _notification_event_id uuid,
  _recipient text,
  _trigger_error text
)
RETURNS TABLE (
  delivery_id uuid,
  claimed boolean,
  delivery_status text,
  provider_message_id text,
  error_message text,
  claim_token uuid
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  claimed_row public.notification_deliveries%ROWTYPE;
  existing public.notification_deliveries%ROWTYPE;
  new_claim_token uuid := pg_catalog.gen_random_uuid();
BEGIN
  IF _recipient IS NULL OR btrim(_recipient) = '' THEN
    RAISE EXCEPTION 'fallback_recipient_required' USING ERRCODE = '22023';
  END IF;

  -- Este es el punto linealizable de decisión: si una delivery WhatsApp hermana
  -- ya tuvo éxito, no se autoriza ningún efecto externo de Resend. Las RPC que
  -- aplican/finalizan WhatsApp usan exactamente la misma exclusión por evento.
  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(_notification_event_id::text, 20260720)
  );

  SELECT delivery.* INTO existing
  FROM public.notification_deliveries delivery
  WHERE delivery.notification_event_id = _notification_event_id
    AND delivery.channel = 'whatsapp'
    AND delivery.provider = 'meta_cloud_api'
    AND delivery.status IN ('sent', 'delivered', 'read')
  ORDER BY delivery.created_at DESC
  LIMIT 1;

  IF existing.id IS NOT NULL THEN
    RETURN QUERY SELECT NULL::uuid, false, 'whatsapp_succeeded'::text,
      existing.provider_message_id, NULL::text, NULL::uuid;
    RETURN;
  END IF;

  -- Un POST iniciado sin resultado conciliado significa que Meta pudo aceptar
  -- el mensaje. No autorizamos otro canal hasta conocer su resultado.
  IF EXISTS (
    SELECT 1
    FROM public.notification_deliveries delivery
    WHERE delivery.notification_event_id = _notification_event_id
      AND delivery.channel = 'whatsapp'
      AND delivery.provider = 'meta_cloud_api'
      AND delivery.status = 'queued'
      AND (
        delivery.provider_payload->>'send_started_at' IS NOT NULL
        OR delivery.error_code = 'reconciliation_required'
      )
  ) THEN
    RETURN QUERY SELECT NULL::uuid, false, 'whatsapp_in_flight'::text,
      NULL::text, 'WhatsApp pendiente de conciliación'::text, NULL::uuid;
    RETURN;
  END IF;

  INSERT INTO public.notification_deliveries (
    notification_event_id,
    channel,
    provider,
    recipient,
    template_name,
    status,
    provider_payload,
    provider_response
  ) VALUES (
    _notification_event_id,
    'email',
    'resend',
    _recipient,
    'task_rejected_admin_fallback_email',
    'queued',
    jsonb_build_object('triggerError', _trigger_error),
    jsonb_build_object(
      'fallback_claimed_at', now(),
      'fallback_attempt_count', 1,
      'fallback_claim_token', new_claim_token,
      'fallback_attempt_state', 'claimed'
    )
  )
  ON CONFLICT (notification_event_id)
    WHERE channel = 'email'
      AND template_name = 'task_rejected_admin_fallback_email'
  DO UPDATE SET
    status = 'queued',
    recipient = EXCLUDED.recipient,
    provider_payload = EXCLUDED.provider_payload,
    provider_response = COALESCE(public.notification_deliveries.provider_response, '{}'::jsonb)
      || jsonb_build_object(
        'fallback_claimed_at', now(),
        'fallback_attempt_count',
          COALESCE((public.notification_deliveries.provider_response->>'fallback_attempt_count')::integer, 0) + 1,
        'fallback_claim_token', new_claim_token,
        'fallback_attempt_state', 'claimed'
      ),
    provider_message_id = NULL,
    error_code = NULL,
    error_message = NULL,
    sent_at = NULL,
    failed_at = NULL
  WHERE (
      public.notification_deliveries.status = 'failed'
      AND (
        NOT (COALESCE(public.notification_deliveries.provider_response, '{}'::jsonb) ? 'fallback_send_started_at')
        OR (public.notification_deliveries.provider_response->>'fallback_send_started_at')::timestamptz
          > now() - interval '23 hours'
      )
    )
     OR (
       public.notification_deliveries.status = 'queued'
       AND public.notification_deliveries.provider_message_id IS NULL
       AND (public.notification_deliveries.provider_response->>'fallback_claimed_at')::timestamptz
         < now() - interval '10 minutes'
       AND (
         NOT (COALESCE(public.notification_deliveries.provider_response, '{}'::jsonb) ? 'fallback_send_started_at')
         OR (
           (public.notification_deliveries.provider_response->>'fallback_send_started_at')::timestamptz
             > now() - interval '23 hours'
           AND public.notification_deliveries.provider_response->>'fallback_attempt_state'
             IN ('contacting_resend', 'reconciliation_required')
         )
       )
     )
  RETURNING public.notification_deliveries.* INTO claimed_row;

  IF claimed_row.id IS NOT NULL THEN
    RETURN QUERY SELECT claimed_row.id, true, claimed_row.status,
      claimed_row.provider_message_id, claimed_row.error_message,
      (claimed_row.provider_response->>'fallback_claim_token')::uuid;
    RETURN;
  END IF;

  SELECT delivery.* INTO existing
  FROM public.notification_deliveries delivery
  WHERE delivery.notification_event_id = _notification_event_id
    AND delivery.channel = 'email'
    AND delivery.template_name = 'task_rejected_admin_fallback_email';

  RETURN QUERY SELECT existing.id, false, existing.status,
    existing.provider_message_id, existing.error_message, NULL::uuid;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_whatsapp_admin_fallback(uuid, text, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_whatsapp_admin_fallback(uuid, text, text)
  TO service_role;

CREATE OR REPLACE FUNCTION public.begin_whatsapp_admin_fallback_send(
  _delivery_id uuid,
  _notification_event_id uuid,
  _claim_token uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  fallback public.notification_deliveries%ROWTYPE;
BEGIN
  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(_notification_event_id::text, 20260720)
  );

  SELECT * INTO fallback FROM public.notification_deliveries
  WHERE id = _delivery_id
    AND notification_event_id = _notification_event_id
  FOR UPDATE;

  IF fallback.id IS NULL
     OR fallback.channel <> 'email'
     OR fallback.provider <> 'resend'
     OR fallback.template_name <> 'task_rejected_admin_fallback_email'
     OR fallback.status <> 'queued'
     OR fallback.provider_message_id IS NOT NULL
     OR (fallback.provider_response->>'fallback_claim_token')::uuid IS DISTINCT FROM _claim_token THEN
    RETURN false;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.notification_deliveries whatsapp
    WHERE whatsapp.notification_event_id = _notification_event_id
      AND whatsapp.channel = 'whatsapp'
      AND whatsapp.provider = 'meta_cloud_api'
      AND whatsapp.status IN ('queued', 'sent', 'delivered', 'read')
      AND (
        whatsapp.status <> 'queued'
        OR whatsapp.provider_payload->>'send_started_at' IS NOT NULL
        OR whatsapp.error_code = 'reconciliation_required'
      )
  ) THEN
    RETURN false;
  END IF;

  UPDATE public.notification_deliveries
  SET provider_response = COALESCE(provider_response, '{}'::jsonb)
      || jsonb_build_object(
        'fallback_send_started_at', COALESCE(
          provider_response->'fallback_send_started_at',
          to_jsonb(now())
        ),
        'fallback_attempt_state', 'contacting_resend'
      ),
      error_code = NULL,
      error_message = NULL
  WHERE id = _delivery_id;

  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.begin_whatsapp_admin_fallback_send(uuid, uuid, uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.begin_whatsapp_admin_fallback_send(uuid, uuid, uuid)
  TO service_role;

CREATE OR REPLACE FUNCTION public.finalize_whatsapp_admin_fallback_send(
  _delivery_id uuid,
  _notification_event_id uuid,
  _claim_token uuid,
  _provider_message_id text,
  _uncertain boolean,
  _error_message text
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  fallback public.notification_deliveries%ROWTYPE;
  result_status text;
BEGIN
  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(_notification_event_id::text, 20260720)
  );

  SELECT * INTO fallback FROM public.notification_deliveries
  WHERE id = _delivery_id
    AND notification_event_id = _notification_event_id
  FOR UPDATE;

  IF fallback.id IS NULL
     OR fallback.channel <> 'email'
     OR fallback.provider <> 'resend'
     OR fallback.template_name <> 'task_rejected_admin_fallback_email' THEN
    RAISE EXCEPTION 'fallback_delivery_not_found' USING ERRCODE = 'P0002';
  END IF;

  IF fallback.status = 'sent' THEN
    RETURN 'sent';
  END IF;
  IF (fallback.provider_response->>'fallback_claim_token')::uuid IS DISTINCT FROM _claim_token THEN
    RETURN fallback.status;
  END IF;

  result_status := CASE
    WHEN COALESCE(btrim(_provider_message_id), '') <> '' THEN 'sent'
    WHEN _uncertain THEN 'queued'
    ELSE 'failed'
  END;

  UPDATE public.notification_deliveries
  SET status = result_status,
      provider_message_id = CASE WHEN result_status = 'sent' THEN _provider_message_id ELSE NULL END,
      provider_response = COALESCE(provider_response, '{}'::jsonb)
        || jsonb_build_object(
          'fallback_attempt_state', CASE
            WHEN result_status = 'sent' THEN 'sent'
            WHEN _uncertain THEN 'reconciliation_required'
            ELSE 'provider_rejected'
          END
        ),
      error_code = CASE
        WHEN result_status = 'sent' THEN NULL
        WHEN _uncertain THEN 'reconciliation_required'
        ELSE 'resend_error'
      END,
      error_message = CASE WHEN result_status = 'sent' THEN NULL ELSE left(_error_message, 1000) END,
      sent_at = CASE WHEN result_status = 'sent' THEN now() ELSE NULL END,
      failed_at = CASE WHEN result_status = 'failed' THEN now() ELSE NULL END
  WHERE id = _delivery_id;

  RETURN result_status;
END;
$$;

REVOKE ALL ON FUNCTION public.finalize_whatsapp_admin_fallback_send(uuid, uuid, uuid, text, boolean, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.finalize_whatsapp_admin_fallback_send(uuid, uuid, uuid, text, boolean, text)
  TO service_role;

COMMENT ON FUNCTION public.claim_whatsapp_admin_fallback(uuid, text, text) IS
  'Reclama de forma atómica el email de respaldo de un rechazo WhatsApp y permite reintentos seguros.';
