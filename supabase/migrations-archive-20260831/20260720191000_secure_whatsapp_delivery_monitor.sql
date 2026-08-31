-- Monitor WhatsApp seguro, paginado y limitado a admin/manager con acceso de sede.
-- El navegador nunca recibe el teléfono completo ni payloads crudos del proveedor.

DROP POLICY IF EXISTS "notification_events_admin_manager_all" ON public.notification_events;
DROP POLICY IF EXISTS "notification_events_supervisor_read" ON public.notification_events;
DROP POLICY IF EXISTS "notification_events_admin_manager_read" ON public.notification_events;
DROP POLICY IF EXISTS "notification_events_admin_manager_insert" ON public.notification_events;
DROP POLICY IF EXISTS "notification_deliveries_admin_manager_all" ON public.notification_deliveries;
DROP POLICY IF EXISTS "notification_deliveries_supervisor_read" ON public.notification_deliveries;

-- Toda notificación operativa de esta tabla pertenece a una tarea. La sede se
-- deriva de la tarea y nunca se confía en la sede enviada por el cliente.
CREATE OR REPLACE FUNCTION public.enforce_notification_event_scope()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  task_sede uuid;
  cleaner_sede uuid;
BEGIN
  IF NEW.task_id IS NULL THEN
    RAISE EXCEPTION 'notification_event_requires_task' USING ERRCODE = '23514';
  END IF;

  SELECT task.sede_id INTO task_sede
  FROM public.tasks task
  WHERE task.id = NEW.task_id;

  IF NOT FOUND OR task_sede IS NULL THEN
    RAISE EXCEPTION 'notification_event_task_not_found' USING ERRCODE = '23503';
  END IF;

  IF NEW.cleaner_id IS NOT NULL THEN
    SELECT cleaner.sede_id INTO cleaner_sede
    FROM public.cleaners cleaner
    WHERE cleaner.id = NEW.cleaner_id;

    IF NOT FOUND OR cleaner_sede IS DISTINCT FROM task_sede THEN
      RAISE EXCEPTION 'notification_event_cleaner_sede_mismatch' USING ERRCODE = '23514';
    END IF;
  END IF;

  NEW.sede_id := task_sede;
  NEW.entity_type := 'tasks';
  NEW.entity_id := NEW.task_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notification_events_enforce_scope ON public.notification_events;
CREATE TRIGGER trg_notification_events_enforce_scope
BEFORE INSERT
ON public.notification_events
FOR EACH ROW EXECUTE FUNCTION public.enforce_notification_event_scope();

REVOKE ALL ON FUNCTION public.enforce_notification_event_scope() FROM PUBLIC;

CREATE POLICY "notification_events_admin_manager_read"
ON public.notification_events FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'admin')
  OR (
    public.has_role(auth.uid(), 'manager')
    AND notification_events.sede_id IS NOT NULL
    AND public.user_has_sede_access(auth.uid(), notification_events.sede_id)
    AND EXISTS (
      SELECT 1 FROM public.tasks task
      WHERE task.id = notification_events.task_id
        AND task.sede_id = notification_events.sede_id
    )
    AND (
      notification_events.cleaner_id IS NULL OR EXISTS (
        SELECT 1 FROM public.cleaners cleaner
        WHERE cleaner.id = notification_events.cleaner_id
          AND cleaner.sede_id = notification_events.sede_id
      )
    )
  )
);

CREATE POLICY "notification_events_admin_manager_insert"
ON public.notification_events FOR INSERT TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'admin')
  OR (
    public.has_role(auth.uid(), 'manager')
    AND notification_events.sede_id IS NOT NULL
    AND public.user_has_sede_access(auth.uid(), notification_events.sede_id)
    AND EXISTS (
      SELECT 1 FROM public.tasks task
      WHERE task.id = notification_events.task_id
        AND task.sede_id = notification_events.sede_id
    )
    AND (
      notification_events.cleaner_id IS NULL OR EXISTS (
        SELECT 1 FROM public.cleaners cleaner
        WHERE cleaner.id = notification_events.cleaner_id
          AND cleaner.sede_id = notification_events.sede_id
      )
    )
  )
);

-- No se crea política SELECT sobre entregas: la tabla contiene teléfono y
-- respuestas crudas. El cliente solo accede mediante las RPC saneadas.

CREATE INDEX IF NOT EXISTS idx_notification_deliveries_whatsapp_monitor
ON public.notification_deliveries(channel, created_at DESC, status);

CREATE OR REPLACE FUNCTION public.get_whatsapp_delivery_monitor_stats(_days integer DEFAULT 7)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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
SET search_path = public
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
    left(
      regexp_replace(COALESCE(delivery.error_message, ''), '\+?[0-9][0-9 ()-]{6,}', '[teléfono oculto]', 'g'),
      300
    ),
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
