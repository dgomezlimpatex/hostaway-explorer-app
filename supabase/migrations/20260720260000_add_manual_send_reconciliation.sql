-- Resolución operativa de envíos cuyo proveedor pudo o no haber sido contactado.
-- No intenta resolver automáticamente una ventana imposible de distinguir sin
-- idempotencia/consulta del proveedor: exige comprobación humana y deja auditoría.

CREATE TABLE public.notification_send_reconciliation_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  delivery_id uuid NOT NULL REFERENCES public.notification_deliveries(id) ON DELETE CASCADE,
  notification_event_id uuid NOT NULL REFERENCES public.notification_events(id) ON DELETE CASCADE,
  channel text NOT NULL CHECK (channel IN ('whatsapp', 'email')),
  resolution text NOT NULL CHECK (resolution IN ('confirmed_sent', 'confirmed_not_sent')),
  provider_message_id text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'effect_pending', 'completed', 'failed')),
  requested_by uuid NOT NULL DEFAULT auth.uid(),
  requested_at timestamptz NOT NULL DEFAULT now(),
  processing_started_at timestamptz,
  claim_token uuid,
  effect_started_at timestamptz,
  fallback_whatsapp_delivery_id uuid REFERENCES public.notification_deliveries(id) ON DELETE SET NULL,
  completed_at timestamptz,
  attempts integer NOT NULL DEFAULT 0,
  result_detail text
);

CREATE UNIQUE INDEX notification_send_reconciliation_one_open
ON public.notification_send_reconciliation_actions(delivery_id)
WHERE status IN ('pending', 'processing', 'effect_pending');

ALTER TABLE public.notification_send_reconciliation_actions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.notification_send_reconciliation_actions FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.get_notification_send_reconciliation_queue(
  _limit integer DEFAULT 50
)
RETURNS TABLE (
  delivery_id uuid,
  notification_event_id uuid,
  channel text,
  provider text,
  recipient_masked text,
  template_name text,
  uncertainty_state text,
  detail text,
  created_at timestamptz,
  open_action_status text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT
    delivery.id,
    delivery.notification_event_id,
    delivery.channel,
    delivery.provider,
    CASE
      WHEN length(regexp_replace(COALESCE(delivery.recipient, ''), '[^0-9]', '', 'g')) >= 4
        THEN '•••• ' || right(regexp_replace(delivery.recipient, '[^0-9]', '', 'g'), 4)
      ELSE 'Oculto'
    END,
    delivery.template_name,
    CASE
      WHEN delivery.channel = 'whatsapp'
       AND delivery.provider_payload->>'meta_attempt_state' = 'completed_uncertain'
        THEN 'meta_uncertain'
      WHEN delivery.channel = 'whatsapp' THEN 'meta_contacting'
      ELSE 'resend_uncertain'
    END,
    left(COALESCE(delivery.error_message, 'Resultado incierto: comprobar el proveedor antes de resolver'), 500),
    delivery.created_at,
    action.status
  FROM public.notification_deliveries delivery
  LEFT JOIN LATERAL (
    SELECT candidate.status
    FROM public.notification_send_reconciliation_actions candidate
    WHERE candidate.delivery_id = delivery.id
      AND candidate.status IN ('pending', 'processing', 'effect_pending')
    ORDER BY candidate.requested_at DESC
    LIMIT 1
  ) action ON true
  WHERE delivery.status = 'queued'
    AND delivery.provider_message_id IS NULL
    AND (
      (
        delivery.channel = 'whatsapp'
        AND delivery.provider = 'meta_cloud_api'
        AND (
          delivery.error_code = 'reconciliation_required'
          OR delivery.provider_payload->>'send_started_at' IS NOT NULL
        )
      )
      OR (
        delivery.channel = 'email'
        AND delivery.provider = 'resend'
        AND delivery.provider_response->>'fallback_send_started_at' IS NOT NULL
        AND delivery.provider_response->>'fallback_attempt_state'
          IN ('contacting_resend', 'reconciliation_required')
      )
    )
  ORDER BY delivery.created_at
  LIMIT GREATEST(1, LEAST(_limit, 100));
END;
$$;

REVOKE ALL ON FUNCTION public.get_notification_send_reconciliation_queue(integer)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_notification_send_reconciliation_queue(integer)
  TO authenticated;

CREATE OR REPLACE FUNCTION public.request_notification_send_reconciliation(
  _delivery_id uuid,
  _resolution text,
  _provider_message_id text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  delivery public.notification_deliveries%ROWTYPE;
  action_id uuid;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;
  IF _resolution NOT IN ('confirmed_sent', 'confirmed_not_sent') THEN
    RAISE EXCEPTION 'invalid_resolution' USING ERRCODE = '22023';
  END IF;
  IF _resolution = 'confirmed_sent'
     AND (_provider_message_id IS NULL OR btrim(_provider_message_id) = '' OR length(_provider_message_id) > 255) THEN
    RAISE EXCEPTION 'provider_message_id_required' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO delivery
  FROM public.notification_deliveries
  WHERE id = _delivery_id
  FOR UPDATE;

  IF delivery.id IS NULL
     OR delivery.status <> 'queued'
     OR delivery.provider_message_id IS NOT NULL
     OR NOT (
       (delivery.channel = 'whatsapp' AND delivery.provider = 'meta_cloud_api'
        AND (delivery.error_code = 'reconciliation_required'
             OR delivery.provider_payload->>'send_started_at' IS NOT NULL))
       OR
       (delivery.channel = 'email' AND delivery.provider = 'resend'
        AND delivery.provider_response->>'fallback_send_started_at' IS NOT NULL
        AND delivery.provider_response->>'fallback_attempt_state'
          IN ('contacting_resend', 'reconciliation_required'))
     ) THEN
    RAISE EXCEPTION 'delivery_not_reconcilable' USING ERRCODE = '22023';
  END IF;

  -- Meta no ofrece una consulta/cancelación que demuestre que un POST incierto
  -- no produjo efecto. Por tanto, un WhatsApp incierto solo puede confirmarse
  -- como enviado; nunca se reabre ni se reintenta.
  IF _resolution = 'confirmed_not_sent'
     AND delivery.channel = 'whatsapp' THEN
    RAISE EXCEPTION 'whatsapp_uncertain_cannot_be_reopened' USING ERRCODE = '22023';
  END IF;
  IF _resolution = 'confirmed_not_sent'
     AND delivery.channel = 'email'
     AND (
       delivery.provider_response->>'fallback_send_started_at' IS NULL
       OR (delivery.provider_response->>'fallback_send_started_at')::timestamptz
         <= now() - interval '23 hours'
     ) THEN
    RAISE EXCEPTION 'resend_idempotency_window_expired' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.notification_send_reconciliation_actions (
    delivery_id, notification_event_id, channel, resolution, provider_message_id
  ) VALUES (
    delivery.id, delivery.notification_event_id, delivery.channel,
    _resolution, nullif(btrim(_provider_message_id), '')
  )
  RETURNING id INTO action_id;

  RETURN action_id;
END;
$$;

REVOKE ALL ON FUNCTION public.request_notification_send_reconciliation(uuid, text, text)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.request_notification_send_reconciliation(uuid, text, text)
  TO authenticated;

CREATE OR REPLACE FUNCTION public.claim_notification_send_reconciliation_actions(
  _limit integer DEFAULT 20
)
RETURNS TABLE (
  action_id uuid,
  delivery_id uuid,
  notification_event_id uuid,
  channel text,
  resolution text,
  provider_message_id text,
  claim_token uuid,
  action_status text,
  force_email_fallback boolean,
  fallback_whatsapp_delivery_id uuid
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  -- Si la ejecución externa quedó incierta más allá de la ventana conservadora
  -- de idempotencia de Resend, vuelve a revisión humana y jamás se auto-reenvía.
  UPDATE public.notification_send_reconciliation_actions action
  SET status = 'failed',
      completed_at = now(),
      result_detail = 'Ventana idempotente agotada; comprobar Resend antes de solicitar otra resolución'
  FROM public.notification_deliveries delivery
  WHERE delivery.id = action.delivery_id
    AND action.status = 'effect_pending'
    AND (
      delivery.provider_response->>'fallback_send_started_at' IS NULL
      OR (delivery.provider_response->>'fallback_send_started_at')::timestamptz
        <= now() - interval '23 hours'
    )
    AND action.processing_started_at < now() - interval '10 minutes';

  RETURN QUERY
  WITH candidates AS (
    SELECT action.id
    FROM public.notification_send_reconciliation_actions action
    JOIN public.notification_deliveries delivery ON delivery.id = action.delivery_id
    WHERE action.status = 'pending'
       OR (action.status = 'processing' AND action.processing_started_at < now() - interval '10 minutes')
       OR (
         action.status = 'effect_pending'
         AND delivery.provider_response->>'fallback_send_started_at' IS NOT NULL
         AND (delivery.provider_response->>'fallback_send_started_at')::timestamptz
           > now() - interval '23 hours'
         AND action.processing_started_at < now() - interval '10 minutes'
       )
    ORDER BY action.requested_at
    LIMIT GREATEST(1, LEAST(_limit, 50))
    FOR UPDATE OF action SKIP LOCKED
  ), claimed AS (
    UPDATE public.notification_send_reconciliation_actions action
    SET status = CASE WHEN action.status = 'effect_pending' THEN 'effect_pending' ELSE 'processing' END,
        processing_started_at = now(),
        claim_token = gen_random_uuid(),
        attempts = action.attempts + 1,
        result_detail = NULL
    FROM candidates
    WHERE action.id = candidates.id
    RETURNING action.*
  )
  SELECT claimed.id, claimed.delivery_id, claimed.notification_event_id,
    claimed.channel, claimed.resolution, claimed.provider_message_id, claimed.claim_token,
    claimed.status,
    claimed.status = 'effect_pending',
    claimed.fallback_whatsapp_delivery_id
  FROM claimed;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_notification_send_reconciliation_actions(integer)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_notification_send_reconciliation_actions(integer)
  TO service_role;

CREATE OR REPLACE FUNCTION public.validate_notification_send_reconciliation_effect(
  _action_id uuid,
  _claim_token uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  event_id uuid;
  valid boolean;
BEGIN
  SELECT action.notification_event_id INTO event_id
  FROM public.notification_send_reconciliation_actions action
  WHERE action.id = _action_id;
  IF event_id IS NULL THEN RETURN false; END IF;

  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(event_id::text, 20260720)
  );

  SELECT true INTO valid
  FROM public.notification_send_reconciliation_actions action
  JOIN public.notification_deliveries delivery ON delivery.id = action.delivery_id
  WHERE action.id = _action_id
    AND action.notification_event_id = event_id
    AND action.status = 'effect_pending'
    AND action.claim_token = _claim_token
    AND action.processing_started_at >= now() - interval '10 minutes'
    AND delivery.provider_response->>'fallback_send_started_at' IS NOT NULL
    AND (delivery.provider_response->>'fallback_send_started_at')::timestamptz
      > now() - interval '23 hours'
    AND action.fallback_whatsapp_delivery_id IS NOT NULL
  FOR UPDATE OF action;

  RETURN COALESCE(valid, false);
END;
$$;

REVOKE ALL ON FUNCTION public.validate_notification_send_reconciliation_effect(uuid, uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.validate_notification_send_reconciliation_effect(uuid, uuid)
  TO service_role;

CREATE OR REPLACE FUNCTION public.apply_notification_send_reconciliation_action(
  _action_id uuid,
  _claim_token uuid
)
RETURNS TABLE (
  event_id uuid,
  channel text,
  resolution text,
  force_email_fallback boolean,
  fallback_whatsapp_delivery_id uuid
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  action public.notification_send_reconciliation_actions%ROWTYPE;
  delivery public.notification_deliveries%ROWTYPE;
  event_row public.notification_events%ROWTYPE;
  fallback_trigger uuid;
  trigger_count integer;
BEGIN
  SELECT candidate.notification_event_id INTO action.notification_event_id
  FROM public.notification_send_reconciliation_actions candidate
  WHERE candidate.id = _action_id;
  IF action.notification_event_id IS NULL THEN
    RAISE EXCEPTION 'reconciliation_action_missing' USING ERRCODE = '22023';
  END IF;

  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(action.notification_event_id::text, 20260720)
  );

  SELECT * INTO action
  FROM public.notification_send_reconciliation_actions
  WHERE id = _action_id
    AND status = 'processing'
    AND claim_token = _claim_token
  FOR UPDATE;
  IF action.id IS NULL THEN
    RAISE EXCEPTION 'reconciliation_action_stale_claim' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO event_row FROM public.notification_events
  WHERE id = action.notification_event_id FOR UPDATE;
  SELECT * INTO delivery FROM public.notification_deliveries
  WHERE id = action.delivery_id
    AND notification_event_id = action.notification_event_id
  FOR UPDATE;

  IF event_row.id IS NULL
     OR delivery.id IS NULL
     OR delivery.channel IS DISTINCT FROM action.channel THEN
    RAISE EXCEPTION 'reconciliation_delivery_missing_or_mismatched' USING ERRCODE = '22023';
  END IF;

  -- Una acción recuperada nunca puede degradar un resultado que otro worker o
  -- callback ya hizo terminal. Si la misma decisión ya surtió efecto, es idempotente.
  IF action.resolution = 'confirmed_sent'
     AND delivery.status IN ('sent', 'delivered', 'read') THEN
    IF delivery.provider_message_id IS DISTINCT FROM action.provider_message_id THEN
      RAISE EXCEPTION 'provider_message_id_conflict' USING ERRCODE = '23514';
    END IF;
    RETURN QUERY SELECT action.notification_event_id, action.channel, action.resolution,
      false, NULL::uuid;
    RETURN;
  END IF;

  IF action.resolution = 'confirmed_not_sent'
     AND action.channel = 'whatsapp' THEN
    RAISE EXCEPTION 'whatsapp_uncertain_cannot_be_reopened' USING ERRCODE = '23514';
  END IF;
  IF action.resolution = 'confirmed_not_sent'
     AND action.channel = 'email'
     AND (
       delivery.provider_response->>'fallback_send_started_at' IS NULL
       OR (delivery.provider_response->>'fallback_send_started_at')::timestamptz
         <= now() - interval '23 hours'
     ) THEN
    RAISE EXCEPTION 'resend_idempotency_window_expired' USING ERRCODE = '23514';
  END IF;

  IF delivery.status <> 'queued'
     OR delivery.provider_message_id IS NOT NULL
     OR NOT (
       (delivery.channel = 'whatsapp' AND (
          delivery.error_code = 'reconciliation_required'
          OR delivery.provider_payload->>'send_started_at' IS NOT NULL
       ))
       OR (delivery.channel = 'email'
           AND delivery.provider_response->>'fallback_send_started_at' IS NOT NULL)
     ) THEN
    RAISE EXCEPTION 'delivery_no_longer_reconcilable' USING ERRCODE = '23514';
  END IF;

  IF action.resolution = 'confirmed_sent' THEN
    IF EXISTS (
      SELECT 1 FROM public.notification_deliveries sibling
      WHERE sibling.notification_event_id = action.notification_event_id
        AND sibling.id <> delivery.id
        AND sibling.channel <> delivery.channel
        AND sibling.status IN ('sent', 'delivered', 'read')
    ) THEN
      RAISE EXCEPTION 'other_channel_already_succeeded' USING ERRCODE = '23514';
    END IF;

    UPDATE public.notification_deliveries
    SET status = 'sent',
        provider_message_id = action.provider_message_id,
        sent_at = COALESCE(sent_at, now()),
        error_code = NULL,
        error_message = NULL,
        provider_response = COALESCE(provider_response, '{}'::jsonb)
          || jsonb_build_object('manual_reconciliation', 'confirmed_sent', 'resolved_at', now())
    WHERE id = delivery.id;

    UPDATE public.notification_events
    SET status = 'sent', processed_at = now(), processing_lease_token = NULL,
        error_message = NULL
    WHERE id = action.notification_event_id;

  ELSE
    -- La única resolución no enviada que llega aquí pertenece a Resend.
    IF delivery.channel <> 'email' THEN
      RAISE EXCEPTION 'confirmed_not_sent_channel_not_supported' USING ERRCODE = '23514';
    END IF;
    IF EXISTS (
      SELECT 1 FROM public.notification_deliveries whatsapp
      WHERE whatsapp.notification_event_id = action.notification_event_id
        AND whatsapp.channel = 'whatsapp'
        AND whatsapp.status IN ('sent', 'delivered', 'read')
    ) THEN
      RAISE EXCEPTION 'whatsapp_already_succeeded' USING ERRCODE = '23514';
    END IF;

    SELECT count(*)
    INTO trigger_count
    FROM public.notification_deliveries whatsapp
    WHERE whatsapp.notification_event_id = action.notification_event_id
      AND whatsapp.channel = 'whatsapp'
      AND whatsapp.provider = 'meta_cloud_api'
      AND whatsapp.status = 'failed';
    IF trigger_count <> 1 THEN
      RAISE EXCEPTION 'fallback_whatsapp_delivery_ambiguous' USING ERRCODE = '23514';
    END IF;
    SELECT whatsapp.id INTO fallback_trigger
    FROM public.notification_deliveries whatsapp
    WHERE whatsapp.notification_event_id = action.notification_event_id
      AND whatsapp.channel = 'whatsapp'
      AND whatsapp.provider = 'meta_cloud_api'
      AND whatsapp.status = 'failed';

    UPDATE public.notification_deliveries
    SET status = 'failed',
        error_code = 'manual_confirmed_not_sent',
        error_message = 'Operador confirmó que Resend no recibió el intento',
        failed_at = now(),
        provider_response = COALESCE(provider_response, '{}'::jsonb)
          || jsonb_build_object(
            'fallback_attempt_state', 'manual_confirmed_not_sent',
            'manual_resolved_at', now()
          )
    WHERE id = delivery.id;

    UPDATE public.notification_events
    SET status = 'failed', processed_at = now(), processing_lease_token = NULL,
        error_message = 'Fallback confirmado como no enviado; reintento manual autorizado'
    WHERE id = action.notification_event_id;

    UPDATE public.notification_send_reconciliation_actions
    SET status = 'effect_pending',
        effect_started_at = COALESCE(effect_started_at, now()),
        fallback_whatsapp_delivery_id = fallback_trigger
    WHERE id = action.id
      AND status = 'processing'
      AND claim_token = _claim_token;
  END IF;

  RETURN QUERY SELECT action.notification_event_id, action.channel, action.resolution,
    (action.resolution = 'confirmed_not_sent' AND action.channel = 'email'), fallback_trigger;
END;
$$;

REVOKE ALL ON FUNCTION public.apply_notification_send_reconciliation_action(uuid, uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.apply_notification_send_reconciliation_action(uuid, uuid)
  TO service_role;

CREATE OR REPLACE FUNCTION public.finish_notification_send_reconciliation_action(
  _action_id uuid,
  _claim_token uuid,
  _completed boolean,
  _detail text DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  UPDATE public.notification_send_reconciliation_actions
  SET status = CASE WHEN _completed THEN 'completed' ELSE 'failed' END,
      completed_at = now(),
      result_detail = left(COALESCE(_detail, CASE WHEN _completed THEN 'completed' ELSE 'failed' END), 1000)
  WHERE id = _action_id
    AND claim_token = _claim_token
    AND status IN ('processing', 'effect_pending');
  RETURN FOUND;
END;
$$;

REVOKE ALL ON FUNCTION public.finish_notification_send_reconciliation_action(uuid, uuid, boolean, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.finish_notification_send_reconciliation_action(uuid, uuid, boolean, text)
  TO service_role;
