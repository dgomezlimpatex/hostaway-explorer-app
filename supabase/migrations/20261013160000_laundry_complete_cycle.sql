-- PREPARED ONLY: no production application during development.
-- Complete textile circuit. The legacy route flag stays off; activation is
-- explicit and limited to counted properties and service dates.
BEGIN;
CREATE TABLE public.laundry_cycle_config (
 sede_id uuid PRIMARY KEY REFERENCES public.sedes(id) ON DELETE RESTRICT,
 central_id uuid NOT NULL REFERENCES public.stock_warehouses(id) ON DELETE RESTRICT,
 active boolean NOT NULL DEFAULT false, start_date date NOT NULL,
 collection_mode text CHECK(collection_mode IN ('all','one')),
 collection_destination text CHECK(collection_destination IN ('central','laundry')),
 rejection_mode text NOT NULL CHECK(rejection_mode IN ('immediate','central')),
 strict_receipts boolean NOT NULL DEFAULT false,
 opened_at timestamptz, opened_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);
CREATE TABLE public.laundry_cycle_scope (
 property_id uuid PRIMARY KEY REFERENCES public.properties(id) ON DELETE RESTRICT,
 sede_id uuid NOT NULL REFERENCES public.sedes(id) ON DELETE RESTRICT
);
CREATE TABLE public.laundry_cycle_products (
 sede_id uuid NOT NULL REFERENCES public.sedes(id),product_id uuid NOT NULL REFERENCES public.stock_products(id),PRIMARY KEY(sede_id,product_id)
);
CREATE TABLE public.laundry_cycle_openings (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), sede_id uuid NOT NULL REFERENCES public.sedes(id),
 product_id uuid NOT NULL REFERENCES public.stock_products(id),
 warehouse_id uuid REFERENCES public.stock_warehouses(id), property_id uuid REFERENCES public.properties(id),
 kind text NOT NULL CHECK(kind IN ('clean','installed','dirty','outside','rejected','collected')),
 quantity numeric NOT NULL CHECK(quantity>=0 AND quantity=trunc(quantity)),
 measured_at timestamptz NOT NULL, recorded_by uuid REFERENCES auth.users(id),
 UNIQUE NULLS NOT DISTINCT(sede_id,product_id,warehouse_id,property_id,kind)
);
CREATE TABLE public.laundry_cycle_bags (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), task_key uuid NOT NULL UNIQUE,
 task_id uuid REFERENCES public.tasks(id) ON DELETE SET NULL,
 property_id uuid NOT NULL REFERENCES public.properties(id), sede_id uuid NOT NULL REFERENCES public.sedes(id),
 property_code text NOT NULL, central_id uuid NOT NULL REFERENCES public.stock_warehouses(id),
 generation integer NOT NULL DEFAULT 1,
 destination_id uuid REFERENCES public.stock_warehouses(id),
 state text NOT NULL CHECK(state IN ('prepared','delivered','used','released','returned')),
 lines jsonb NOT NULL, prepared_at timestamptz NOT NULL DEFAULT now(), delivered_at timestamptz, used_at timestamptz
);
CREATE TABLE public.laundry_cycle_dirty (
 property_id uuid NOT NULL REFERENCES public.properties(id), product_id uuid NOT NULL REFERENCES public.stock_products(id),
 sede_id uuid NOT NULL REFERENCES public.sedes(id), warehouse_id uuid REFERENCES public.stock_warehouses(id),
 quantity numeric NOT NULL CHECK(quantity>=0), PRIMARY KEY(property_id,product_id)
);
CREATE TABLE public.laundry_cycle_pool (
 sede_id uuid NOT NULL REFERENCES public.sedes(id), product_id uuid NOT NULL REFERENCES public.stock_products(id),
 quantity numeric NOT NULL CHECK(quantity>=0), PRIMARY KEY(sede_id,product_id)
);
CREATE TABLE public.laundry_cycle_collected (
 sede_id uuid NOT NULL REFERENCES public.sedes(id),product_id uuid NOT NULL REFERENCES public.stock_products(id),quantity numeric NOT NULL CHECK(quantity>=0),PRIMARY KEY(sede_id,product_id)
);
CREATE TABLE public.laundry_cycle_dirty_sets (
 task_key uuid PRIMARY KEY, property_id uuid NOT NULL REFERENCES public.properties(id),
 sede_id uuid NOT NULL REFERENCES public.sedes(id), lines jsonb NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(), collected_at timestamptz
);
CREATE TABLE public.laundry_cycle_events (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), operation_key text NOT NULL UNIQUE,
 sede_id uuid NOT NULL REFERENCES public.sedes(id), task_id uuid REFERENCES public.tasks(id) ON DELETE SET NULL,
 task_key uuid, property_id uuid REFERENCES public.properties(id),
 kind text NOT NULL, payload jsonb NOT NULL DEFAULT '{}', happened_at timestamptz NOT NULL DEFAULT now(), actor_user_id uuid DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE SET NULL
);
CREATE TABLE public.laundry_cycle_issues (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), sede_id uuid NOT NULL REFERENCES public.sedes(id),
 task_key uuid, code text NOT NULL, detail text NOT NULL, resolved_at timestamptz,
 UNIQUE NULLS NOT DISTINCT(sede_id,task_key,code)
);
CREATE INDEX laundry_cycle_bags_pending ON public.laundry_cycle_bags(sede_id,central_id,destination_id) WHERE state IN ('prepared','delivered');
CREATE INDEX laundry_cycle_dirty_sets_pending ON public.laundry_cycle_dirty_sets(property_id,created_at,task_key) WHERE collected_at IS NULL;
CREATE INDEX laundry_cycle_events_history ON public.laundry_cycle_events(sede_id,happened_at DESC);
-- No client DML. All writes use checked RPCs or service-only wrappers.
DO $$
DECLARE t text;
BEGIN
 FOREACH t IN ARRAY ARRAY['laundry_cycle_config','laundry_cycle_scope','laundry_cycle_products','laundry_cycle_openings','laundry_cycle_bags','laundry_cycle_dirty','laundry_cycle_pool','laundry_cycle_collected','laundry_cycle_dirty_sets','laundry_cycle_events','laundry_cycle_issues'] LOOP
  EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',t);
  EXECUTE format('REVOKE ALL ON public.%I FROM PUBLIC,anon,authenticated',t);
  EXECUTE format('GRANT SELECT ON public.%I TO authenticated',t);
  EXECUTE format('GRANT ALL ON public.%I TO service_role',t);
  EXECUTE format('CREATE POLICY cycle_sede_read ON public.%I FOR SELECT TO authenticated USING (sede_id=ANY(public.get_user_stock_sedes()) AND EXISTS(SELECT 1 FROM public.user_roles WHERE user_id=auth.uid() AND role::text IN (''admin'',''manager'',''logistics'',''supervisor'')))',t);
 END LOOP;
END $$;

CREATE FUNCTION public.laundry_cycle_admin(_sede uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF auth.uid() IS NULL OR NOT (_sede=ANY(public.get_user_stock_sedes())) OR NOT EXISTS(
  SELECT 1 FROM public.user_roles WHERE user_id=auth.uid() AND role::text IN ('admin','manager')
 ) THEN RAISE EXCEPTION 'No tienes permiso para preparar esta sede' USING ERRCODE='42501'; END IF;
END $$;

CREATE FUNCTION public.laundry_cycle_eligible(_task uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT EXISTS(SELECT 1 FROM public.tasks t JOIN public.laundry_cycle_config c ON c.sede_id=t.sede_id AND c.active
 JOIN public.laundry_cycle_scope s ON s.property_id=t.propiedad_id AND s.sede_id=t.sede_id
 JOIN public.properties p ON p.id=t.propiedad_id LEFT JOIN public.clients cl ON cl.id=p.cliente_id
 WHERE t.id=_task AND t.date>=c.start_date AND t.type='limpieza-turistica'
 AND p.sede_id=t.sede_id
 AND coalesce(p.is_active,cl.is_active,false) AND coalesce(p.linen_control_enabled,cl.linen_control_enabled,false));
$$;

CREATE FUNCTION public.laundry_cycle_lines(_task uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE result jsonb;
BEGIN
 SELECT jsonb_agg(jsonb_build_object('productId',q.product_id,'quantity',q.quantity) ORDER BY q.product_id)
 INTO result FROM (SELECT product_id,sum(quantity) quantity FROM public.resolve_laundry_bag_lines(_task) GROUP BY product_id) q;
 IF result IS NULL OR EXISTS(SELECT 1 FROM jsonb_to_recordset(result) x("productId" uuid,quantity numeric)
 WHERE quantity<=0 OR quantity<>trunc(quantity) OR quantity::text IN ('NaN','Infinity','-Infinity')) THEN
 RAISE EXCEPTION 'Dotación de lencería vacía o inválida'; END IF;
 IF EXISTS(SELECT 1 FROM jsonb_to_recordset(result) x("productId" uuid,quantity numeric)
 JOIN public.tasks t ON t.id=_task LEFT JOIN public.stock_products p ON p.id=x."productId" AND p.sede_id=t.sede_id AND p.is_active
 WHERE p.id IS NULL) THEN RAISE EXCEPTION 'Producto de otra sede o desactivado'; END IF;
 RETURN result;
END $$;

CREATE FUNCTION public.laundry_cycle_destination(_property uuid,_sede uuid) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE n integer; result uuid;
BEGIN
 SELECT count(DISTINCT w.id),min(w.id::text)::uuid INTO n,result FROM public.property_group_assignments a
 JOIN public.stock_warehouses w ON w.property_group_id=a.property_group_id AND w.sede_id=_sede AND w.is_active AND w.location_type='building_storage'
 WHERE a.property_id=_property;
 IF n>1 THEN RAISE EXCEPTION 'La propiedad tiene varios trasteros posibles'; END IF;
 RETURN result; -- NULL is a direct delivery, never a fabricated warehouse.
END $$;

CREATE FUNCTION public.laundry_cycle_reserved(_warehouse uuid,_product uuid,_except uuid DEFAULT NULL) RETURNS numeric
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT coalesce(sum(x.quantity),0) FROM public.laundry_cycle_bags b,
 jsonb_to_recordset(b.lines) x("productId" uuid,quantity numeric)
 WHERE x."productId"=_product AND b.id IS DISTINCT FROM _except
 AND ((b.state='prepared' AND b.central_id=_warehouse) OR (b.state='delivered' AND b.destination_id=_warehouse));
$$;

CREATE FUNCTION public.laundry_cycle_stock_guard() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF TG_OP='DELETE' THEN
  IF public.laundry_cycle_reserved(OLD.warehouse_id,OLD.product_id)>0 THEN RAISE EXCEPTION 'Hay ropa reservada: no se puede borrar el saldo'; END IF;
  RETURN OLD;
 END IF;
 IF NEW.current_quantity::text IN ('NaN','Infinity','-Infinity') THEN RAISE EXCEPTION 'Saldo de ropa no válido'; END IF;
 IF NEW.current_quantity<public.laundry_cycle_reserved(NEW.warehouse_id,NEW.product_id) THEN
 RAISE EXCEPTION 'Hay ropa reservada en bolsas: resuelve esas bolsas antes de reducir el stock'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER laundry_cycle_stock_guard BEFORE UPDATE OF current_quantity OR DELETE ON public.stock_levels
FOR EACH ROW EXECUTE FUNCTION public.laundry_cycle_stock_guard();

CREATE FUNCTION public.laundry_cycle_move(_product uuid,_warehouse uuid,_delta numeric,_task uuid,_property uuid,_reason text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE before numeric;
BEGIN
 IF _delta=0 THEN RETURN; END IF;
 INSERT INTO public.stock_levels(product_id,warehouse_id,current_quantity) VALUES(_product,_warehouse,0) ON CONFLICT DO NOTHING;
 SELECT current_quantity INTO STRICT before FROM public.stock_levels WHERE product_id=_product AND warehouse_id=_warehouse FOR UPDATE;
 IF before+_delta<0 THEN RAISE EXCEPTION 'No hay suficiente ropa limpia'; END IF;
 UPDATE public.stock_levels SET current_quantity=before+_delta,last_updated=now() WHERE product_id=_product AND warehouse_id=_warehouse;
 INSERT INTO public.stock_movements(product_id,warehouse_id,movement_type,quantity,previous_quantity,new_quantity,reason,task_id,property_id)
 VALUES(_product,_warehouse,CASE WHEN _delta>0 THEN 'entrada'::public.stock_movement_type ELSE 'salida'::public.stock_movement_type END,
 abs(_delta),before,before+_delta,_reason,_task,_property);
END $$;

CREATE FUNCTION public.laundry_cycle_dirty_lines(_property uuid,_sede uuid) RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT CASE WHEN c.collection_mode='one' THEN coalesce((SELECT lines FROM public.laundry_cycle_dirty_sets WHERE property_id=_property AND sede_id=_sede AND collected_at IS NULL ORDER BY created_at,task_key LIMIT 1),'[]'::jsonb)
 ELSE coalesce((SELECT jsonb_agg(jsonb_build_object('productId',product_id,'quantity',quantity) ORDER BY product_id) FROM public.laundry_cycle_dirty WHERE property_id=_property AND sede_id=_sede AND quantity>0),'[]'::jsonb) END
 FROM public.laundry_cycle_config c WHERE sede_id=_sede;
$$;

CREATE FUNCTION public.laundry_cycle_route(_task uuid,_link uuid,_action text,_worker uuid,_cleaner uuid,_name text,_snapshot jsonb DEFAULT NULL,_issue text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE t public.tasks; c public.laundry_cycle_config; l public.laundry_share_links;
 b public.laundry_cycle_bags; line record; content jsonb; dest uuid; available numeric; dirty record; dirty_set public.laundry_cycle_dirty_sets; processed integer:=0; key text; event_id uuid; collected_lines jsonb:='[]';
BEGIN
 IF _action NOT IN ('prepare','collect','deliver','issue') THEN RAISE EXCEPTION 'Acción inválida'; END IF;
 SELECT * INTO STRICT l FROM public.laundry_share_links WHERE id=_link AND is_active AND workflow_version='route_v2'
 AND (expires_at IS NULL OR expires_at>now()) FOR UPDATE;
 SELECT * INTO STRICT t FROM public.tasks WHERE id=_task FOR UPDATE;
 IF NOT public.laundry_cycle_eligible(_task) THEN RAISE EXCEPTION 'Tarea fuera del circuito activo'; END IF;
 SELECT * INTO STRICT c FROM public.laundry_cycle_config WHERE sede_id=t.sede_id FOR UPDATE;
 IF t.sede_id<>l.sede_id OR t.status='cancelled' OR NOT (_task=ANY(l.snapshot_task_ids)) THEN RAISE EXCEPTION 'Tarea fuera de la ruta'; END IF;
 IF NOT EXISTS(SELECT 1 FROM jsonb_array_elements_text(coalesce(l.filters->'routeDates','[]')) d WHERE d.value=t.date::text)
 AND NOT (_action IN ('prepare','issue') AND EXISTS(SELECT 1 FROM jsonb_array_elements_text(coalesce(l.filters->'nextRouteDates','[]')) d WHERE d.value=t.date::text))
 THEN RAISE EXCEPTION 'La fecha de la tarea ya no pertenece a esta ruta'; END IF;
 IF _worker IS NULL OR NOT EXISTS(SELECT 1 FROM public.laundry_route_workers WHERE id=_worker AND cleaner_id=_cleaner AND sede_id=t.sede_id AND is_active)
 THEN RAISE EXCEPTION 'Identifícate con tu PIN para mover ropa'; END IF;
 IF _snapshot->>'propertyId' IS DISTINCT FROM t.propiedad_id::text OR _snapshot->>'date' IS DISTINCT FROM t.date::text THEN RAISE EXCEPTION 'La tarea cambió: recarga la ruta antes de confirmar'; END IF;
 SELECT * INTO b FROM public.laundry_cycle_bags WHERE task_key=_task FOR UPDATE;
 IF b.id IS NOT NULL AND (b.sede_id<>t.sede_id OR b.property_id<>t.propiedad_id AND b.state NOT IN ('released','returned')) THEN RAISE EXCEPTION 'La propiedad cambió: resuelve físicamente la bolsa anterior'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.stock_warehouses WHERE id=c.central_id AND sede_id=c.sede_id AND is_active) THEN RAISE EXCEPTION 'El almacén central ya no está disponible'; END IF;
 IF _action='issue' THEN
 PERFORM public.upsert_laundry_route_preparation_checked(_task,_link,'issue',_issue,_worker,_cleaner,_name,NULL);
 INSERT INTO public.laundry_cycle_issues(sede_id,task_key,code,detail) VALUES(t.sede_id,_task,'route_issue','Incidencia de bolsa; se conserva su reserva física')
 ON CONFLICT(sede_id,task_key,code) DO UPDATE SET detail=EXCLUDED.detail,resolved_at=NULL;
 INSERT INTO public.laundry_cycle_events(operation_key,sede_id,task_id,task_key,property_id,kind,payload)
 VALUES('route_issue:'||_task||':'||coalesce(b.generation,0)||':'||md5(coalesce(_issue,'')),t.sede_id,_task,_task,t.propiedad_id,'route_issue',jsonb_build_object('reason',_issue,'workerId',_worker,'worker',_name)) ON CONFLICT(operation_key) DO NOTHING RETURNING id INTO event_id;
 IF event_id IS NOT NULL THEN INSERT INTO public.laundry_route_worker_events(share_link_id,task_id,route_worker_id,worker_name,action,details) VALUES(_link,_task,_worker,_name,'issue',jsonb_build_object('cycle_event_id',event_id,'reason',_issue)); END IF;
 RETURN jsonb_build_object('processed',0,'reserved',b.state='prepared');
 END IF;
 key:='route:'||_link||':'||_task||':'||_action;
 IF _action='collect' THEN key:='collection:'||_task||':'||t.propiedad_id; END IF;
 IF _action='deliver' THEN key:=key||':'||coalesce(b.generation,0); END IF;
 IF EXISTS(SELECT 1 FROM public.laundry_cycle_events WHERE operation_key=key) THEN RETURN jsonb_build_object('processed',0,'replayed',true); END IF;
 IF _action='collect' THEN
  IF _snapshot->'dirtyLines' IS DISTINCT FROM public.laundry_cycle_dirty_lines(t.propiedad_id,t.sede_id) THEN RAISE EXCEPTION 'La sucia cambió: recarga antes de confirmar la recogida'; END IF;
 ELSIF coalesce((_snapshot->>'cycleGeneration')::integer,0)<>coalesce(b.generation,0) THEN
  IF _action='prepare' AND b.state='prepared' AND b.lines=_snapshot->'cycleLines' AND coalesce((_snapshot->>'cycleGeneration')::integer,0)+1=b.generation THEN RETURN jsonb_build_object('processed',0,'replayed',true); END IF;
  RAISE EXCEPTION 'La bolsa cambió: recarga antes de confirmar';
 END IF;
 IF _action='prepare' THEN
 IF t.status='completed' THEN RAISE EXCEPTION 'La limpieza ya está completada'; END IF;
 IF b.state IN ('delivered','used') THEN RAISE EXCEPTION 'La bolsa ya se entregó; conserva su historial'; END IF;
 content:=public.laundry_cycle_lines(_task); dest:=public.laundry_cycle_destination(t.propiedad_id,t.sede_id);
 IF _snapshot->'cycleLines' IS DISTINCT FROM content THEN RAISE EXCEPTION 'La dotación cambió después de abrir la ruta: recarga antes de preparar'; END IF;
 FOR line IN SELECT * FROM jsonb_to_recordset(content) x("productId" uuid,quantity numeric) ORDER BY "productId" LOOP
  SELECT current_quantity INTO available FROM public.stock_levels WHERE product_id=line."productId" AND warehouse_id=c.central_id FOR UPDATE;
  IF available IS NULL OR available-public.laundry_cycle_reserved(c.central_id,line."productId",b.id)<line.quantity THEN RAISE EXCEPTION 'No hay suficiente ropa limpia disponible para preparar toda la bolsa'; END IF;
 END LOOP;
 INSERT INTO public.laundry_cycle_bags(task_key,task_id,property_id,sede_id,property_code,central_id,destination_id,state,lines)
 VALUES(_task,_task,t.propiedad_id,t.sede_id,(SELECT codigo FROM public.properties WHERE id=t.propiedad_id),c.central_id,dest,'prepared',content)
 ON CONFLICT(task_key) DO UPDATE SET state='prepared',lines=EXCLUDED.lines,destination_id=EXCLUDED.destination_id,prepared_at=now(),property_id=EXCLUDED.property_id,property_code=EXCLUDED.property_code,task_id=EXCLUDED.task_id,central_id=EXCLUDED.central_id,
 generation=CASE WHEN public.laundry_cycle_bags.state IN ('released','returned') OR public.laundry_cycle_bags.lines IS DISTINCT FROM EXCLUDED.lines THEN public.laundry_cycle_bags.generation+1 ELSE public.laundry_cycle_bags.generation END
 RETURNING * INTO b;
 PERFORM public.upsert_laundry_route_preparation_checked(_task,_link,'prepare',NULL,_worker,_cleaner,_name,_snapshot);
 INSERT INTO public.laundry_cycle_events(operation_key,sede_id,task_id,task_key,property_id,kind,payload)
 VALUES('preparation:'||_task||':'||b.generation,t.sede_id,_task,_task,t.propiedad_id,'prepared',jsonb_build_object('lines',b.lines,'snapshot',_snapshot,'workerId',_worker,'cleanerId',_cleaner,'worker',_name)) ON CONFLICT(operation_key) DO NOTHING RETURNING id INTO event_id;
 IF event_id IS NOT NULL THEN INSERT INTO public.laundry_route_worker_events(share_link_id,task_id,route_worker_id,worker_name,action,details) VALUES(_link,_task,_worker,_name,'prepare',jsonb_build_object('cycle_event_id',event_id)); END IF;
 UPDATE public.laundry_cycle_issues SET resolved_at=now() WHERE task_key=_task AND code='route_issue';
 RETURN jsonb_build_object('processed',jsonb_array_length(content),'reserved',true);
 ELSIF _action='deliver' THEN
 IF b.state IN ('delivered','used') THEN RETURN jsonb_build_object('processed',0,'replayed',true); END IF;
 IF b.state IS DISTINCT FROM 'prepared' THEN RAISE EXCEPTION 'Prepara la bolsa antes de entregarla'; END IF;
 IF b.property_id<>t.propiedad_id OR b.lines<>public.laundry_cycle_lines(_task)
 OR b.destination_id IS DISTINCT FROM public.laundry_cycle_destination(t.propiedad_id,t.sede_id)
 THEN RAISE EXCEPTION 'La dotación o el destino cambiaron después de preparar'; END IF;
 UPDATE public.laundry_cycle_bags SET state='delivered',delivered_at=now() WHERE id=b.id;
 FOR line IN SELECT * FROM jsonb_to_recordset(b.lines) x("productId" uuid,quantity numeric) ORDER BY "productId" LOOP
  PERFORM public.laundry_cycle_move(line."productId",b.central_id,-line.quantity,_task,b.property_id,'Entrega de muda desde central');
  IF b.destination_id IS NOT NULL THEN PERFORM public.laundry_cycle_move(line."productId",b.destination_id,line.quantity,_task,b.property_id,'Muda recibida en trastero'); END IF;
 END LOOP;
 processed:=jsonb_array_length(b.lines);
 ELSE
 -- Collection mode is explicitly selected with Dani, never assumed at activation.
 IF c.collection_mode IS NULL THEN RAISE EXCEPTION 'Falta confirmar el modo de recogida'; END IF;
 IF c.collection_mode='one' THEN
  SELECT * INTO dirty_set FROM public.laundry_cycle_dirty_sets WHERE property_id=t.propiedad_id AND collected_at IS NULL ORDER BY created_at,task_key LIMIT 1 FOR UPDATE;
 END IF;
 FOR dirty IN SELECT * FROM public.laundry_cycle_dirty WHERE property_id=t.propiedad_id AND quantity>0 ORDER BY product_id FOR UPDATE LOOP
  -- A single set uses the removed linen snapshot, never today's possibly changed dotation.
  available:=dirty.quantity;
  IF c.collection_mode='one' THEN
   SELECT quantity INTO available FROM jsonb_to_recordset(coalesce(dirty_set.lines,'[]')) x("productId" uuid,quantity numeric) WHERE x."productId"=dirty.product_id;
   IF available IS NULL THEN CONTINUE; END IF;
   IF available>dirty.quantity THEN RAISE EXCEPTION 'La muda sucia no coincide con el saldo'; END IF;
  END IF;
  UPDATE public.laundry_cycle_dirty SET quantity=quantity-available WHERE property_id=dirty.property_id AND product_id=dirty.product_id;
  IF dirty.warehouse_id IS NOT NULL THEN
   UPDATE public.laundry_dirty_stock SET current_quantity=current_quantity-available WHERE warehouse_id=dirty.warehouse_id AND product_id=dirty.product_id AND current_quantity>=available;
   IF NOT FOUND THEN RAISE EXCEPTION 'El saldo sucio del trastero no coincide con las propiedades'; END IF;
  END IF;
  IF c.collection_destination='central' THEN
   INSERT INTO public.laundry_cycle_collected(sede_id,product_id,quantity) VALUES(t.sede_id,dirty.product_id,available)
   ON CONFLICT(sede_id,product_id) DO UPDATE SET quantity=public.laundry_cycle_collected.quantity+EXCLUDED.quantity;
  ELSE
   INSERT INTO public.laundry_cycle_pool(sede_id,product_id,quantity) VALUES(t.sede_id,dirty.product_id,available)
   ON CONFLICT(sede_id,product_id) DO UPDATE SET quantity=public.laundry_cycle_pool.quantity+EXCLUDED.quantity;
  END IF;
  collected_lines:=collected_lines||jsonb_build_array(jsonb_build_object('productId',dirty.product_id,'quantity',available));
  processed:=processed+1;
 END LOOP;
 UPDATE public.laundry_cycle_dirty_sets SET collected_at=now() WHERE property_id=t.propiedad_id AND collected_at IS NULL AND (c.collection_mode='all' OR task_key=dirty_set.task_key);
 END IF;
 INSERT INTO public.laundry_cycle_events(operation_key,sede_id,task_id,task_key,property_id,kind,payload)
 VALUES(key,t.sede_id,_task,_task,t.propiedad_id,_action,jsonb_build_object('lines',b.lines,'processed',processed,'collectedLines',collected_lines,'worker',_name,'workerId',_worker,'cleanerId',_cleaner)) RETURNING id INTO event_id;
 INSERT INTO public.laundry_delivery_tracking(share_link_id,task_id,status,collection_status,delivered_at,collected_at,delivered_by_name,collected_by_name,delivered_by_worker_id,collected_by_worker_id)
 VALUES(_link,_task,CASE WHEN _action='deliver' OR b.state IN ('delivered','used') THEN 'delivered'::public.laundry_delivery_status ELSE 'pending'::public.laundry_delivery_status END,
 CASE WHEN _action='collect' THEN 'collected' ELSE 'pending' END,CASE WHEN _action='deliver' THEN now() END,CASE WHEN _action='collect' THEN now() END,
 CASE WHEN _action='deliver' THEN _name END,CASE WHEN _action='collect' THEN _name END,CASE WHEN _action='deliver' THEN _cleaner END,CASE WHEN _action='collect' THEN _cleaner END)
 ON CONFLICT(share_link_id,task_id) DO UPDATE SET
 status=CASE WHEN _action='deliver' THEN EXCLUDED.status ELSE public.laundry_delivery_tracking.status END,
 collection_status=CASE WHEN _action='collect' THEN EXCLUDED.collection_status ELSE public.laundry_delivery_tracking.collection_status END,
 delivered_at=coalesce(public.laundry_delivery_tracking.delivered_at,EXCLUDED.delivered_at),
 collected_at=coalesce(public.laundry_delivery_tracking.collected_at,EXCLUDED.collected_at),
 delivered_by_name=coalesce(public.laundry_delivery_tracking.delivered_by_name,EXCLUDED.delivered_by_name),collected_by_name=coalesce(public.laundry_delivery_tracking.collected_by_name,EXCLUDED.collected_by_name),
 delivered_by_worker_id=coalesce(public.laundry_delivery_tracking.delivered_by_worker_id,EXCLUDED.delivered_by_worker_id),collected_by_worker_id=coalesce(public.laundry_delivery_tracking.collected_by_worker_id,EXCLUDED.collected_by_worker_id);

 INSERT INTO public.laundry_route_worker_events(share_link_id,task_id,route_worker_id,worker_name,action,details) VALUES(_link,_task,_worker,_name,_action,jsonb_build_object('cycle_event_id',event_id));
 RETURN jsonb_build_object('processed',processed);
END $$;

CREATE FUNCTION public.laundry_cycle_complete(_task uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE t public.tasks; b public.laundry_cycle_bags; line record; old_quantity numeric; key text; removed jsonb:='[]';
BEGIN
 SELECT * INTO STRICT t FROM public.tasks WHERE id=_task FOR UPDATE;
 IF t.status<>'completed' OR NOT public.laundry_cycle_eligible(_task) THEN RETURN jsonb_build_object('processed',0); END IF;
 PERFORM 1 FROM public.laundry_cycle_config WHERE sede_id=t.sede_id FOR UPDATE;
 key:='cleaning:'||_task;
 IF EXISTS(SELECT 1 FROM public.laundry_cycle_events WHERE operation_key=key) THEN RETURN jsonb_build_object('processed',0,'replayed',true); END IF;
 SELECT * INTO b FROM public.laundry_cycle_bags WHERE task_key=_task FOR UPDATE;
 IF b.id IS NULL OR b.state<>'delivered' OR b.property_id<>t.propiedad_id THEN RAISE EXCEPTION 'Falta la entrega de esta muda'; END IF;
 UPDATE public.laundry_cycle_bags SET state='used',used_at=now() WHERE id=b.id;
 FOR line IN SELECT x."productId",x.quantity FROM jsonb_to_recordset(b.lines) x("productId" uuid,quantity numeric)
 UNION ALL SELECT a.product_id,0 FROM public.laundry_apartment_stock a JOIN public.laundry_cycle_products cp ON cp.product_id=a.product_id AND cp.sede_id=b.sede_id
 WHERE a.property_id=b.property_id AND a.current_quantity>0 AND NOT EXISTS(SELECT 1 FROM jsonb_to_recordset(b.lines) x("productId" uuid,quantity numeric) WHERE x."productId"=a.product_id)
 ORDER BY "productId" LOOP
  IF NOT EXISTS(SELECT 1 FROM public.laundry_cycle_openings WHERE property_id=b.property_id AND product_id=line."productId" AND kind='installed') THEN RAISE EXCEPTION 'Falta contar la ropa instalada'; END IF;
  SELECT current_quantity INTO STRICT old_quantity FROM public.laundry_apartment_stock WHERE property_id=b.property_id AND product_id=line."productId" FOR UPDATE;
  IF old_quantity>0 THEN removed:=removed||jsonb_build_array(jsonb_build_object('productId',line."productId",'quantity',old_quantity)); END IF;
  IF b.destination_id IS NOT NULL THEN PERFORM public.laundry_cycle_move(line."productId",b.destination_id,-line.quantity,_task,b.property_id,'Cambio de muda en limpieza'); END IF;
  UPDATE public.laundry_apartment_stock SET current_quantity=line.quantity,updated_at=now() WHERE property_id=b.property_id AND product_id=line."productId";
  INSERT INTO public.laundry_cycle_dirty(property_id,product_id,sede_id,warehouse_id,quantity)
  VALUES(b.property_id,line."productId",b.sede_id,b.destination_id,old_quantity)
  ON CONFLICT(property_id,product_id) DO UPDATE SET quantity=public.laundry_cycle_dirty.quantity+EXCLUDED.quantity;
  IF b.destination_id IS NOT NULL AND old_quantity>0 THEN
   INSERT INTO public.laundry_dirty_stock(product_id,warehouse_id,current_quantity) VALUES(line."productId",b.destination_id,old_quantity)
   ON CONFLICT(product_id,warehouse_id) DO UPDATE SET current_quantity=public.laundry_dirty_stock.current_quantity+EXCLUDED.current_quantity;
  END IF;
 END LOOP;
 IF jsonb_array_length(removed)>0 THEN INSERT INTO public.laundry_cycle_dirty_sets(task_key,property_id,sede_id,lines) VALUES(_task,b.property_id,b.sede_id,removed); END IF;
 INSERT INTO public.laundry_cycle_events(operation_key,sede_id,task_id,task_key,property_id,kind,payload)
 VALUES(key,t.sede_id,_task,_task,t.propiedad_id,'cleaning',jsonb_build_object('replacement',b.lines));
 UPDATE public.laundry_cycle_issues SET resolved_at=now() WHERE task_key=_task AND code='cleaning_failed';
 RETURN jsonb_build_object('processed',jsonb_array_length(b.lines));
END $$;

CREATE FUNCTION public.laundry_cycle_task_trigger() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF TG_OP='UPDATE' AND (OLD.propiedad_id IS DISTINCT FROM NEW.propiedad_id OR OLD.sede_id IS DISTINCT FROM NEW.sede_id OR OLD.date IS DISTINCT FROM NEW.date OR OLD.type IS DISTINCT FROM NEW.type)
 AND EXISTS(SELECT 1 FROM public.laundry_cycle_bags WHERE task_key=NEW.id AND state IN ('prepared','delivered','used')) THEN
  INSERT INTO public.laundry_cycle_issues(sede_id,task_key,code,detail)
  SELECT sede_id,NEW.id,'task_changed','La fecha o propiedad cambió: revisa la bolsa; se conservan sus movimientos físicos' FROM public.laundry_cycle_bags WHERE task_key=NEW.id
  ON CONFLICT(sede_id,task_key,code) DO UPDATE SET detail=EXCLUDED.detail,resolved_at=NULL;
 END IF;
 IF NEW.status='completed' AND NOT public.laundry_cycle_eligible(NEW.id) AND EXISTS(SELECT 1 FROM public.laundry_cycle_bags WHERE task_key=NEW.id AND state IN ('prepared','delivered')) THEN
  INSERT INTO public.laundry_cycle_issues(sede_id,task_key,code,detail)
  SELECT sede_id,NEW.id,'cleaning_failed','La limpieza se completó fuera del alcance actual; revisa el control de lencería y la bolsa antes de reintentar' FROM public.laundry_cycle_bags WHERE task_key=NEW.id
  ON CONFLICT(sede_id,task_key,code) DO UPDATE SET detail=EXCLUDED.detail,resolved_at=NULL;
 END IF;
 IF public.laundry_cycle_eligible(NEW.id) THEN
  IF NEW.status='completed' THEN
   BEGIN PERFORM public.laundry_cycle_complete(NEW.id);
   EXCEPTION WHEN OTHERS THEN
    INSERT INTO public.laundry_cycle_issues(sede_id,task_key,code,detail) VALUES(NEW.sede_id,NEW.id,'cleaning_failed',SQLERRM)
    ON CONFLICT(sede_id,task_key,code) DO UPDATE SET detail=EXCLUDED.detail,resolved_at=NULL;
   END;
  ELSIF NEW.status='cancelled' OR (TG_OP='UPDATE' AND OLD.status='completed' AND NEW.status<>'completed') THEN
   INSERT INTO public.laundry_cycle_issues(sede_id,task_key,code,detail) VALUES(NEW.sede_id,NEW.id,'task_changed','Tarea cancelada o reabierta: conserva los movimientos físicos y revisa la bolsa')
   ON CONFLICT(sede_id,task_key,code) DO UPDATE SET detail=EXCLUDED.detail,resolved_at=NULL;
  END IF;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER laundry_cycle_task AFTER INSERT OR UPDATE OF status,date,propiedad_id,sede_id,type ON public.tasks
FOR EACH ROW EXECUTE FUNCTION public.laundry_cycle_task_trigger();

CREATE TABLE public.laundry_cycle_receipt_postings (
 receipt_id uuid NOT NULL REFERENCES public.laundry_receipts(id), product_id uuid NOT NULL REFERENCES public.stock_products(id),
 sede_id uuid NOT NULL REFERENCES public.sedes(id), accepted numeric NOT NULL, pooled numeric NOT NULL, rejected numeric NOT NULL DEFAULT 0, quarantined numeric NOT NULL DEFAULT 0,
 PRIMARY KEY(receipt_id,product_id), CHECK(accepted>=0 AND pooled>=0 AND pooled<=accepted AND rejected>=0 AND quarantined>=0 AND quarantined<=rejected)
);
ALTER TABLE public.laundry_cycle_receipt_postings ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.laundry_cycle_receipt_postings FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.laundry_cycle_receipt_postings TO authenticated;
GRANT ALL ON public.laundry_cycle_receipt_postings TO service_role;
CREATE POLICY cycle_sede_read ON public.laundry_cycle_receipt_postings FOR SELECT TO authenticated
USING(sede_id=ANY(public.get_user_stock_sedes()) AND EXISTS(SELECT 1 FROM public.user_roles WHERE user_id=auth.uid() AND role::text IN ('admin','manager','logistics','supervisor')));
ALTER TABLE public.laundry_cycle_openings ADD COLUMN prepared_quantity numeric NOT NULL DEFAULT 0 CHECK(prepared_quantity>=0 AND prepared_quantity<=quantity);

-- The exact existing operation remains responsible for receipt versions, clean
-- stock deltas and email outbox. No second clean-stock writer is introduced.
ALTER FUNCTION public.apply_laundry_receipt_operation(uuid,uuid,uuid,text,date,uuid,jsonb)
RENAME TO apply_laundry_receipt_operation_before_cycle;
CREATE FUNCTION public.apply_laundry_receipt_operation(_link uuid,_worker uuid,_admin uuid,_actor_name text,_date date,_op_id uuid,_payload jsonb)
RETURNS jsonb LANGUAGE plpgsql SET search_path=public,pg_temp AS $$
DECLARE result jsonb; c public.laundry_cycle_config; r public.laundry_receipts; l public.laundry_receipt_links;
 old public.laundry_cycle_receipt_postings; item record; current_pool numeric; delta numeric; matched numeric; new_pooled numeric; key text; previous_counts jsonb; reject_delta numeric; new_rejected numeric; new_quarantined numeric; quarantine_balance numeric; returned numeric;
BEGIN
 -- Same lock order as mutate_laundry_receipt: receipt link, configuration,
 -- then stock. Taking configuration only after the legacy stock write would
 -- deadlock with route delivery or cleaner completion.
 SELECT * INTO STRICT l FROM public.laundry_receipt_links WHERE id=_link FOR UPDATE;
 SELECT * INTO c FROM public.laundry_cycle_config WHERE central_id=l.warehouse_id AND active FOR UPDATE;
 SELECT * INTO r FROM public.laundry_receipts WHERE link_id=_link AND receipt_date=_date FOR UPDATE;
 -- Pre-opening confirmed quantities are already included in the absolute count.
 -- Editing them now would apply an old delta a second time. Metadata corrections
 -- remain allowed, but physical changes require a fresh explicit stock count.
 IF c.sede_id IS NOT NULL AND r.latest_version>0 AND NOT EXISTS(SELECT 1 FROM public.laundry_cycle_receipt_postings WHERE receipt_id=r.id) THEN
  SELECT snapshot->'counts' INTO previous_counts FROM public.laundry_receipt_versions WHERE receipt_id=r.id AND version=r.latest_version;
  IF _payload->>'action'='confirm' AND r.counts IS DISTINCT FROM previous_counts THEN RAISE EXCEPTION 'Esta recepción es anterior al recuento inicial: corrige las existencias mediante un recuento físico'; END IF;
  result:=public.apply_laundry_receipt_operation_before_cycle(_link,_worker,_admin,_actor_name,_date,_op_id,_payload);
  RETURN result;
 END IF;
 result:=public.apply_laundry_receipt_operation_before_cycle(_link,_worker,_admin,_actor_name,_date,_op_id,_payload);
 IF _payload->>'action'<>'confirm' OR coalesce((result->>'unchanged')::boolean,false) THEN RETURN result; END IF;
 SELECT * INTO l FROM public.laundry_receipt_links WHERE id=_link;
 SELECT * INTO c FROM public.laundry_cycle_config WHERE central_id=l.warehouse_id AND active FOR UPDATE;
 IF c.sede_id IS NULL THEN RETURN result; END IF;
 key:='receipt:'||(result->>'versionId');
 IF EXISTS(SELECT 1 FROM public.laundry_cycle_events WHERE operation_key=key) THEN RETURN result; END IF;
 SELECT * INTO STRICT r FROM public.laundry_receipts WHERE link_id=_link AND receipt_date=_date FOR UPDATE;
 FOR item IN SELECT j.key material,j.value::uuid product FROM jsonb_each_text(r.product_map) j WHERE EXISTS(SELECT 1 FROM public.laundry_cycle_products p WHERE p.sede_id=c.sede_id AND p.product_id=j.value::uuid) ORDER BY j.value LOOP
  SELECT * INTO old FROM public.laundry_cycle_receipt_postings WHERE receipt_id=r.id AND product_id=item.product FOR UPDATE;
  INSERT INTO public.laundry_cycle_pool(sede_id,product_id,quantity) VALUES(c.sede_id,item.product,0) ON CONFLICT DO NOTHING;
  SELECT quantity INTO current_pool FROM public.laundry_cycle_pool WHERE sede_id=c.sede_id AND product_id=item.product FOR UPDATE;
  delta:=coalesce((r.counts->>item.material)::numeric,0)-coalesce(old.accepted,0);
  IF delta>=0 THEN
   matched:=least(delta,current_pool); new_pooled:=coalesce(old.pooled,0)+matched;
   IF matched<delta AND c.strict_receipts THEN RAISE EXCEPTION 'La ropa recibida supera lo registrado en lavandería; revisa el recuento pendiente'; END IF;
   IF matched<delta THEN
    INSERT INTO public.laundry_cycle_issues(sede_id,task_key,code,detail)
    VALUES(c.sede_id,NULL,'unmatched_receipt','Recepción real por encima del lavado registrado; conciliar cantidades sin atribuirla a una propiedad')
    ON CONFLICT(sede_id,task_key,code) DO UPDATE SET detail=EXCLUDED.detail,resolved_at=NULL;
   END IF;
   current_pool:=current_pool-matched;
  ELSE
   new_pooled:=least(coalesce(old.pooled,0),coalesce((r.counts->>item.material)::numeric,0));
   current_pool:=current_pool+coalesce(old.pooled,0)-new_pooled;
  END IF;
  new_rejected:=coalesce((r.discarded_counts->>item.material)::numeric,0);
  reject_delta:=new_rejected-coalesce(old.rejected,0); new_quarantined:=coalesce(old.quarantined,0);
  IF c.rejection_mode='central' AND reject_delta<>0 THEN
   INSERT INTO public.laundry_rejected_stock(product_id,warehouse_id,current_quantity) VALUES(item.product,c.central_id,0) ON CONFLICT DO NOTHING;
   SELECT current_quantity INTO quarantine_balance FROM public.laundry_rejected_stock WHERE product_id=item.product AND warehouse_id=c.central_id FOR UPDATE;
   IF reject_delta>0 THEN
    matched:=least(reject_delta,current_pool);
    IF matched<reject_delta AND c.strict_receipts THEN RAISE EXCEPTION 'Las prendas rechazadas superan lo pendiente registrado'; END IF;
    IF matched<reject_delta THEN INSERT INTO public.laundry_cycle_issues(sede_id,task_key,code,detail) VALUES(c.sede_id,NULL,'unmatched_receipt','Ropa recibida o rechazada por encima del lavado registrado; conciliar el recuento conjunto') ON CONFLICT(sede_id,task_key,code) DO UPDATE SET detail=EXCLUDED.detail,resolved_at=NULL; END IF;
    current_pool:=current_pool-matched; quarantine_balance:=quarantine_balance+reject_delta;new_quarantined:=new_quarantined+reject_delta;
   ELSE
    returned:=least(-reject_delta,new_quarantined); IF returned>quarantine_balance THEN RAISE EXCEPTION 'La rechazada disponible cambió: revisa sus envíos'; END IF;
    quarantine_balance:=quarantine_balance-returned;current_pool:=current_pool+returned;new_quarantined:=new_quarantined-returned;
   END IF;
   UPDATE public.laundry_rejected_stock SET current_quantity=quarantine_balance WHERE product_id=item.product AND warehouse_id=c.central_id;
  END IF;
  UPDATE public.laundry_cycle_pool SET quantity=current_pool WHERE sede_id=c.sede_id AND product_id=item.product;
  INSERT INTO public.laundry_cycle_receipt_postings(receipt_id,product_id,sede_id,accepted,pooled,rejected,quarantined)
  VALUES(r.id,item.product,c.sede_id,coalesce((r.counts->>item.material)::numeric,0),new_pooled,new_rejected,new_quarantined)
  ON CONFLICT(receipt_id,product_id) DO UPDATE SET accepted=EXCLUDED.accepted,pooled=EXCLUDED.pooled,rejected=EXCLUDED.rejected,quarantined=EXCLUDED.quarantined;
 END LOOP;
 -- Rejected linen remains owned: held apart centrally until dispatch, or
 -- pending at the supplier according to the configured physical operation.
 -- Existing discarded_counts records each attempt; it never creates clean
 -- stock, destroys units, or claims that this mixed return belongs to a bag.
 INSERT INTO public.laundry_cycle_events(operation_key,sede_id,kind,payload)
 VALUES(key,c.sede_id,'pooled_receipt',jsonb_build_object('receiptId',r.id,'accepted',r.counts,'reportedDiscards',r.discarded_counts));
 RETURN result;
END $$;
REVOKE ALL ON FUNCTION public.apply_laundry_receipt_operation_before_cycle(uuid,uuid,uuid,text,date,uuid,jsonb),public.apply_laundry_receipt_operation(uuid,uuid,uuid,text,date,uuid,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.apply_laundry_receipt_operation(uuid,uuid,uuid,text,date,uuid,jsonb) TO service_role;

CREATE FUNCTION public.configure_laundry_cycle_checked(_sede uuid,_central uuid,_properties uuid[],_start date,_collection text,_strict boolean,_destination text,_rejection text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 PERFORM public.laundry_cycle_admin(_sede);
 IF _collection IS NULL OR _collection NOT IN ('all','one') OR _destination IS NULL OR _destination NOT IN ('central','laundry') OR _rejection IS NULL OR _rejection NOT IN ('immediate','central') OR _start IS NULL OR _start<(now() AT TIME ZONE 'Europe/Madrid')::date
 OR coalesce(cardinality(_properties),0)=0 THEN RAISE EXCEPTION 'Confirma fecha, propiedades y modo de recogida'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.stock_warehouses WHERE id=_central AND sede_id=_sede AND is_active AND location_type='central') THEN RAISE EXCEPTION 'Almacén central inválido'; END IF;
 IF EXISTS(SELECT 1 FROM unnest(_properties) x LEFT JOIN public.properties p ON p.id=x
 LEFT JOIN public.clients cl ON cl.id=p.cliente_id WHERE p.id IS NULL OR p.sede_id<>_sede
 OR NOT coalesce(p.is_active,cl.is_active,false) OR NOT coalesce(p.linen_control_enabled,cl.linen_control_enabled,false)) THEN RAISE EXCEPTION 'Propiedad de otra sede, inactiva o sin lencería'; END IF;
 IF EXISTS(SELECT 1 FROM public.laundry_cycle_config WHERE sede_id=_sede AND (active OR opened_at IS NOT NULL)) THEN RAISE EXCEPTION 'No cambies el alcance después de cargar aperturas'; END IF;
 IF EXISTS(SELECT 1 FROM public.property_group_assignments chosen JOIN public.property_group_assignments other ON other.property_group_id=chosen.property_group_id
 JOIN public.properties p ON p.id=other.property_id LEFT JOIN public.clients cl ON cl.id=p.cliente_id
 WHERE chosen.property_id=ANY(_properties) AND p.sede_id=_sede AND NOT(p.id=ANY(_properties)) AND coalesce(p.is_active,cl.is_active,false) AND coalesce(p.linen_control_enabled,cl.linen_control_enabled,false)
 AND EXISTS(SELECT 1 FROM public.stock_warehouses w WHERE w.property_group_id=chosen.property_group_id AND w.sede_id=_sede AND w.is_active AND w.location_type='building_storage')) THEN RAISE EXCEPTION 'Incluye las propiedades que comparten trastero para contar su stock una sola vez'; END IF;
 INSERT INTO public.laundry_cycle_config(sede_id,central_id,start_date,collection_mode,strict_receipts,collection_destination,rejection_mode)
 VALUES(_sede,_central,_start,_collection,_strict,_destination,_rejection)
 ON CONFLICT(sede_id) DO UPDATE SET central_id=EXCLUDED.central_id,start_date=EXCLUDED.start_date,collection_mode=EXCLUDED.collection_mode,strict_receipts=EXCLUDED.strict_receipts,collection_destination=EXCLUDED.collection_destination,rejection_mode=EXCLUDED.rejection_mode;
 DELETE FROM public.laundry_cycle_scope WHERE sede_id=_sede;
 INSERT INTO public.laundry_cycle_scope(property_id,sede_id) SELECT DISTINCT x,_sede FROM unnest(_properties) x;
 DELETE FROM public.laundry_cycle_products WHERE sede_id=_sede;
 INSERT INTO public.laundry_cycle_products(sede_id,product_id)
 SELECT DISTINCT _sede,p.id FROM public.stock_products p JOIN public.stock_categories sc ON sc.id=p.category_id
 WHERE p.sede_id=_sede AND p.is_active AND sc.kind::text='laundry' AND
 (EXISTS(SELECT 1 FROM public.stock_property_field_mappings m WHERE m.product_id=p.id AND m.sede_id=_sede AND m.is_active)
 OR EXISTS(SELECT 1 FROM public.stock_property_consumption_rules r WHERE r.product_id=p.id AND r.property_id=ANY(_properties) AND r.is_active));
 IF NOT EXISTS(SELECT 1 FROM public.laundry_cycle_products WHERE sede_id=_sede) THEN RAISE EXCEPTION 'No hay tipologías de muda configuradas'; END IF;
END $$;

CREATE FUNCTION public.open_laundry_cycle_checked(_sede uuid,_counts jsonb,_measured timestamptz)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE c public.laundry_cycle_config; row record; before numeric;
BEGIN
 PERFORM public.laundry_cycle_admin(_sede);
 SELECT * INTO STRICT c FROM public.laundry_cycle_config WHERE sede_id=_sede FOR UPDATE;
 IF c.active OR EXISTS(SELECT 1 FROM public.laundry_cycle_events WHERE sede_id=_sede) THEN RAISE EXCEPTION 'El circuito ya tiene movimientos'; END IF;
 IF EXISTS(SELECT 1 FROM public.laundry_cycle_bags WHERE sede_id=_sede AND state IN ('prepared','delivered')) THEN RAISE EXCEPTION 'Resuelve las bolsas vinculadas antes de reemplazar el recuento'; END IF;
 IF _measured IS NULL OR _measured>now() OR jsonb_typeof(_counts)<>'array' OR jsonb_array_length(_counts)=0 THEN RAISE EXCEPTION 'Recuento medido inválido'; END IF;
 DELETE FROM public.laundry_cycle_openings WHERE sede_id=_sede;
 FOR row IN SELECT * FROM jsonb_to_recordset(_counts) x("productId" uuid,"warehouseId" uuid,"propertyId" uuid,kind text,quantity numeric,"preparedQuantity" numeric) LOOP
  IF row.quantity IS NULL OR row.quantity<0 OR row.quantity<>trunc(row.quantity) OR row.quantity::text IN ('NaN','Infinity','-Infinity')
  OR NOT EXISTS(SELECT 1 FROM public.stock_products p JOIN public.stock_categories sc ON sc.id=p.category_id
   WHERE p.id=row."productId" AND p.sede_id=_sede AND p.is_active AND sc.kind::text='laundry') THEN RAISE EXCEPTION 'Cantidad desconocida o producto inválido'; END IF;
  IF row.kind NOT IN ('clean','installed','dirty','outside','rejected','collected') THEN RAISE EXCEPTION 'Tipo de recuento inválido'; END IF;
  IF row.kind IN ('rejected','collected') AND (row."warehouseId" IS DISTINCT FROM c.central_id OR row."propertyId" IS NOT NULL) THEN RAISE EXCEPTION 'La recogida y la rechazada se cuentan por separado en el central'; END IF;
  IF row.kind='clean' AND (row."preparedQuantity" IS NULL OR row."preparedQuantity"<0 OR row."preparedQuantity">row.quantity OR row."preparedQuantity"<>trunc(row."preparedQuantity") OR row."preparedQuantity"::text IN ('NaN','Infinity','-Infinity')) THEN RAISE EXCEPTION 'Cuenta separadamente la ropa preparada'; END IF;
  IF row.kind IN ('clean','dirty') AND row."warehouseId" IS NOT NULL AND NOT EXISTS(
   SELECT 1 FROM public.stock_warehouses WHERE id=row."warehouseId" AND sede_id=_sede AND is_active) THEN RAISE EXCEPTION 'Ubicación inválida'; END IF;
  IF row.kind IN ('installed','dirty') AND NOT EXISTS(SELECT 1 FROM public.laundry_cycle_scope WHERE property_id=row."propertyId" AND sede_id=_sede) THEN RAISE EXCEPTION 'Propiedad fuera del recuento'; END IF;
  IF row.kind='installed' AND row."warehouseId" IS NOT NULL OR row.kind='outside' AND (row."propertyId" IS NOT NULL OR row."warehouseId" IS NOT NULL)
  OR row.kind='clean' AND NOT ((row."warehouseId" IS NOT NULL AND row."propertyId" IS NULL) OR (row."warehouseId" IS NULL AND row."propertyId" IS NOT NULL AND EXISTS(SELECT 1 FROM public.laundry_cycle_scope WHERE property_id=row."propertyId" AND sede_id=_sede) AND public.laundry_cycle_destination(row."propertyId",_sede) IS NULL AND row."preparedQuantity"=row.quantity)) THEN RAISE EXCEPTION 'Recuento en una ubicación incompatible'; END IF;
  INSERT INTO public.laundry_cycle_openings(sede_id,product_id,warehouse_id,property_id,kind,quantity,measured_at,recorded_by,prepared_quantity)
  VALUES(_sede,row."productId",row."warehouseId",row."propertyId",row.kind,row.quantity,_measured,auth.uid(),coalesce(row."preparedQuantity",0))
  ON CONFLICT(sede_id,product_id,warehouse_id,property_id,kind) DO UPDATE SET quantity=EXCLUDED.quantity,prepared_quantity=EXCLUDED.prepared_quantity,measured_at=EXCLUDED.measured_at,recorded_by=EXCLUDED.recorded_by;
 END LOOP;
 -- Absolute opening counts, never additive. Repeating a count cannot double it.
 FOR row IN SELECT * FROM public.laundry_cycle_openings WHERE sede_id=_sede ORDER BY product_id,warehouse_id LOOP
  IF row.kind='clean' THEN
   IF row.warehouse_id IS NULL THEN CONTINUE; END IF; -- Direct bags are adopted as held linen, with no fabricated warehouse.
   SELECT coalesce(current_quantity,0) INTO before FROM public.stock_levels WHERE product_id=row.product_id AND warehouse_id=row.warehouse_id FOR UPDATE;
   before:=coalesce(before,0);
   INSERT INTO public.stock_levels(product_id,warehouse_id,current_quantity) VALUES(row.product_id,row.warehouse_id,row.quantity)
   ON CONFLICT(product_id,warehouse_id) DO UPDATE SET current_quantity=EXCLUDED.current_quantity,last_updated=now();
   IF row.quantity<>before THEN
    INSERT INTO public.stock_movements(product_id,warehouse_id,movement_type,quantity,previous_quantity,new_quantity,reason,created_by)
    VALUES(row.product_id,row.warehouse_id,'ajuste',abs(row.quantity-before),before,row.quantity,'Recuento inicial comprobado del circuito de lavandería',auth.uid());
   END IF;
  ELSIF row.kind='installed' THEN
   INSERT INTO public.laundry_apartment_stock(property_id,product_id,current_quantity) VALUES(row.property_id,row.product_id,row.quantity)
   ON CONFLICT(property_id,product_id) DO UPDATE SET current_quantity=EXCLUDED.current_quantity,updated_at=now();
  ELSIF row.kind='dirty' THEN
   INSERT INTO public.laundry_cycle_dirty(property_id,product_id,sede_id,warehouse_id,quantity) VALUES(row.property_id,row.product_id,_sede,row.warehouse_id,row.quantity)
   ON CONFLICT(property_id,product_id) DO UPDATE SET warehouse_id=EXCLUDED.warehouse_id,quantity=EXCLUDED.quantity;
  ELSIF row.kind='collected' THEN
   INSERT INTO public.laundry_cycle_collected(sede_id,product_id,quantity) VALUES(_sede,row.product_id,row.quantity)
   ON CONFLICT(sede_id,product_id) DO UPDATE SET quantity=EXCLUDED.quantity;
  ELSIF row.kind='rejected' THEN
   INSERT INTO public.laundry_rejected_stock(product_id,warehouse_id,current_quantity) VALUES(row.product_id,c.central_id,row.quantity)
   ON CONFLICT(product_id,warehouse_id) DO UPDATE SET current_quantity=EXCLUDED.current_quantity;
  ELSE
   INSERT INTO public.laundry_cycle_pool(sede_id,product_id,quantity) VALUES(_sede,row.product_id,row.quantity)
   ON CONFLICT(sede_id,product_id) DO UPDATE SET quantity=EXCLUDED.quantity;
  END IF;
 END LOOP;
 FOR row IN SELECT product_id,warehouse_id,sum(quantity) quantity FROM public.laundry_cycle_dirty WHERE sede_id=_sede AND warehouse_id IS NOT NULL GROUP BY product_id,warehouse_id LOOP
  INSERT INTO public.laundry_dirty_stock(product_id,warehouse_id,current_quantity) VALUES(row.product_id,row.warehouse_id,row.quantity)
  ON CONFLICT(product_id,warehouse_id) DO UPDATE SET current_quantity=EXCLUDED.current_quantity;
 END LOOP;
 UPDATE public.laundry_cycle_config SET opened_at=now(),opened_by=auth.uid() WHERE sede_id=_sede;
END $$;

CREATE FUNCTION public.activate_laundry_cycle_checked(_sede uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE c public.laundry_cycle_config; prop record; product record; destination uuid;
BEGIN
 PERFORM public.laundry_cycle_admin(_sede);
 SELECT * INTO STRICT c FROM public.laundry_cycle_config WHERE sede_id=_sede FOR UPDATE;
 IF c.active THEN RETURN; END IF;
 IF EXISTS(SELECT 1 FROM public.laundry_cycle_scope s JOIN public.properties p ON p.id=s.property_id LEFT JOIN public.clients cl ON cl.id=p.cliente_id WHERE s.sede_id=_sede AND (p.sede_id<>_sede OR NOT coalesce(p.is_active,cl.is_active,false) OR NOT coalesce(p.linen_control_enabled,cl.linen_control_enabled,false))) THEN RAISE EXCEPTION 'El alcance cambió desde la preparación: revisa las propiedades antes de activar'; END IF;
 IF c.opened_at IS NULL OR c.collection_mode IS NULL THEN RAISE EXCEPTION 'Falta el recuento o la operativa'; END IF;
 IF c.collection_mode='one' AND EXISTS(SELECT 1 FROM public.laundry_cycle_openings WHERE sede_id=_sede AND kind='dirty' AND quantity>0) THEN RAISE EXCEPTION 'Para recoger una muda por visita, empieza sin sucia anterior: recoge la acumulada antes del recuento o elige recoger toda'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.laundry_receipt_links l WHERE l.warehouse_id=c.central_id AND l.is_active AND EXISTS(SELECT 1 FROM public.laundry_route_workers w WHERE w.id=ANY(l.worker_ids) AND w.sede_id=_sede AND w.is_active)) THEN RAISE EXCEPTION 'Prepara el acceso de recepción con un empleado activo'; END IF;
 IF EXISTS(SELECT 1 FROM public.laundry_cycle_products p WHERE p.sede_id=_sede AND NOT EXISTS(SELECT 1 FROM public.laundry_receipt_links l,jsonb_each_text(l.product_map) m WHERE l.warehouse_id=c.central_id AND l.is_active AND m.value=p.product_id::text)) THEN RAISE EXCEPTION 'Falta una tipología del circuito en la recepción de lavandería'; END IF;
 IF EXISTS(SELECT 1 FROM public.laundry_receipts r JOIN public.laundry_receipt_links l ON l.id=r.link_id WHERE l.warehouse_id=c.central_id AND r.latest_version=0 AND r.updated_at<=c.opened_at) THEN RAISE EXCEPTION 'Hay recepciones pendientes anteriores al recuento: termínalas antes de volver a contar y activar'; END IF;
 IF EXISTS(SELECT 1 FROM public.laundry_cycle_openings o LEFT JOIN public.stock_levels l ON l.product_id=o.product_id AND l.warehouse_id=o.warehouse_id
 WHERE o.sede_id=_sede AND o.kind='clean' AND o.warehouse_id IS NOT NULL AND l.current_quantity IS DISTINCT FROM o.quantity) THEN RAISE EXCEPTION 'El stock cambió después del recuento: vuelve a comprobarlo'; END IF;
 IF EXISTS(SELECT 1 FROM public.stock_sede_settings WHERE sede_id=_sede AND (laundry_route_inventory_enabled OR auto_consumption_enabled)) THEN RAISE EXCEPTION 'Desactiva los motores anteriores para evitar duplicar movimientos'; END IF;
 IF EXISTS(SELECT 1 FROM public.laundry_cycle_openings WHERE sede_id=_sede AND prepared_quantity>0) THEN RAISE EXCEPTION 'Hay bolsas anteriores preparadas: vincúlalas al circuito o deshazlas físicamente y actualiza el recuento'; END IF;
 IF EXISTS(SELECT 1 FROM public.tasks t JOIN public.laundry_cycle_scope s ON s.property_id=t.propiedad_id AND s.sede_id=t.sede_id WHERE t.sede_id=_sede AND t.date>=c.start_date AND t.status='completed') THEN RAISE EXCEPTION 'La fecha incluye limpiezas ya realizadas'; END IF;
 FOR prop IN SELECT p.* FROM public.properties p JOIN public.laundry_cycle_scope s ON s.property_id=p.id WHERE s.sede_id=_sede LOOP
  destination:=public.laundry_cycle_destination(prop.id,_sede);
  FOR product IN SELECT product_id id FROM public.laundry_cycle_products WHERE sede_id=_sede LOOP
   IF NOT EXISTS(SELECT 1 FROM public.laundry_cycle_openings WHERE sede_id=_sede AND product_id=product.id AND kind='clean' AND warehouse_id=c.central_id)
   OR NOT EXISTS(SELECT 1 FROM public.laundry_cycle_openings WHERE sede_id=_sede AND product_id=product.id AND kind='outside')
   OR NOT EXISTS(SELECT 1 FROM public.laundry_cycle_openings WHERE sede_id=_sede AND product_id=product.id AND kind='rejected' AND warehouse_id=c.central_id)
   OR NOT EXISTS(SELECT 1 FROM public.laundry_cycle_openings WHERE sede_id=_sede AND product_id=product.id AND kind='collected' AND warehouse_id=c.central_id)
   OR NOT EXISTS(SELECT 1 FROM public.laundry_cycle_openings WHERE sede_id=_sede AND product_id=product.id AND kind='installed' AND property_id=prop.id)
   OR NOT EXISTS(SELECT 1 FROM public.laundry_cycle_openings WHERE sede_id=_sede AND product_id=product.id AND kind='dirty' AND property_id=prop.id AND warehouse_id IS NOT DISTINCT FROM destination)
   OR (destination IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.laundry_cycle_openings WHERE sede_id=_sede AND product_id=product.id AND kind='clean' AND warehouse_id=destination)) THEN RAISE EXCEPTION 'Faltan categorías contadas; un dato ausente no significa cero'; END IF;
   IF destination IS NULL AND NOT EXISTS(SELECT 1 FROM public.laundry_cycle_openings WHERE sede_id=_sede AND product_id=product.id AND kind='clean' AND warehouse_id IS NULL AND property_id=prop.id) THEN RAISE EXCEPTION 'Cuenta también las bolsas limpias que esperan en la propiedad'; END IF;
  END LOOP;
 END LOOP;
 UPDATE public.laundry_cycle_config SET active=true WHERE sede_id=_sede;
END $$;

CREATE FUNCTION public.read_laundry_cycle_checked(_sede uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF auth.uid() IS NULL OR NOT (_sede=ANY(public.get_user_stock_sedes())) OR NOT EXISTS(SELECT 1 FROM public.user_roles WHERE user_id=auth.uid() AND role::text IN ('admin','manager','logistics','supervisor')) THEN RAISE EXCEPTION 'No tienes acceso a esta sede' USING ERRCODE='42501'; END IF;
 RETURN jsonb_build_object('config',(SELECT to_jsonb(c) FROM public.laundry_cycle_config c WHERE sede_id=_sede),
 'scope',coalesce((SELECT jsonb_agg(property_id) FROM public.laundry_cycle_scope WHERE sede_id=_sede),'[]'),
 'bags',coalesce((SELECT jsonb_agg(to_jsonb(b)) FROM public.laundry_cycle_bags b WHERE sede_id=_sede AND state IN ('prepared','delivered')),'[]'),
 'outside',coalesce((SELECT jsonb_agg(to_jsonb(p)) FROM public.laundry_cycle_pool p WHERE sede_id=_sede),'[]'),
 'collected',coalesce((SELECT jsonb_agg(to_jsonb(p)) FROM public.laundry_cycle_collected p WHERE sede_id=_sede),'[]'),
 'rejected',coalesce((SELECT jsonb_agg(to_jsonb(p)) FROM public.laundry_rejected_stock p JOIN public.laundry_cycle_config c ON c.central_id=p.warehouse_id WHERE c.sede_id=_sede),'[]'),
 'dirty',coalesce((SELECT jsonb_agg(to_jsonb(d)) FROM public.laundry_cycle_dirty d WHERE sede_id=_sede),'[]'),
 'issues',coalesce((SELECT jsonb_agg(to_jsonb(i)) FROM public.laundry_cycle_issues i WHERE sede_id=_sede AND resolved_at IS NULL),'[]'),
 'openingRows',(SELECT count(*) FROM public.laundry_cycle_openings WHERE sede_id=_sede),
 'requirements',public.laundry_cycle_requirements(_sede),
 'adoptableBags',coalesce((SELECT jsonb_agg(jsonb_build_object('taskId',t.id,'propertyCode',p.codigo,'date',t.date,
 'lines',coalesce((SELECT jsonb_agg(jsonb_build_object('productId',bag.product_id,'quantity',bag.quantity) ORDER BY bag.product_id) FROM public.resolve_laundry_bag_lines(t.id) bag),'[]')))
 FROM public.tasks t JOIN public.properties p ON p.id=t.propiedad_id JOIN public.laundry_cycle_scope scope ON scope.property_id=t.propiedad_id AND scope.sede_id=t.sede_id
 JOIN public.laundry_cycle_config cfg ON cfg.sede_id=t.sede_id
 LEFT JOIN public.laundry_bag_preparations prep ON prep.task_id=t.id
 WHERE t.sede_id=_sede AND t.date>=cfg.start_date AND t.status NOT IN ('cancelled','completed')
 AND (prep.status='prepared' OR t.date<=cfg.start_date+14)
 AND NOT EXISTS(SELECT 1 FROM public.laundry_cycle_bags WHERE task_key=t.id AND state IN ('prepared','delivered'))),'[]'));
END $$;

CREATE FUNCTION public.retry_laundry_cycle_checked(_task uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE s uuid;
BEGIN
 SELECT sede_id INTO STRICT s FROM public.tasks WHERE id=_task; PERFORM public.laundry_cycle_admin(s);
 RETURN public.laundry_cycle_complete(_task);
END $$;

CREATE FUNCTION public.resolve_laundry_cycle_bag_checked(_bag uuid,_action text,_reason text,_operation uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE b public.laundry_cycle_bags; row record; key text;
BEGIN
 SELECT * INTO STRICT b FROM public.laundry_cycle_bags WHERE id=_bag;
 PERFORM public.laundry_cycle_admin(b.sede_id); PERFORM 1 FROM public.laundry_cycle_config WHERE sede_id=b.sede_id FOR UPDATE;
 SELECT * INTO STRICT b FROM public.laundry_cycle_bags WHERE id=_bag FOR UPDATE;
 IF _operation IS NULL OR length(trim(coalesce(_reason,'')))<3 THEN RAISE EXCEPTION 'Indica el motivo y la operación'; END IF;
 key:='resolution:'||_operation;
 IF EXISTS(SELECT 1 FROM public.laundry_cycle_events WHERE operation_key=key AND payload @> jsonb_build_object('bag',_bag,'action',_action,'reason',_reason)) THEN RETURN; END IF;
 IF EXISTS(SELECT 1 FROM public.laundry_cycle_events WHERE operation_key=key) THEN RAISE EXCEPTION 'Identificador ya utilizado para otra resolución'; END IF;
 IF _action='unpack' AND b.state='prepared' THEN UPDATE public.laundry_cycle_bags SET state='released' WHERE id=_bag;
 ELSIF _action='return' AND b.state='delivered' THEN
  UPDATE public.laundry_cycle_bags SET state='returned' WHERE id=_bag;
  FOR row IN SELECT * FROM jsonb_to_recordset(b.lines) x("productId" uuid,quantity numeric) ORDER BY "productId" LOOP
   IF b.destination_id IS NOT NULL THEN PERFORM public.laundry_cycle_move(row."productId",b.destination_id,-row.quantity,b.task_id,b.property_id,'Devolución física de muda: '||_reason); END IF;
   PERFORM public.laundry_cycle_move(row."productId",b.central_id,row.quantity,b.task_id,b.property_id,'Muda devuelta a central: '||_reason);
  END LOOP;
 ELSE RAISE EXCEPTION 'La bolsa ya se utilizó o no admite esta resolución'; END IF;
 INSERT INTO public.laundry_cycle_events(operation_key,sede_id,task_id,task_key,property_id,kind,payload)
 VALUES(key,b.sede_id,b.task_id,b.task_key,b.property_id,'physical_resolution',jsonb_build_object('bag',_bag,'action',_action,'reason',_reason,'priorPreparation',(SELECT to_jsonb(p) FROM public.laundry_bag_preparations p WHERE p.task_id=b.task_id)));
 UPDATE public.laundry_bag_preparations SET status='pending',content_snapshot=NULL,snapshot_locked_at=NULL,route_delivery_status='pending',route_novelty_type='undone',route_novelty_resolved=false,updated_at=now(),undone_at=now(),undone_reason=_reason,undone_by_name=(SELECT full_name FROM public.profiles WHERE id=auth.uid()) WHERE task_id=b.task_id;
 UPDATE public.laundry_delivery_tracking SET status='pending',delivered_at=NULL,delivered_by_name=NULL,delivered_by_worker_id=NULL WHERE task_id=b.task_id;
END $$;

-- Private functions have no implicit PUBLIC execution. Checked administrative

CREATE FUNCTION public.laundry_cycle_requirements(_sede uuid) RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 WITH cfg AS (SELECT * FROM public.laundry_cycle_config WHERE sede_id=_sede),
 products AS (SELECT cp.product_id FROM public.laundry_cycle_products cp WHERE cp.sede_id=_sede),
 props AS (SELECT p.id FROM public.laundry_cycle_scope s JOIN public.properties p ON p.id=s.property_id WHERE s.sede_id=_sede),
 locations AS (SELECT central_id id FROM cfg UNION SELECT public.laundry_cycle_destination(id,_sede) FROM props),
 needs AS (
  SELECT 'clean'::text kind,product_id,id warehouse_id,NULL::uuid property_id FROM products CROSS JOIN locations WHERE id IS NOT NULL
  UNION ALL SELECT 'clean',product_id,NULL,id FROM products CROSS JOIN props WHERE public.laundry_cycle_destination(id,_sede) IS NULL
  UNION ALL SELECT 'outside',product_id,NULL,NULL FROM products
  UNION ALL SELECT 'rejected',product_id,central_id,NULL FROM products CROSS JOIN cfg
  UNION ALL SELECT 'collected',product_id,central_id,NULL FROM products CROSS JOIN cfg
  UNION ALL SELECT 'installed',product_id,NULL,id FROM products CROSS JOIN props
  UNION ALL SELECT 'dirty',product_id,public.laundry_cycle_destination(id,_sede),id FROM products CROSS JOIN props
 )
 SELECT coalesce(jsonb_agg(jsonb_build_object('key',n.kind||':'||n.product_id||':'||coalesce(n.warehouse_id::text,'')||':'||coalesce(n.property_id::text,''),
 'kind',n.kind,'productId',n.product_id,'warehouseId',n.warehouse_id,'propertyId',n.property_id,'productName',p.name,
 'locationName',CASE WHEN n.kind='outside' THEN 'Lavandería: pendiente de recuperar' WHEN n.kind='rejected' THEN 'Rechazada apartada · '||w.name WHEN n.kind='collected' THEN 'Sucia recogida para enviar · '||w.name WHEN n.kind='installed' THEN 'Instalada · '||prop.codigo
 WHEN n.kind='dirty' THEN 'Sucia · '||prop.codigo WHEN n.kind='clean' AND n.property_id IS NOT NULL THEN 'Limpia embolsada · '||prop.codigo ELSE w.name END,
 'quantity',o.quantity,'preparedQuantity',CASE WHEN n.kind='clean' THEN o.prepared_quantity END) ORDER BY n.kind,w.name,prop.codigo,p.name),'[]')
 FROM needs n JOIN public.stock_products p ON p.id=n.product_id LEFT JOIN public.stock_warehouses w ON w.id=n.warehouse_id
 LEFT JOIN public.properties prop ON prop.id=n.property_id LEFT JOIN public.laundry_cycle_openings o ON o.sede_id=_sede AND o.kind=n.kind AND o.product_id=n.product_id
 AND o.warehouse_id IS NOT DISTINCT FROM n.warehouse_id AND o.property_id IS NOT DISTINCT FROM n.property_id;
$$;

CREATE FUNCTION public.laundry_cycle_send_checked(_sede uuid,_lines jsonb,_reason text,_operation uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE line record; key text; c public.laundry_cycle_config; event_payload jsonb; posting record; remaining numeric; consumed numeric;
BEGIN
 PERFORM public.laundry_cycle_admin(_sede);
 SELECT * INTO STRICT c FROM public.laundry_cycle_config WHERE sede_id=_sede AND active FOR UPDATE;
 IF _operation IS NULL OR length(trim(coalesce(_reason,'')))<3 OR jsonb_typeof(_lines) IS DISTINCT FROM 'array' OR jsonb_array_length(_lines)=0 THEN RAISE EXCEPTION 'Confirma cantidades y motivo de envío'; END IF;
 key:='dispatch:'||_operation; event_payload:=jsonb_build_object('lines',_lines,'reason',_reason);
 IF EXISTS(SELECT 1 FROM public.laundry_cycle_events WHERE operation_key=key AND sede_id=_sede AND public.laundry_cycle_events.payload=event_payload) THEN RETURN; END IF;
 IF EXISTS(SELECT 1 FROM public.laundry_cycle_events WHERE operation_key=key) THEN RAISE EXCEPTION 'Identificador usado para otro envío'; END IF;
 IF (SELECT count(*) FROM jsonb_to_recordset(_lines) x("productId" uuid,source text))<>(SELECT count(DISTINCT (x."productId",coalesce(x.source,'collected'))) FROM jsonb_to_recordset(_lines) x("productId" uuid,source text)) THEN RAISE EXCEPTION 'No repitas una tipología y origen en el envío'; END IF;
 FOR line IN SELECT * FROM jsonb_to_recordset(_lines) x("productId" uuid,quantity numeric,"expectedQuantity" numeric,source text) ORDER BY "productId",source LOOP
  IF line.quantity IS NULL OR line.quantity<=0 OR line.quantity<>trunc(line.quantity) OR line.quantity::text IN ('NaN','Infinity','-Infinity') THEN RAISE EXCEPTION 'Cantidad inválida'; END IF;
  IF coalesce(line.source,'collected')='collected' THEN
   UPDATE public.laundry_cycle_collected SET quantity=quantity-line.quantity WHERE sede_id=_sede AND product_id=line."productId" AND quantity>=line.quantity AND quantity=line."expectedQuantity";
   IF NOT FOUND THEN RAISE EXCEPTION 'El envío supera la ropa recogida o su saldo cambió'; END IF;
  ELSIF line.source='rejected' THEN
   UPDATE public.laundry_rejected_stock SET current_quantity=current_quantity-line.quantity WHERE warehouse_id=c.central_id AND product_id=line."productId" AND current_quantity>=line.quantity AND current_quantity=line."expectedQuantity";
   IF NOT FOUND THEN RAISE EXCEPTION 'La rechazada disponible cambió; revisa el envío'; END IF;
   remaining:=line.quantity;
   FOR posting IN SELECT * FROM public.laundry_cycle_receipt_postings WHERE sede_id=_sede AND product_id=line."productId" AND quarantined>0 ORDER BY receipt_id FOR UPDATE LOOP
    consumed:=least(remaining,posting.quarantined);
    UPDATE public.laundry_cycle_receipt_postings SET quarantined=quarantined-consumed WHERE receipt_id=posting.receipt_id AND product_id=posting.product_id;
    remaining:=remaining-consumed;EXIT WHEN remaining=0;
   END LOOP; -- Remaining may belong to the initial counted quarantine, without a receipt.
  ELSE RAISE EXCEPTION 'Origen de envío inválido'; END IF;
  INSERT INTO public.laundry_cycle_pool(sede_id,product_id,quantity) VALUES(_sede,line."productId",line.quantity)
  ON CONFLICT(sede_id,product_id) DO UPDATE SET quantity=public.laundry_cycle_pool.quantity+EXCLUDED.quantity;
 END LOOP;
 INSERT INTO public.laundry_cycle_events(operation_key,sede_id,kind,payload) VALUES(key,_sede,'sent_to_laundry',event_payload);
END $$;

CREATE FUNCTION public.laundry_cycle_writeoff_checked(_sede uuid,_product uuid,_quantity numeric,_reason text,_operation uuid,_source text DEFAULT 'outside',_expected numeric DEFAULT NULL) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE key text; event_payload jsonb; c public.laundry_cycle_config; posting record; remaining numeric; consumed numeric;
BEGIN
 PERFORM public.laundry_cycle_admin(_sede); SELECT * INTO c FROM public.laundry_cycle_config WHERE sede_id=_sede AND active FOR UPDATE;
 IF NOT FOUND OR _operation IS NULL OR _quantity IS NULL OR _quantity<=0 OR _quantity<>trunc(_quantity) OR _quantity::text IN ('NaN','Infinity','-Infinity') OR length(trim(coalesce(_reason,'')))<3 THEN RAISE EXCEPTION 'Confirma la baja definitiva y su motivo'; END IF;
 key:='writeoff:'||_operation; event_payload:=jsonb_build_object('product',_product,'quantity',_quantity,'reason',_reason,'source',_source,'expected',_expected);
 IF EXISTS(SELECT 1 FROM public.laundry_cycle_events WHERE operation_key=key AND sede_id=_sede AND public.laundry_cycle_events.payload=event_payload) THEN RETURN; END IF;
 IF EXISTS(SELECT 1 FROM public.laundry_cycle_events WHERE operation_key=key) THEN RAISE EXCEPTION 'Identificador usado para otra baja'; END IF;
 IF _source='outside' THEN
  UPDATE public.laundry_cycle_pool SET quantity=quantity-_quantity WHERE sede_id=_sede AND product_id=_product AND quantity>=_quantity AND (_expected IS NULL OR quantity=_expected);
  IF NOT FOUND THEN RAISE EXCEPTION 'La baja supera la ropa pendiente de recuperar o su saldo cambió'; END IF;
 ELSIF _source='rejected' THEN
  UPDATE public.laundry_rejected_stock SET current_quantity=current_quantity-_quantity WHERE warehouse_id=c.central_id AND product_id=_product AND current_quantity>=_quantity AND current_quantity=_expected;
  IF NOT FOUND THEN RAISE EXCEPTION 'La rechazada disponible cambió'; END IF;
  remaining:=_quantity;
  FOR posting IN SELECT * FROM public.laundry_cycle_receipt_postings WHERE sede_id=_sede AND product_id=_product AND quarantined>0 ORDER BY receipt_id FOR UPDATE LOOP
   consumed:=least(remaining,posting.quarantined); UPDATE public.laundry_cycle_receipt_postings SET quarantined=quarantined-consumed WHERE receipt_id=posting.receipt_id AND product_id=posting.product_id;remaining:=remaining-consumed;EXIT WHEN remaining=0;
  END LOOP;
 ELSE RAISE EXCEPTION 'Origen de baja inválido'; END IF;
 INSERT INTO public.laundry_cycle_events(operation_key,sede_id,kind,payload) VALUES(key,_sede,'confirmed_loss',event_payload);
END $$;

CREATE FUNCTION public.laundry_cycle_adopt_checked(_sede uuid,_bags jsonb) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE c public.laundry_cycle_config; input record; t public.tasks; line record; content jsonb; bag_state text; dest uuid; counted_location uuid;
BEGIN
 PERFORM public.laundry_cycle_admin(_sede);
 SELECT * INTO STRICT c FROM public.laundry_cycle_config WHERE sede_id=_sede AND NOT active AND opened_at IS NOT NULL FOR UPDATE;
 IF jsonb_typeof(_bags) IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'Indica las bolsas físicamente contadas'; END IF;
 FOR input IN SELECT * FROM jsonb_to_recordset(_bags) x("taskId" uuid,lines jsonb,state text) LOOP
  SELECT * INTO STRICT t FROM public.tasks WHERE id=input."taskId" AND sede_id=_sede AND date>=c.start_date AND status NOT IN ('cancelled','completed') FOR UPDATE;
  IF NOT EXISTS(SELECT 1 FROM public.laundry_cycle_scope WHERE property_id=t.propiedad_id AND sede_id=_sede) THEN RAISE EXCEPTION 'Bolsa fuera del alcance'; END IF;
  content:=public.laundry_cycle_lines(t.id);
  dest:=public.laundry_cycle_destination(t.propiedad_id,_sede); bag_state:=coalesce(input.state,'prepared');
  IF bag_state NOT IN ('prepared','delivered') THEN RAISE EXCEPTION 'Confirma dónde espera la bolsa limpia'; END IF;
  counted_location:=CASE WHEN bag_state='prepared' THEN c.central_id ELSE dest END;
  IF input.lines IS DISTINCT FROM content THEN RAISE EXCEPTION 'La bolsa contada no coincide con la dotación actual'; END IF;
  IF EXISTS(SELECT 1 FROM public.laundry_cycle_bags WHERE task_key=t.id AND state=bag_state AND lines=content) THEN CONTINUE; END IF;
  IF EXISTS(SELECT 1 FROM public.laundry_cycle_bags WHERE task_key=t.id AND state IN ('prepared','delivered')) THEN RAISE EXCEPTION 'Esta bolsa ya está vinculada en otra ubicación'; END IF;
  FOR line IN SELECT * FROM jsonb_to_recordset(content) x("productId" uuid,quantity numeric) LOOP
   UPDATE public.laundry_cycle_openings SET prepared_quantity=prepared_quantity-line.quantity
   WHERE sede_id=_sede AND kind='clean' AND warehouse_id IS NOT DISTINCT FROM counted_location AND property_id IS NOT DISTINCT FROM CASE WHEN counted_location IS NULL THEN t.propiedad_id END AND product_id=line."productId" AND prepared_quantity>=line.quantity;
   IF NOT FOUND THEN RAISE EXCEPTION 'Las bolsas superan la ropa preparada contada'; END IF;
  END LOOP;
  INSERT INTO public.laundry_cycle_bags(task_key,task_id,property_id,sede_id,property_code,central_id,destination_id,state,lines,delivered_at)
  VALUES(t.id,t.id,t.propiedad_id,_sede,(SELECT codigo FROM public.properties WHERE id=t.propiedad_id),c.central_id,dest,bag_state,content,CASE WHEN bag_state='delivered' THEN now() END)
  ON CONFLICT(task_key) DO UPDATE SET state=EXCLUDED.state,lines=EXCLUDED.lines,destination_id=EXCLUDED.destination_id,delivered_at=EXCLUDED.delivered_at,generation=public.laundry_cycle_bags.generation+1;
  INSERT INTO public.laundry_cycle_events(operation_key,sede_id,task_id,task_key,property_id,kind,payload)
  SELECT 'adoption:'||task_key||':'||generation,sede_id,task_id,task_key,property_id,'adopted',jsonb_build_object('lines',lines,'state',state,'location',counted_location) FROM public.laundry_cycle_bags WHERE task_key=t.id;
 END LOOP;
END $$;

CREATE FUNCTION public.laundry_cycle_delete_trigger() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF EXISTS(SELECT 1 FROM public.laundry_cycle_bags WHERE task_key=OLD.id) THEN
 INSERT INTO public.laundry_cycle_issues(sede_id,task_key,code,detail) VALUES(OLD.sede_id,OLD.id,'task_deleted','Tarea retirada: se conserva la bolsa y sus movimientos físicos')
 ON CONFLICT(sede_id,task_key,code) DO UPDATE SET resolved_at=NULL;
 END IF;
 RETURN OLD;
END $$;
CREATE TRIGGER laundry_cycle_task_delete BEFORE DELETE ON public.tasks FOR EACH ROW EXECUTE FUNCTION public.laundry_cycle_delete_trigger();

-- RPCs derive the actor from auth.uid(); only the Edge service calls route helpers.

CREATE FUNCTION public.laundry_cycle_preview(_tasks uuid[]) RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 WITH content AS (
  SELECT t.id,t.sede_id,t.propiedad_id,
  coalesce(jsonb_agg(jsonb_build_object('productId',q.product_id,'quantity',q.quantity) ORDER BY q.product_id) FILTER(WHERE q.product_id IS NOT NULL),'[]'::jsonb) canonical,
  coalesce(jsonb_agg(jsonb_build_object('productId',q.product_id,'quantity',q.quantity,'name',p.name,'unit',p.unit_of_measure,
  'propertyField',(SELECT CASE WHEN count(DISTINCT m.property_field)=1 THEN min(m.property_field) END FROM public.stock_property_field_mappings m WHERE m.product_id=q.product_id AND m.sede_id=t.sede_id AND m.is_active)) ORDER BY q.product_id) FILTER(WHERE q.product_id IS NOT NULL),'[]'::jsonb) lines
  FROM public.tasks t LEFT JOIN LATERAL (SELECT product_id,sum(quantity) quantity FROM public.resolve_laundry_bag_lines(t.id) GROUP BY product_id) q ON true LEFT JOIN public.stock_products p ON p.id=q.product_id
  WHERE t.id=ANY(_tasks) AND public.laundry_cycle_eligible(t.id) GROUP BY t.id,t.sede_id,t.propiedad_id
 )
 SELECT coalesce(jsonb_agg(jsonb_build_object('taskId',c.id,'lines',c.lines,'cycleState',b.state,'generation',coalesce(b.generation,0),'preparedAt',b.prepared_at,'deliveredAt',b.delivered_at,
 'destinationChanged',b.property_id IS DISTINCT FROM c.propiedad_id AND b.id IS NOT NULL,
 'contentChanged',(b.lines IS DISTINCT FROM c.canonical OR b.property_id IS DISTINCT FROM c.propiedad_id) AND b.id IS NOT NULL,
 'dirtyLines',public.laundry_cycle_dirty_lines(c.propiedad_id,c.sede_id),
 'collected',EXISTS(SELECT 1 FROM public.laundry_cycle_events e WHERE e.task_key=c.id AND e.property_id=c.propiedad_id AND e.kind='collect'))),'[]')
 FROM content c LEFT JOIN public.laundry_cycle_bags b ON b.task_key=c.id;
$$;

CREATE FUNCTION public.laundry_cycle_stock_checked(_sede uuid,_from date,_to date) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF auth.uid() IS NULL OR NOT (_sede=ANY(public.get_user_stock_sedes())) OR NOT EXISTS(SELECT 1 FROM public.user_roles WHERE user_id=auth.uid() AND role::text IN ('admin','manager','logistics','supervisor')) THEN RAISE EXCEPTION 'No tienes acceso a esta sede' USING ERRCODE='42501'; END IF;
 IF _from IS NULL OR _to IS NULL OR _to<_from OR _to-_from>31 THEN RAISE EXCEPTION 'Intervalo inválido'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.laundry_cycle_config WHERE sede_id=_sede AND active) THEN RETURN jsonb_build_object('active',false,'levels','[]'::jsonb,'tasks','[]'::jsonb); END IF;
 RETURN jsonb_build_object('active',true,
 'levels',coalesce((SELECT jsonb_agg(jsonb_build_object('warehouseId',l.warehouse_id,'productId',l.product_id,'quantity',l.current_quantity,'reserved',public.laundry_cycle_reserved(l.warehouse_id,l.product_id)))
 FROM public.stock_levels l JOIN public.stock_warehouses w ON w.id=l.warehouse_id WHERE w.sede_id=_sede),'[]'),
 'tasks',coalesce((SELECT jsonb_agg(jsonb_build_object('taskId',t.id,'lines',content.lines,
 'state',CASE WHEN jsonb_array_length(content.lines)=0 THEN 'review'
 WHEN EXISTS(SELECT 1 FROM public.laundry_cycle_issues i WHERE i.task_key=t.id AND i.code='route_issue' AND i.resolved_at IS NULL) THEN 'issue'
 WHEN b.id IS NULL OR b.state IN ('released','returned') THEN 'pending'
 WHEN b.property_id<>t.propiedad_id THEN 'review'
 WHEN b.state IN ('prepared','delivered') AND (b.lines<>content.lines OR b.destination_id IS DISTINCT FROM public.laundry_cycle_destination(t.propiedad_id,_sede)) THEN 'review'
 WHEN b.state='used' THEN 'delivered' ELSE b.state END)) FROM public.tasks t LEFT JOIN public.laundry_cycle_bags b ON b.task_key=t.id
 CROSS JOIN LATERAL (SELECT coalesce(jsonb_agg(jsonb_build_object('productId',q.product_id,'quantity',q.quantity) ORDER BY q.product_id),'[]'::jsonb) lines FROM (SELECT product_id,sum(quantity) quantity FROM public.resolve_laundry_bag_lines(t.id) GROUP BY product_id) q) content
 WHERE t.sede_id=_sede AND t.date BETWEEN _from AND _to AND t.status NOT IN ('cancelled','completed') AND public.laundry_cycle_eligible(t.id)),'[]'));
END $$;

CREATE FUNCTION public.laundry_cycle_resolve_issue_checked(_issue uuid,_reason text,_operation uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE i public.laundry_cycle_issues; key text;
BEGIN
 SELECT * INTO STRICT i FROM public.laundry_cycle_issues WHERE id=_issue;
 PERFORM public.laundry_cycle_admin(i.sede_id); PERFORM 1 FROM public.laundry_cycle_config WHERE sede_id=i.sede_id FOR UPDATE;
 IF _operation IS NULL OR length(trim(coalesce(_reason,'')))<3 THEN RAISE EXCEPTION 'Explica cómo has comprobado la incidencia'; END IF;
 key:='issue_resolution:'||_operation;
 IF EXISTS(SELECT 1 FROM public.laundry_cycle_events WHERE operation_key=key AND payload=jsonb_build_object('issue',_issue,'reason',_reason)) THEN RETURN; END IF;
 IF EXISTS(SELECT 1 FROM public.laundry_cycle_events WHERE operation_key=key) THEN RAISE EXCEPTION 'Identificador ya utilizado'; END IF;
 IF i.code='cleaning_failed' AND i.resolved_at IS NULL THEN RAISE EXCEPTION 'Reintenta primero el movimiento de limpieza pendiente'; END IF;
 UPDATE public.laundry_cycle_issues SET resolved_at=now() WHERE id=_issue;
 INSERT INTO public.laundry_cycle_events(operation_key,sede_id,task_key,kind,payload) VALUES(key,i.sede_id,i.task_key,'issue_resolved',jsonb_build_object('issue',_issue,'reason',_reason));
END $$;

CREATE FUNCTION public.laundry_cycle_settings_guard() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF (NEW.laundry_route_inventory_enabled OR NEW.auto_consumption_enabled) AND EXISTS(SELECT 1 FROM public.laundry_cycle_config WHERE sede_id=NEW.sede_id AND active)
 THEN RAISE EXCEPTION 'El circuito completo está activo: no actives los motores anteriores'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER laundry_cycle_settings_guard BEFORE INSERT OR UPDATE ON public.stock_sede_settings FOR EACH ROW EXECUTE FUNCTION public.laundry_cycle_settings_guard();

CREATE FUNCTION public.laundry_cycle_tracking_guard() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE b public.laundry_cycle_bags; collected boolean;
BEGIN
 IF NOT public.laundry_cycle_eligible(NEW.task_id) AND NOT EXISTS(SELECT 1 FROM public.laundry_cycle_bags bag JOIN public.laundry_cycle_config c ON c.sede_id=bag.sede_id AND c.active WHERE bag.task_key=NEW.task_id) THEN RETURN NEW; END IF;
 SELECT * INTO b FROM public.laundry_cycle_bags WHERE task_key=NEW.task_id;
 IF (NEW.status='delivered' AND (b.id IS NULL OR b.state NOT IN ('delivered','used')))
 OR (NEW.status='prepared' AND (b.id IS NULL OR b.state<>'prepared'))
 OR (NEW.status='pending' AND b.state IN ('delivered','used')) THEN RAISE EXCEPTION 'El circuito está activo: usa la ruta nueva con PIN o confirma la corrección física desde Inventario'; END IF;
 SELECT EXISTS(SELECT 1 FROM public.laundry_cycle_events e JOIN public.tasks t ON t.id=NEW.task_id WHERE e.task_key=t.id AND e.property_id=t.propiedad_id AND e.kind='collect') INTO collected;
 IF (NEW.collection_status='collected' AND NOT collected) OR (TG_OP='UPDATE' AND OLD.collection_status='collected' AND NEW.collection_status='pending' AND collected) THEN RAISE EXCEPTION 'La recogida debe registrarse en la ruta nueva con PIN; se conserva lo que ya ocurrió físicamente'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER laundry_cycle_tracking_guard BEFORE INSERT OR UPDATE ON public.laundry_delivery_tracking FOR EACH ROW EXECUTE FUNCTION public.laundry_cycle_tracking_guard();

DO $$ DECLARE fn record; BEGIN
 FOR fn IN SELECT p.oid,p.proname,pg_get_function_identity_arguments(p.oid) args FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
 WHERE n.nspname='public' AND (p.proname LIKE 'laundry_cycle_%' OR p.proname IN ('configure_laundry_cycle_checked','open_laundry_cycle_checked','activate_laundry_cycle_checked','read_laundry_cycle_checked','retry_laundry_cycle_checked','resolve_laundry_cycle_bag_checked')) LOOP
 EXECUTE format('REVOKE ALL ON FUNCTION public.%I(%s) FROM PUBLIC,anon,authenticated',fn.proname,fn.args);
 EXECUTE format('GRANT EXECUTE ON FUNCTION public.%I(%s) TO service_role',fn.proname,fn.args);
 IF fn.proname LIKE '%_checked' THEN EXECUTE format('GRANT EXECUTE ON FUNCTION public.%I(%s) TO authenticated',fn.proname,fn.args); END IF;
 END LOOP;
END $$;

-- The entire schema, function replacement, triggers and grants are atomic.
COMMIT;
