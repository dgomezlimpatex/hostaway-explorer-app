-- Additive package. Never apply historical inventory migrations with this file.
-- All mutations are service-role-only RPCs called after Edge authorization.
CREATE TABLE public.laundry_receipt_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  warehouse_id uuid NOT NULL UNIQUE REFERENCES public.stock_warehouses(id) ON DELETE RESTRICT,
  token text NOT NULL UNIQUE DEFAULT encode(extensions.gen_random_bytes(32), 'hex'),
  product_map jsonb NOT NULL DEFAULT '{}',
  worker_ids uuid[] NOT NULL DEFAULT '{}',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.laundry_receipt_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  link_id uuid NOT NULL REFERENCES public.laundry_receipt_links(id) ON DELETE CASCADE,
  worker_id uuid NOT NULL REFERENCES public.laundry_route_workers(id) ON DELETE CASCADE,
  pin_synced_at timestamptz NOT NULL,
  token_hash text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz
);
CREATE TABLE public.laundry_receipt_attempts (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  link_id uuid NOT NULL REFERENCES public.laundry_receipt_links(id) ON DELETE CASCADE,
  ip_hash text NOT NULL,
  successful boolean NOT NULL,
  attempted_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX laundry_receipt_attempts_lookup ON public.laundry_receipt_attempts(link_id, ip_hash, attempted_at DESC);
CREATE TABLE public.laundry_receipts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  link_id uuid NOT NULL REFERENCES public.laundry_receipt_links(id) ON DELETE RESTRICT,
  receipt_date date NOT NULL,
  product_map jsonb NOT NULL,
  counts jsonb NOT NULL DEFAULT '{"double_sheets":0,"single_sheets":0,"pillowcases":0,"bath_towels":0,"hand_towels":0,"bath_mats":0,"duvets":0,"mattress_protectors":0,"pillows":0}',
  notes text NOT NULL DEFAULT '',
  revision integer NOT NULL DEFAULT 0,
  latest_version integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(link_id, receipt_date)
);
CREATE TABLE public.laundry_receipt_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  receipt_id uuid NOT NULL REFERENCES public.laundry_receipts(id) ON DELETE RESTRICT,
  version integer NOT NULL,
  revision integer NOT NULL,
  snapshot jsonb NOT NULL,
  worker_id uuid NOT NULL REFERENCES public.laundry_route_workers(id) ON DELETE RESTRICT,
  movement_ids uuid[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(receipt_id, version)
);
CREATE TABLE public.laundry_receipt_operations (
  id uuid PRIMARY KEY,
  receipt_id uuid NOT NULL REFERENCES public.laundry_receipts(id) ON DELETE RESTRICT,
  worker_id uuid NOT NULL REFERENCES public.laundry_route_workers(id) ON DELETE RESTRICT,
  payload jsonb NOT NULL,
  previous_counts jsonb NOT NULL,
  result jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.laundry_receipt_emails (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  version_id uuid NOT NULL UNIQUE REFERENCES public.laundry_receipt_versions(id) ON DELETE RESTRICT,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','sending','accepted','error','uncertain')),
  attempts integer NOT NULL DEFAULT 0,
  claim_token uuid,
  claimed_at timestamptz,
  first_attempt_at timestamptz,
  next_attempt_at timestamptz NOT NULL DEFAULT now(),
  provider_id text,
  error_message text,
  accepted_at timestamptz
);
CREATE INDEX laundry_receipt_email_due ON public.laundry_receipt_emails(next_attempt_at) WHERE status IN ('pending','error','sending');

DO $$ DECLARE t text; BEGIN
  FOREACH t IN ARRAY ARRAY['laundry_receipt_links','laundry_receipt_sessions','laundry_receipt_attempts','laundry_receipts','laundry_receipt_versions','laundry_receipt_operations','laundry_receipt_emails'] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('REVOKE ALL ON public.%I FROM anon, authenticated', t);
    EXECUTE format('GRANT ALL ON public.%I TO service_role', t);
    -- Administrative reads remain behind the authorized Edge API, not anonymous policies.
  END LOOP;
END $$;
GRANT USAGE, SELECT ON SEQUENCE public.laundry_receipt_attempts_id_seq TO service_role;

CREATE FUNCTION public.invalidate_laundry_receipt_worker_sessions() RETURNS trigger
LANGUAGE plpgsql SET search_path = public, pg_temp AS $$ BEGIN
  UPDATE public.laundry_receipt_sessions SET revoked_at=now() WHERE worker_id=NEW.id AND revoked_at IS NULL;
  RETURN NEW;
END $$;
CREATE TRIGGER invalidate_laundry_receipt_worker_sessions AFTER UPDATE OF is_active,pin_synced_at ON public.laundry_route_workers
FOR EACH ROW WHEN (OLD.is_active IS DISTINCT FROM NEW.is_active OR OLD.pin_synced_at IS DISTINCT FROM NEW.pin_synced_at)
EXECUTE FUNCTION public.invalidate_laundry_receipt_worker_sessions();
REVOKE ALL ON FUNCTION public.invalidate_laundry_receipt_worker_sessions() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.invalidate_laundry_receipt_worker_sessions() TO service_role;

CREATE FUNCTION public.laundry_receipt_keys() RETURNS text[] LANGUAGE sql IMMUTABLE
SET search_path = public, pg_temp AS $$ SELECT ARRAY['double_sheets','single_sheets','pillowcases','bath_towels','hand_towels','bath_mats','duvets','mattress_protectors','pillows']::text[] $$;

CREATE FUNCTION public.configure_laundry_receipt(_warehouse uuid, _map jsonb, _workers uuid[], _active boolean, _rotate boolean DEFAULT false)
RETURNS jsonb LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
DECLARE w public.stock_warehouses; l public.laundry_receipt_links; k text; p uuid;
BEGIN
  SELECT * INTO STRICT w FROM public.stock_warehouses WHERE id = _warehouse AND is_active FOR UPDATE;
  IF coalesce(w.location_type,'central')<>'central' THEN RAISE EXCEPTION 'Selecciona un almacén central de ropa limpia'; END IF;
  SELECT * INTO l FROM public.laundry_receipt_links WHERE warehouse_id=_warehouse FOR UPDATE;
  IF l.id IS NOT NULL AND NOT _active THEN
    UPDATE public.laundry_receipt_links SET is_active=false,token=CASE WHEN _rotate THEN encode(extensions.gen_random_bytes(32),'hex') ELSE token END WHERE id=l.id RETURNING * INTO l;
    UPDATE public.laundry_receipt_sessions SET revoked_at=now() WHERE link_id=l.id AND revoked_at IS NULL;
    RETURN to_jsonb(l);
  END IF;
  IF jsonb_typeof(_map) <> 'object' OR (SELECT count(*) FROM jsonb_object_keys(_map)) <> 9 THEN RAISE EXCEPTION 'Asocia los nueve materiales'; END IF;
  FOREACH k IN ARRAY public.laundry_receipt_keys() LOOP
    p := (_map->>k)::uuid;
    IF p IS NULL OR NOT EXISTS (SELECT 1 FROM public.stock_products sp JOIN public.stock_categories sc ON sc.id = sp.category_id WHERE sp.id=p AND sp.sede_id=w.sede_id AND sp.is_active AND sc.is_active AND sc.kind='laundry') THEN RAISE EXCEPTION 'Producto de lavandería inválido: %', k; END IF;
  END LOOP;
  IF (SELECT count(DISTINCT value) FROM jsonb_each_text(_map)) <> 9 THEN RAISE EXCEPTION 'Cada material debe tener un producto distinto'; END IF;
  IF cardinality(_workers) IS NULL OR cardinality(_workers)=0 OR EXISTS (SELECT 1 FROM unnest(_workers) x WHERE NOT EXISTS (SELECT 1 FROM public.laundry_route_workers rw JOIN public.cleaners c ON c.id=rw.cleaner_id WHERE rw.id=x AND rw.sede_id=w.sede_id AND rw.is_active AND c.is_active)) THEN RAISE EXCEPTION 'Selecciona empleados de ruta activos de esta sede'; END IF;
  IF l.id IS NOT NULL AND l.product_map <> _map AND EXISTS (SELECT 1 FROM public.laundry_receipts WHERE link_id=l.id) THEN RAISE EXCEPTION 'No se pueden cambiar productos con recuentos existentes'; END IF;
  INSERT INTO public.laundry_receipt_links(warehouse_id,product_map,worker_ids,is_active) VALUES(_warehouse,_map,_workers,_active)
  ON CONFLICT(warehouse_id) DO UPDATE SET product_map=excluded.product_map,worker_ids=excluded.worker_ids,is_active=excluded.is_active RETURNING * INTO l;
  IF _rotate THEN UPDATE public.laundry_receipt_links SET token=encode(extensions.gen_random_bytes(32),'hex') WHERE id=l.id RETURNING * INTO l; END IF;
  -- Every permission/configuration change expires existing sessions, including disable/re-enable.
  UPDATE public.laundry_receipt_sessions SET revoked_at=now() WHERE link_id=l.id AND revoked_at IS NULL;
  RETURN to_jsonb(l);
END $$;

CREATE FUNCTION public.login_laundry_receipt(_token text, _pin text, _ip_hash text, _session_hash text)
RETURNS jsonb LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
DECLARE l public.laundry_receipt_links; w public.laundry_route_workers; matches integer; failures integer; a record; blocked timestamptz; exp timestamptz := now()+interval '12 hours';
BEGIN
  SELECT rl.* INTO STRICT l FROM public.laundry_receipt_links rl JOIN public.stock_warehouses wh ON wh.id=rl.warehouse_id WHERE rl.token=_token AND rl.is_active AND wh.is_active;
  IF _ip_hash IS NULL OR length(_ip_hash)<>64 OR _pin !~ '^[0-9]{3,12}$' OR length(_session_hash)<>64 THEN RAISE EXCEPTION 'Acceso inválido'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(l.id::text||_ip_hash,0));
  failures := 0;
  FOR a IN SELECT * FROM public.laundry_receipt_attempts WHERE link_id=l.id AND ip_hash=_ip_hash AND attempted_at>now()-interval '20 minutes' ORDER BY attempted_at,id LOOP
    IF blocked IS NOT NULL AND a.attempted_at<blocked THEN CONTINUE; END IF;
    IF blocked IS NOT NULL THEN blocked:=NULL; failures:=0; END IF;
    IF a.successful OR a.attempted_at<now()-interval '10 minutes' THEN failures:=0; ELSE failures:=failures+1; END IF;
    IF failures>=10 THEN blocked:=a.attempted_at+interval '10 minutes'; END IF;
  END LOOP;
  IF blocked>now() THEN RETURN jsonb_build_object('error','Demasiados intentos. Espera diez minutos.','status',429); END IF;
  SELECT count(*) INTO matches FROM public.laundry_route_workers rw JOIN public.cleaners c ON c.id=rw.cleaner_id JOIN public.stock_warehouses wh ON wh.id=l.warehouse_id WHERE rw.id=ANY(l.worker_ids) AND rw.sede_id=wh.sede_id AND rw.is_active AND c.is_active AND public.verify_laundry_route_worker_pin(rw.id,_pin);
  INSERT INTO public.laundry_receipt_attempts(link_id,ip_hash,successful) VALUES(l.id,_ip_hash,matches=1);
  IF matches<>1 THEN RETURN jsonb_build_object('error',CASE WHEN matches>1 THEN 'PIN duplicado. Contacta con administración.' ELSE 'PIN incorrecto o empleado sin acceso al almacén.' END,'status',401); END IF;
  SELECT rw.* INTO STRICT w FROM public.laundry_route_workers rw JOIN public.cleaners c ON c.id=rw.cleaner_id WHERE rw.id=ANY(l.worker_ids) AND rw.is_active AND c.is_active AND public.verify_laundry_route_worker_pin(rw.id,_pin);
  INSERT INTO public.laundry_receipt_sessions(link_id,worker_id,pin_synced_at,token_hash,expires_at) VALUES(l.id,w.id,w.pin_synced_at,_session_hash,exp);
  RETURN jsonb_build_object('expiresAt',exp,'workerId',w.id,'workerName',(SELECT name FROM public.cleaners WHERE id=w.cleaner_id));
END $$;

CREATE FUNCTION public.laundry_receipt_identity(_token text, _session_hash text) RETURNS uuid
LANGUAGE plpgsql SET search_path = public, pg_temp AS $$ DECLARE worker uuid; BEGIN
  SELECT rw.id INTO worker FROM public.laundry_receipt_sessions s JOIN public.laundry_receipt_links l ON l.id=s.link_id JOIN public.laundry_route_workers rw ON rw.id=s.worker_id JOIN public.cleaners c ON c.id=rw.cleaner_id JOIN public.stock_warehouses w ON w.id=l.warehouse_id
  WHERE l.token=_token AND l.is_active AND w.is_active AND rw.sede_id=w.sede_id AND s.token_hash=_session_hash AND s.revoked_at IS NULL AND s.expires_at>now() AND s.pin_synced_at=rw.pin_synced_at AND rw.is_active AND c.is_active AND rw.id=ANY(l.worker_ids);
  IF worker IS NULL THEN RAISE EXCEPTION 'Sesión caducada. Introduce tu PIN.' USING ERRCODE='28000'; END IF;
  RETURN worker;
END $$;

CREATE FUNCTION public.read_laundry_receipt(_token text, _session_hash text, _date date DEFAULT NULL) RETURNS jsonb
LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
DECLARE l public.laundry_receipt_links; r public.laundry_receipts; worker uuid;
BEGIN
  worker:=public.laundry_receipt_identity(_token,_session_hash);
  SELECT * INTO STRICT l FROM public.laundry_receipt_links WHERE token=_token;
  SELECT * INTO r FROM public.laundry_receipts WHERE link_id=l.id AND receipt_date=coalesce(_date,(now() AT TIME ZONE 'Europe/Madrid')::date);
  RETURN jsonb_build_object('date',coalesce(_date,(now() AT TIME ZONE 'Europe/Madrid')::date),'workerName',(SELECT c.name FROM public.laundry_route_workers rw JOIN public.cleaners c ON c.id=rw.cleaner_id WHERE rw.id=worker),'warehouseName',(SELECT name FROM public.stock_warehouses WHERE id=l.warehouse_id),'receipt',CASE WHEN r.id IS NULL THEN NULL ELSE to_jsonb(r)-'product_map' END,
    'versions',coalesce((SELECT jsonb_agg(to_jsonb(v)||jsonb_build_object('email',to_jsonb(e)) ORDER BY v.version DESC) FROM public.laundry_receipt_versions v JOIN public.laundry_receipt_emails e ON e.version_id=v.id WHERE v.receipt_id=r.id),'[]'::jsonb),
    'operations',coalesce((SELECT jsonb_agg(jsonb_build_object('id',o.id,'payload',o.payload,'worker_name',c.name,'created_at',o.created_at,'revision',o.result->'revision') ORDER BY o.created_at DESC) FROM public.laundry_receipt_operations o JOIN public.laundry_route_workers rw ON rw.id=o.worker_id JOIN public.cleaners c ON c.id=rw.cleaner_id WHERE o.receipt_id=r.id),'[]'::jsonb),
    'pendingDates',coalesce((SELECT jsonb_agg(q.receipt_date ORDER BY q.receipt_date) FROM public.laundry_receipts q LEFT JOIN public.laundry_receipt_versions v ON v.receipt_id=q.id AND v.version=q.latest_version WHERE q.link_id=l.id AND q.receipt_date<(now() AT TIME ZONE 'Europe/Madrid')::date AND (q.latest_version=0 OR q.counts<>v.snapshot->'counts' OR q.notes<>v.snapshot->>'notes')),'[]'::jsonb));
END $$;

CREATE FUNCTION public.mutate_laundry_receipt(_token text, _session_hash text, _date date, _op_id uuid, _payload jsonb) RETURNS jsonb
LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
DECLARE l public.laundry_receipt_links; r public.laundry_receipts; worker uuid; prior public.laundry_receipt_operations; before_counts jsonb; k text; qty bigint; action text; expected integer; undo public.laundry_receipt_operations; v public.laundry_receipt_versions; old_counts jsonb; p uuid; delta numeric; balance numeric; mid uuid; mids uuid[]:='{}'; result jsonb; version_id uuid;
BEGIN
  SELECT * INTO STRICT l FROM public.laundry_receipt_links WHERE token=_token FOR UPDATE;
  worker:=public.laundry_receipt_identity(_token,_session_hash);
  SELECT * INTO prior FROM public.laundry_receipt_operations WHERE id=_op_id;
  IF prior.id IS NOT NULL THEN
    IF prior.worker_id<>worker OR prior.payload<>_payload OR NOT EXISTS(SELECT 1 FROM public.laundry_receipts WHERE id=prior.receipt_id AND link_id=l.id AND receipt_date=_date) THEN RAISE EXCEPTION 'Identificador de operación ya utilizado'; END IF;
    RETURN prior.result;
  END IF;
  action:=_payload->>'action';
  IF _date>(now() AT TIME ZONE 'Europe/Madrid')::date OR _date IS NULL THEN RAISE EXCEPTION 'Fecha inválida'; END IF;
  IF action='start' THEN
    IF _date<>(now() AT TIME ZONE 'Europe/Madrid')::date THEN RAISE EXCEPTION 'Solo puedes iniciar el recuento de hoy'; END IF;
    INSERT INTO public.laundry_receipts(link_id,receipt_date,product_map) VALUES(l.id,_date,l.product_map) ON CONFLICT(link_id,receipt_date) DO NOTHING;
  END IF;
  SELECT * INTO STRICT r FROM public.laundry_receipts WHERE link_id=l.id AND receipt_date=_date FOR UPDATE;
  before_counts:=r.counts;
  expected:=(_payload->>'expectedRevision')::integer;
  IF action IN ('set','notes','undo','confirm') AND (expected IS NULL OR expected<>r.revision) THEN RAISE EXCEPTION 'El recuento ha cambiado. Revisa el total actualizado.' USING ERRCODE='40001'; END IF;
  IF action IN ('add','set') THEN
    k:=_payload->>'material';
    IF NOT k=ANY(public.laundry_receipt_keys()) OR k IS NULL OR coalesce(_payload->>'quantity','') !~ '^[0-9]{1,9}$' THEN RAISE EXCEPTION 'Cantidad o material inválido'; END IF;
    qty:=(_payload->>'quantity')::bigint;
    IF action='add' THEN qty:=qty+(r.counts->>k)::bigint; END IF;
    IF qty>999999999 THEN RAISE EXCEPTION 'Cantidad demasiado grande'; END IF;
    r.counts:=jsonb_set(r.counts,ARRAY[k],to_jsonb(qty));
  ELSIF action='notes' THEN
    IF length(coalesce(_payload->>'notes',''))>2000 THEN RAISE EXCEPTION 'Observación demasiado larga'; END IF;
    r.notes:=coalesce(_payload->>'notes','');
  ELSIF action='undo' THEN
    SELECT * INTO STRICT undo FROM public.laundry_receipt_operations WHERE id=(_payload->>'targetId')::uuid AND receipt_id=r.id AND payload->>'action' IN ('add','set');
    IF (undo.result->>'revision')::integer<>r.revision THEN RAISE EXCEPTION 'Solo se puede deshacer la última suma o corrección. Revisa el total.'; END IF;
    r.counts:=undo.previous_counts;
  ELSIF action='confirm' THEN
    SELECT * INTO v FROM public.laundry_receipt_versions WHERE receipt_id=r.id AND version=r.latest_version;
    old_counts:=coalesce(v.snapshot->'counts',before_counts);
    IF r.latest_version=0 THEN old_counts:=(SELECT jsonb_object_agg(key,0) FROM jsonb_each(r.counts)); END IF;
    IF r.latest_version>0 AND r.counts=old_counts AND r.notes=v.snapshot->>'notes' THEN
      result:=jsonb_build_object('versionId',v.id,'revision',r.revision,'unchanged',true);
    ELSE
      IF NOT EXISTS(SELECT 1 FROM jsonb_each_text(r.counts) WHERE value::bigint>0) AND r.latest_version=0 THEN RAISE EXCEPTION 'Añade ropa recibida antes de confirmar'; END IF;
      -- Lock levels in product-id order, including no-delta products: deterministic lock order.
      FOR k,p IN SELECT key,value::uuid FROM jsonb_each_text(r.product_map) ORDER BY value LOOP
        IF NOT EXISTS(SELECT 1 FROM public.stock_products sp JOIN public.stock_categories sc ON sc.id=sp.category_id WHERE sp.id=p AND sp.is_active AND sc.kind='laundry') THEN RAISE EXCEPTION 'Producto desactivado. Contacta con administración.'; END IF;
        INSERT INTO public.stock_levels(product_id,warehouse_id,current_quantity,minimum_quantity,target_quantity) VALUES(p,l.warehouse_id,0,0,0) ON CONFLICT(product_id,warehouse_id) DO NOTHING;
        SELECT current_quantity INTO STRICT balance FROM public.stock_levels WHERE product_id=p AND warehouse_id=l.warehouse_id FOR UPDATE;
        delta:=(r.counts->>k)::numeric-(old_counts->>k)::numeric;
        IF balance+delta<0 THEN RAISE EXCEPTION 'La corrección dejaría stock negativo. Administración debe revisar los movimientos posteriores.'; END IF;
        IF delta<>0 THEN
          UPDATE public.stock_levels SET current_quantity=balance+delta,last_updated=now(),updated_by=NULL WHERE product_id=p AND warehouse_id=l.warehouse_id;
          INSERT INTO public.stock_movements(product_id,warehouse_id,movement_type,quantity,previous_quantity,new_quantity,reason)
          VALUES(p,l.warehouse_id,CASE WHEN delta>0 THEN 'entrada'::public.stock_movement_type ELSE 'salida'::public.stock_movement_type END,abs(delta),balance,balance+delta,format('Recepción %s v%s · %s · empleado %s',r.receipt_date,r.latest_version+1,r.id,worker)) RETURNING id INTO mid;
          mids:=array_append(mids,mid);
        END IF;
      END LOOP;
      INSERT INTO public.laundry_receipt_versions(receipt_id,version,revision,worker_id,movement_ids,snapshot)
      VALUES(r.id,r.latest_version+1,r.revision,worker,mids,jsonb_build_object('receipt_date',r.receipt_date,'warehouse_name',(SELECT name FROM public.stock_warehouses WHERE id=l.warehouse_id),'version',r.latest_version+1,'worker_name',(SELECT c.name FROM public.laundry_route_workers rw JOIN public.cleaners c ON c.id=rw.cleaner_id WHERE rw.id=worker),'confirmed_at',now(),'counts',r.counts,'notes',r.notes)) RETURNING id INTO version_id;
      INSERT INTO public.laundry_receipt_emails(version_id) VALUES(version_id);
      r.latest_version:=r.latest_version+1;
      result:=jsonb_build_object('versionId',version_id,'revision',r.revision,'unchanged',false);
    END IF;
  ELSIF action<>'start' OR action IS NULL THEN RAISE EXCEPTION 'Acción inválida'; END IF;
  IF action IN ('add','set','notes','undo') THEN r.revision:=r.revision+1; END IF;
  UPDATE public.laundry_receipts SET counts=r.counts,notes=r.notes,revision=r.revision,latest_version=r.latest_version,updated_at=now() WHERE id=r.id;
  result:=coalesce(result,jsonb_build_object('revision',r.revision));
  INSERT INTO public.laundry_receipt_operations(id,receipt_id,worker_id,payload,previous_counts,result) VALUES(_op_id,r.id,worker,_payload,before_counts,result);
  RETURN result;
END $$;

-- A lease protects against concurrent drain/manual resend. Provider idempotency
-- is bound to version id; uncertain delivery is never retried after its 24h window.
CREATE FUNCTION public.claim_laundry_receipt_email(_version uuid DEFAULT NULL) RETURNS jsonb
LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
DECLARE e public.laundry_receipt_emails; v public.laundry_receipt_versions;
BEGIN
  SELECT * INTO e FROM public.laundry_receipt_emails WHERE (_version IS NULL OR version_id=_version) AND status IN ('pending','error','sending') AND attempts<8 AND next_attempt_at<=now() AND (status<>'sending' OR claimed_at<now()-interval '3 minutes') ORDER BY next_attempt_at FOR UPDATE SKIP LOCKED LIMIT 1;
  IF e.id IS NULL THEN RETURN NULL; END IF;
  SELECT * INTO STRICT v FROM public.laundry_receipt_versions WHERE id=e.version_id;
  IF e.attempts>0 AND e.first_attempt_at<now()-interval '23 hours' THEN
    UPDATE public.laundry_receipt_emails SET status='uncertain',error_message='Fuera de la ventana segura de reintento. Revisar proveedor antes de reenviar.' WHERE id=e.id; RETURN NULL;
  END IF;
  UPDATE public.laundry_receipt_emails SET status='sending',attempts=attempts+1,claim_token=gen_random_uuid(),claimed_at=now(),first_attempt_at=coalesce(first_attempt_at,now()),next_attempt_at=now()+interval '3 minutes' WHERE id=e.id RETURNING * INTO e;
  RETURN jsonb_build_object('email',to_jsonb(e),'snapshot',v.snapshot);
END $$;

CREATE FUNCTION public.finish_laundry_receipt_email(_id uuid,_claim uuid,_provider text,_error text) RETURNS void
LANGUAGE sql SET search_path = public, pg_temp AS $$
  UPDATE public.laundry_receipt_emails SET status=CASE WHEN _provider IS NOT NULL THEN 'accepted' ELSE 'error' END,provider_id=_provider,error_message=_error,accepted_at=CASE WHEN _provider IS NOT NULL THEN now() ELSE NULL END,next_attempt_at=now()+make_interval(secs=>least(3600,30*power(2,attempts)::integer)) WHERE id=_id AND claim_token=_claim AND status='sending';
$$;

CREATE FUNCTION public.retry_laundry_receipt_email(_version uuid) RETURNS void
LANGUAGE sql SET search_path = public, pg_temp AS $$
  UPDATE public.laundry_receipt_emails SET next_attempt_at=now(),attempts=least(attempts,7)
  WHERE version_id=_version AND status IN ('pending','error');
$$;

-- No new function is callable through the anonymous Data API.
REVOKE ALL ON FUNCTION public.laundry_receipt_keys(), public.configure_laundry_receipt(uuid,jsonb,uuid[],boolean,boolean), public.login_laundry_receipt(text,text,text,text), public.laundry_receipt_identity(text,text), public.read_laundry_receipt(text,text,date), public.mutate_laundry_receipt(text,text,date,uuid,jsonb), public.claim_laundry_receipt_email(uuid), public.finish_laundry_receipt_email(uuid,uuid,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.laundry_receipt_keys(), public.configure_laundry_receipt(uuid,jsonb,uuid[],boolean,boolean), public.login_laundry_receipt(text,text,text,text), public.laundry_receipt_identity(text,text), public.read_laundry_receipt(text,text,date), public.mutate_laundry_receipt(text,text,date,uuid,jsonb), public.claim_laundry_receipt_email(uuid), public.finish_laundry_receipt_email(uuid,uuid,text,text) TO service_role;
REVOKE ALL ON FUNCTION public.retry_laundry_receipt_email(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.retry_laundry_receipt_email(uuid) TO service_role;
