-- Política operativa explícita: priorizar entrega frente a duplicación excepcional.
-- Meta Cloud API no ofrece idempotencia ni consulta por clave propia. Permitimos
-- como máximo un segundo POST, solo tras 15 minutos sin evidencia de entrega.
-- El fallback email continúa bloqueado mientras exista cualquier intento Meta.

CREATE OR REPLACE FUNCTION public.get_bounded_whatsapp_retry_event_ids(
  _limit integer DEFAULT 50
)
RETURNS TABLE (event_id uuid)
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT event.id
  FROM public.notification_events event
  JOIN public.notification_deliveries delivery
    ON delivery.notification_event_id = event.id
   AND delivery.channel = 'whatsapp'
   AND delivery.provider = 'meta_cloud_api'
  WHERE delivery.status = 'queued'
    AND delivery.provider_message_id IS NULL
    AND COALESCE((delivery.provider_payload->>'meta_attempt_count')::integer, 1) = 1
    AND (
      (
        delivery.error_code = 'reconciliation_required'
        AND delivery.provider_payload->>'meta_attempt_state'
          IN ('contacting_meta', 'completed_uncertain')
        AND (delivery.provider_payload->>'send_started_at')::timestamptz
          <= now() - interval '15 minutes'
        AND (
          event.status = 'failed'
          OR (
            event.status = 'processing'
            AND event.processed_at < now() - interval '15 minutes'
          )
        )
      )
      OR (
        delivery.error_code = 'bounded_retry_authorized'
        AND delivery.provider_payload->>'meta_attempt_state' = 'retry_authorized'
        AND delivery.provider_payload->>'retry_risk_policy' = 'prioritize_delivery'
        AND event.status = 'processing'
        AND event.processed_at < now() - interval '10 minutes'
      )
    )
    AND NOT EXISTS (
      SELECT 1
      FROM public.notification_deliveries fallback
      WHERE fallback.notification_event_id = event.id
        AND fallback.channel = 'email'
        AND fallback.template_name = 'task_rejected_admin_fallback_email'
    )
  ORDER BY delivery.created_at
  LIMIT GREATEST(1, LEAST(_limit, 100));
$$;

REVOKE ALL ON FUNCTION public.get_bounded_whatsapp_retry_event_ids(integer)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_bounded_whatsapp_retry_event_ids(integer)
  TO service_role;

CREATE OR REPLACE FUNCTION public.claim_bounded_whatsapp_retry(
  _event_id uuid,
  _lease_token uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  event_row public.notification_events%ROWTYPE;
  delivery public.notification_deliveries%ROWTYPE;
  recovering_authorized boolean := false;
BEGIN
  IF _lease_token IS NULL THEN
    RAISE EXCEPTION 'whatsapp_retry_lease_required' USING ERRCODE = '22023';
  END IF;

  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(_event_id::text, 20260720)
  );

  SELECT * INTO event_row
  FROM public.notification_events
  WHERE id = _event_id
  FOR UPDATE;

  IF event_row.id IS NULL
     OR NOT (
       event_row.status = 'failed'
       OR (
         event_row.status = 'processing'
         AND event_row.processed_at < now() - interval '10 minutes'
       )
     ) THEN
    RETURN NULL;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.notification_deliveries fallback
    WHERE fallback.notification_event_id = _event_id
      AND fallback.channel = 'email'
      AND fallback.template_name = 'task_rejected_admin_fallback_email'
  ) THEN
    RETURN NULL;
  END IF;

  SELECT * INTO delivery
  FROM public.notification_deliveries row
  WHERE row.notification_event_id = _event_id
    AND row.channel = 'whatsapp'
    AND row.provider = 'meta_cloud_api'
    AND row.status = 'queued'
  ORDER BY row.created_at DESC
  LIMIT 1
  FOR UPDATE;

  recovering_authorized := delivery.error_code = 'bounded_retry_authorized'
    AND delivery.provider_payload->>'meta_attempt_state' = 'retry_authorized'
    AND delivery.provider_payload->>'retry_risk_policy' = 'prioritize_delivery'
    AND event_row.status = 'processing'
    AND event_row.processed_at < now() - interval '10 minutes';

  IF delivery.id IS NULL
     OR delivery.provider_message_id IS NOT NULL
     OR COALESCE((delivery.provider_payload->>'meta_attempt_count')::integer, 1) <> 1
     OR NOT (
       recovering_authorized
       OR (
         delivery.error_code = 'reconciliation_required'
         AND delivery.provider_payload->>'meta_attempt_state'
           IN ('contacting_meta', 'completed_uncertain')
         AND (delivery.provider_payload->>'send_started_at')::timestamptz
           <= now() - interval '15 minutes'
       )
     ) THEN
    RETURN NULL;
  END IF;

  UPDATE public.notification_events
  SET status = 'processing',
      processed_at = now(),
      processing_lease_token = _lease_token,
      error_message = CASE WHEN recovering_authorized
        THEN 'Reintento WhatsApp 2/2 recuperado tras expirar el worker anterior'
        ELSE 'Reintento WhatsApp 2/2 autorizado: política priorizar entrega' END
  WHERE id = _event_id;

  UPDATE public.notification_deliveries
  SET provider_payload = COALESCE(delivery.provider_payload, '{}'::jsonb)
        || jsonb_strip_nulls(jsonb_build_object(
          'meta_attempt_state', 'retry_authorized',
          'retry_authorized_at', COALESCE(
            delivery.provider_payload->'retry_authorized_at',
            to_jsonb(now())
          ),
          'retry_recovered_at', CASE WHEN recovering_authorized THEN to_jsonb(now()) ELSE NULL END,
          'retry_risk_policy', 'prioritize_delivery'
        )),
      error_code = 'bounded_retry_authorized',
      error_message = CASE WHEN recovering_authorized
        THEN 'Reintento WhatsApp 2/2 recuperado; existe riesgo excepcional de duplicado'
        ELSE 'Reintento WhatsApp 2/2 autorizado; existe riesgo excepcional de duplicado' END
  WHERE id = delivery.id;

  RETURN delivery.id;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_bounded_whatsapp_retry(uuid, uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_bounded_whatsapp_retry(uuid, uuid)
  TO service_role;

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

  SELECT * INTO fallback
  FROM public.notification_deliveries fallback_row
  WHERE fallback_row.notification_event_id = _event_id
    AND fallback_row.channel = 'email'
    AND fallback_row.template_name = 'task_rejected_admin_fallback_email'
  FOR UPDATE;
  IF fallback.id IS NOT NULL THEN
    UPDATE public.notification_events
    SET status = CASE WHEN fallback.status = 'sent' THEN 'sent' ELSE 'failed' END,
        processed_at = now(), processing_lease_token = NULL,
        error_message = CASE WHEN fallback.status = 'sent'
          THEN 'WhatsApp falló; correo de respaldo enviado'
          ELSE COALESCE(fallback.error_message, 'Fallback email reclamado o pendiente de conciliación') END
    WHERE id = _event_id;
    RETURN QUERY SELECT NULL::uuid, false,
      CASE WHEN fallback.status = 'sent' THEN 'fallback_sent' ELSE 'fallback_committed' END,
      fallback.provider_message_id, fallback.status = 'queued';
    RETURN;
  END IF;

  SELECT * INTO delivery
  FROM public.notification_deliveries row
  WHERE row.notification_event_id = _event_id
    AND row.channel = 'whatsapp'
    AND row.provider = 'meta_cloud_api'
    AND row.status IN ('queued', 'sent', 'delivered', 'read')
  ORDER BY row.created_at DESC
  LIMIT 1
  FOR UPDATE;

  IF delivery.id IS NOT NULL THEN
    IF delivery.status IN ('sent', 'delivered', 'read') THEN
      RETURN QUERY SELECT delivery.id, false, delivery.status,
        delivery.provider_message_id, false;
      RETURN;
    END IF;

    IF delivery.provider_payload->>'meta_attempt_state' = 'retry_authorized'
       AND COALESCE((delivery.provider_payload->>'meta_attempt_count')::integer, 1) = 1 THEN
      UPDATE public.notification_deliveries
      SET recipient = _recipient,
          template_name = _template_name,
          provider_payload = COALESCE(delivery.provider_payload, '{}'::jsonb)
            || (COALESCE(_provider_payload, '{}'::jsonb) - 'buttonPayloads')
            || CASE
              WHEN COALESCE(delivery.provider_payload, '{}'::jsonb) ? 'buttonPayloads'
                THEN jsonb_build_object('buttonPayloads', delivery.provider_payload->'buttonPayloads')
              WHEN COALESCE(_provider_payload, '{}'::jsonb) ? 'buttonPayloads'
                THEN jsonb_build_object('buttonPayloads', _provider_payload->'buttonPayloads')
              ELSE '{}'::jsonb
            END
      WHERE id = delivery.id;
      RETURN QUERY SELECT delivery.id, true, 'retry_authorized'::text, NULL::text, false;
      RETURN;
    END IF;

    IF delivery.provider_message_id IS NOT NULL
       OR COALESCE(delivery.provider_payload, '{}'::jsonb) ? 'send_started_at' THEN
      RETURN QUERY SELECT delivery.id, false, delivery.status,
        delivery.provider_message_id, true;
      RETURN;
    END IF;

    UPDATE public.notification_deliveries
    SET recipient = _recipient, template_name = _template_name,
        provider_payload = COALESCE(_provider_payload, '{}'::jsonb),
        error_code = NULL, error_message = NULL
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
  ) RETURNING * INTO delivery;

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
  attempt_count integer;
BEGIN
  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(_event_id::text, 20260720)
  );
  SELECT * INTO event_row FROM public.notification_events
  WHERE id = _event_id FOR UPDATE;
  IF event_row.id IS NULL OR event_row.status <> 'processing'
     OR event_row.processing_lease_token IS DISTINCT FROM _lease_token THEN
    RETURN false;
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.notification_deliveries fallback
    WHERE fallback.notification_event_id = _event_id
      AND fallback.channel = 'email'
      AND fallback.template_name = 'task_rejected_admin_fallback_email'
  ) THEN RETURN false; END IF;

  SELECT * INTO delivery FROM public.notification_deliveries
  WHERE id = _delivery_id AND notification_event_id = _event_id FOR UPDATE;
  IF delivery.id IS NULL OR delivery.channel <> 'whatsapp'
     OR delivery.provider <> 'meta_cloud_api' OR delivery.status <> 'queued'
     OR delivery.provider_message_id IS NOT NULL THEN
    RETURN false;
  END IF;

  attempt_count := COALESCE((delivery.provider_payload->>'meta_attempt_count')::integer, 0);
  IF NOT (
    (NOT (COALESCE(delivery.provider_payload, '{}'::jsonb) ? 'send_started_at') AND attempt_count = 0)
    OR (
      delivery.provider_payload->>'meta_attempt_state' = 'retry_authorized'
      AND attempt_count = 1
    )
  ) THEN RETURN false; END IF;

  UPDATE public.notification_deliveries
  SET provider_payload = COALESCE(delivery.provider_payload, '{}'::jsonb)
    || (COALESCE(_provider_payload, '{}'::jsonb) - 'buttonPayloads')
    || CASE
      WHEN COALESCE(delivery.provider_payload, '{}'::jsonb) ? 'buttonPayloads'
        THEN jsonb_build_object('buttonPayloads', delivery.provider_payload->'buttonPayloads')
      WHEN COALESCE(_provider_payload, '{}'::jsonb) ? 'buttonPayloads'
        THEN jsonb_build_object('buttonPayloads', _provider_payload->'buttonPayloads')
      ELSE '{}'::jsonb
    END
    || jsonb_build_object(
      'first_send_started_at', COALESCE(
        delivery.provider_payload->'first_send_started_at',
        delivery.provider_payload->'send_started_at',
        to_jsonb(now())
      ),
      'send_started_at', now(),
      'meta_attempt_count', LEAST(attempt_count + 1, 2),
      'meta_attempt_state', 'contacting_meta',
      'send_lease_token', _lease_token,
      'retry_risk_policy', CASE WHEN attempt_count = 1
        THEN 'prioritize_delivery'
        ELSE COALESCE(delivery.provider_payload->>'retry_risk_policy', 'none') END
    ),
    error_code = NULL,
    error_message = CASE WHEN attempt_count = 1
      THEN 'Ejecutando reintento WhatsApp 2/2; riesgo excepcional de duplicado aceptado'
      ELSE NULL END
  WHERE id = _delivery_id;
  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.begin_whatsapp_send_delivery(uuid, uuid, uuid, jsonb)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.begin_whatsapp_send_delivery(uuid, uuid, uuid, jsonb)
  TO service_role;

-- Cierra resultados inciertos del intento 2/2 de forma terminal para el evento,
-- manteniendo la delivery queued/reconciliation_required para revisión manual.
-- También recupera un worker caído después de begin cuando su lease ya expiró.
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
  event_row public.notification_events%ROWTYPE;
  locked_event_id uuid;
  attempt_count integer;
  owns_generation boolean;
  stale_exhausted_attempt boolean;
  terminal_message text;
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
  SELECT * INTO event_row FROM public.notification_events
  WHERE id = locked_event_id FOR UPDATE;
  SELECT row.* INTO delivery FROM public.notification_deliveries row
  WHERE row.id = _delivery_id FOR UPDATE;

  IF delivery.id IS NULL OR delivery.channel <> 'whatsapp'
     OR delivery.provider <> 'meta_cloud_api'
     OR delivery.notification_event_id <> locked_event_id THEN
    RAISE EXCEPTION 'whatsapp_delivery_not_found' USING ERRCODE = 'P0002';
  END IF;
  IF delivery.provider_message_id IS NOT NULL OR delivery.status <> 'queued' THEN
    RETURN QUERY SELECT delivery.status, delivery.provider_message_id, false;
    RETURN;
  END IF;

  attempt_count := COALESCE((delivery.provider_payload->>'meta_attempt_count')::integer, 1);
  owns_generation := _lease_token IS NOT NULL
    AND delivery.provider_payload->>'send_lease_token' = _lease_token::text
    AND delivery.provider_payload->>'meta_attempt_state' = 'contacting_meta';
  stale_exhausted_attempt := attempt_count >= 2
    AND delivery.provider_payload->>'meta_attempt_state' = 'contacting_meta'
    AND event_row.status = 'processing'
    AND event_row.processed_at < now() - interval '10 minutes';

  IF NOT owns_generation AND NOT stale_exhausted_attempt THEN
    RETURN QUERY SELECT delivery.status, delivery.provider_message_id, true;
    RETURN;
  END IF;

  terminal_message := CASE WHEN attempt_count >= 2
    THEN 'Intento WhatsApp 2/2 incierto; reintentos automáticos agotados. Requiere conciliación manual'
    ELSE _error_message END;

  UPDATE public.notification_deliveries row
  SET provider_payload = COALESCE(delivery.provider_payload, '{}'::jsonb)
        || jsonb_build_object(
          'meta_attempt_state', 'completed_uncertain',
          'meta_attempt_completed_at', now(),
          'retry_exhausted', attempt_count >= 2
        ),
      provider_response = COALESCE(delivery.provider_response, '{}'::jsonb)
        || jsonb_build_object('sync_send_response', COALESCE(_provider_response, '{}'::jsonb)),
      error_code = 'reconciliation_required',
      error_message = terminal_message
  WHERE row.id = _delivery_id;

  IF attempt_count >= 2 THEN
    UPDATE public.notification_events event
    SET status = CASE WHEN event.status = 'cancelled' THEN 'cancelled' ELSE 'failed' END,
        processed_at = now(),
        processing_lease_token = NULL,
        error_message = CASE WHEN event.status = 'cancelled'
          THEN event.error_message ELSE terminal_message END
    WHERE event.id = locked_event_id;
  END IF;

  RETURN QUERY SELECT 'queued'::text, NULL::text, true;
END;
$$;

-- El finalizador agregado reconoce una delivery de conciliación con 2/2 agotado
-- como evento terminal, sin cambiar la delivery a failed ni habilitar fallback.
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
  exhausted_retry boolean;
BEGIN
  SELECT delivery.notification_event_id INTO locked_event_id
  FROM public.notification_deliveries delivery
  WHERE delivery.id = _delivery_id
    AND delivery.channel = 'whatsapp'
    AND delivery.provider = 'meta_cloud_api';
  IF locked_event_id IS NULL THEN
    RAISE EXCEPTION 'whatsapp_delivery_not_found' USING ERRCODE = 'P0002';
  END IF;

  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(locked_event_id::text, 20260720)
  );
  SELECT delivery.* INTO target FROM public.notification_deliveries delivery
  WHERE delivery.id = _delivery_id FOR UPDATE;
  IF NOT FOUND OR target.channel <> 'whatsapp' OR target.provider <> 'meta_cloud_api'
     OR target.notification_event_id <> locked_event_id THEN
    RAISE EXCEPTION 'whatsapp_delivery_not_found' USING ERRCODE = 'P0002';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.notification_deliveries sibling
    WHERE sibling.notification_event_id = target.notification_event_id
      AND sibling.channel = 'whatsapp'
      AND sibling.provider = 'meta_cloud_api'
      AND sibling.status IN ('sent', 'delivered', 'read')
  ) INTO successful_whatsapp;

  exhausted_retry := target.status = 'queued'
    AND target.error_code = 'reconciliation_required'
    AND COALESCE((target.provider_payload->>'meta_attempt_count')::integer, 0) >= 2;
  resolved_send_ok := target.status IN ('sent', 'delivered', 'read') OR successful_whatsapp;
  resolved_event_status := CASE
    WHEN COALESCE(_fallback_ok, false) THEN 'sent'
    WHEN resolved_send_ok THEN 'sent'
    WHEN exhausted_retry THEN 'failed'
    WHEN target.status IN ('failed', 'undeliverable', 'skipped') THEN 'failed'
    ELSE 'processing'
  END;
  resolved_error := CASE
    WHEN COALESCE(_fallback_ok, false) AND NOT resolved_send_ok
      THEN 'WhatsApp falló; correo de respaldo enviado: '
        || left(COALESCE(target.error_message, _send_error, 'error desconocido'), 900)
    WHEN resolved_send_ok THEN NULL
    WHEN exhausted_retry
      THEN left(COALESCE(target.error_message,
        'Intento WhatsApp 2/2 incierto; reintentos automáticos agotados'), 1000)
    ELSE left(COALESCE(_fallback_error, target.error_message, _send_error), 1000)
  END;

  UPDATE public.notification_events event
  SET status = CASE WHEN event.status = 'cancelled' THEN 'cancelled' ELSE resolved_event_status END,
      processed_at = now(),
      processing_lease_token = CASE
        WHEN event.status = 'cancelled' OR resolved_event_status IN ('sent', 'failed')
          THEN NULL ELSE event.processing_lease_token END,
      error_message = CASE WHEN event.status = 'cancelled' THEN event.error_message ELSE resolved_error END
  WHERE event.id = target.notification_event_id
  RETURNING event.status INTO resolved_event_status;

  RETURN QUERY SELECT target.status, resolved_event_status, resolved_send_ok;
END;
$$;

REVOKE ALL ON FUNCTION public.finalize_uncertain_whatsapp_send_delivery(uuid, uuid, jsonb, text)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.finalize_whatsapp_notification_event(uuid, boolean, text, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.finalize_uncertain_whatsapp_send_delivery(uuid, uuid, jsonb, text)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.finalize_whatsapp_notification_event(uuid, boolean, text, text)
  TO service_role;
