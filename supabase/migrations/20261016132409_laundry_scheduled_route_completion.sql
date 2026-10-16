-- Dani: prepared bags are delivered/collected on their route day at 17:00 Madrid.
-- Separate from confirmation time and service date. No historical catch-up.
BEGIN;
CREATE TABLE public.laundry_scheduled_completions (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 task_key uuid NOT NULL, task_id uuid REFERENCES public.tasks(id) ON DELETE SET NULL,
 share_link_id uuid REFERENCES public.laundry_share_links(id) ON DELETE SET NULL,
 sede_id uuid NOT NULL REFERENCES public.sedes(id), property_id uuid NOT NULL REFERENCES public.properties(id),
 service_date date NOT NULL, delivery_date date NOT NULL, due_at timestamptz NOT NULL,
 preparation_key text NOT NULL, snapshot jsonb NOT NULL, generation integer,
 mode text NOT NULL CHECK(mode IN ('cycle','partial','tracking')),
 status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','completed','cancelled','blocked')),
 created_at timestamptz NOT NULL DEFAULT now(), finished_at timestamptz, detail text,
 UNIQUE(task_key,preparation_key)
);
ALTER TABLE public.laundry_scheduled_completions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.laundry_scheduled_completions FROM PUBLIC,anon,authenticated,service_role;
-- This private operational queue is accessed only by its trigger and the postgres cron job.
CREATE INDEX laundry_scheduled_completions_due ON public.laundry_scheduled_completions(due_at) WHERE status='pending';

CREATE FUNCTION public.laundry_prepared_route_date(_task uuid,_link uuid) RETURNS date
LANGUAGE plpgsql STABLE SET search_path='' AS $$
DECLARE t public.tasks; l public.laundry_share_links;
BEGIN
 SELECT * INTO t FROM public.tasks WHERE id=_task;
 SELECT * INTO l FROM public.laundry_share_links WHERE id=_link AND workflow_version='route_v2' AND is_active;
 IF t.id IS NULL OR l.id IS NULL OR t.sede_id IS DISTINCT FROM l.sede_id OR t.status='cancelled'
  OR NOT coalesce(t.id=ANY(l.snapshot_task_ids),false) THEN RETURN NULL; END IF;
 IF EXISTS(SELECT 1 FROM jsonb_array_elements_text(coalesce(l.filters->'routeDates','[]')) d WHERE d.value=t.date::text) THEN
  RETURN (l.filters->>'deliveryDate')::date;
 ELSIF EXISTS(SELECT 1 FROM jsonb_array_elements_text(coalesce(l.filters->'nextRouteDates','[]')) d WHERE d.value=t.date::text) THEN
  RETURN (l.filters->>'nextDeliveryDate')::date;
 END IF;
 RETURN NULL;
END $$;

CREATE FUNCTION public.enqueue_laundry_completion(_task uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE p public.laundry_bag_preparations; t public.tasks; b public.laundry_cycle_bags;
 partial public.stock_bag_consumption; route_date date; prep_key text; inventory_mode text; bag_generation integer;
BEGIN
 SELECT * INTO p FROM public.laundry_bag_preparations WHERE task_id=_task;
 SELECT * INTO t FROM public.tasks WHERE id=_task;
 IF p.status IS DISTINCT FROM 'prepared' THEN
  UPDATE public.laundry_scheduled_completions SET status='cancelled',finished_at=now(),detail='Preparación retirada o con incidencia' WHERE task_key=_task AND status='pending';
  RETURN;
 END IF;
 route_date:=public.laundry_prepared_route_date(_task,p.last_share_link_id);
 -- Classic links and historical/unsupported links are not silently reinterpreted.
 IF route_date IS NULL THEN RETURN; END IF;
 IF p.content_snapshot->>'propertyId' IS DISTINCT FROM t.propiedad_id::text
 OR p.content_snapshot->>'date' IS DISTINCT FROM t.date::text THEN RAISE EXCEPTION 'La bolsa cambió: vuelve a confirmar su contenido'; END IF;
 IF public.laundry_cycle_eligible(_task) THEN
  SELECT * INTO STRICT b FROM public.laundry_cycle_bags WHERE task_key=_task;
  inventory_mode:='cycle'; bag_generation:=b.generation; prep_key:='cycle:'||b.generation;
 ELSIF EXISTS(SELECT 1 FROM public.stock_bag_accounting_config WHERE sede_id=t.sede_id AND active) THEN
  SELECT * INTO STRICT partial FROM public.stock_bag_consumption WHERE task_key=_task;
  inventory_mode:='partial'; prep_key:='partial:'||extract(epoch FROM partial.changed_at)::text;
 ELSE
  inventory_mode:='tracking';
  prep_key:='tracking:'||md5(jsonb_build_object('property',t.propiedad_id,'date',t.date,'textiles',p.content_snapshot->'textiles','amenities',p.content_snapshot->'amenities','stock',p.content_snapshot->'stockConsumables')::text);
 END IF;
 UPDATE public.laundry_scheduled_completions SET status='cancelled',finished_at=now(),detail='Sustituida por nueva preparación'
 WHERE task_key=_task AND preparation_key<>prep_key AND status='pending';
 INSERT INTO public.laundry_scheduled_completions(task_key,task_id,share_link_id,sede_id,property_id,service_date,delivery_date,due_at,preparation_key,snapshot,generation,mode)
 VALUES(_task,_task,p.last_share_link_id,t.sede_id,t.propiedad_id,t.date,route_date,(route_date+time '17:00') AT TIME ZONE 'Europe/Madrid',prep_key,p.content_snapshot,bag_generation,inventory_mode)
 ON CONFLICT(task_key,preparation_key) DO UPDATE SET
 share_link_id=EXCLUDED.share_link_id,service_date=EXCLUDED.service_date,delivery_date=EXCLUDED.delivery_date,due_at=EXCLUDED.due_at,
 snapshot=EXCLUDED.snapshot,status='pending',finished_at=NULL,detail=NULL
 WHERE public.laundry_scheduled_completions.status<>'completed';
END $$;

CREATE FUNCTION public.queue_prepared_laundry_completion() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 PERFORM public.enqueue_laundry_completion(NEW.task_id);
 RETURN NEW;
END $$;
CREATE TRIGGER zzz_queue_prepared_laundry_completion
AFTER INSERT OR UPDATE OF status,content_snapshot,last_share_link_id ON public.laundry_bag_preparations
FOR EACH ROW EXECUTE FUNCTION public.queue_prepared_laundry_completion();

CREATE FUNCTION public.complete_scheduled_laundry_bag(_job uuid,_at timestamptz) RETURNS void
LANGUAGE plpgsql SET search_path='' AS $$
DECLARE j public.laundry_scheduled_completions; t public.tasks; p public.laundry_bag_preparations;
 c public.laundry_cycle_config; b public.laundry_cycle_bags; partial public.stock_bag_consumption;
 line record; dirty record; dirty_set public.laundry_cycle_dirty_sets; amount numeric;
 collected_lines jsonb:='[]'; delivery_key text; collection_key text; sources jsonb;
BEGIN
 SELECT * INTO STRICT j FROM public.laundry_scheduled_completions WHERE id=_job;
 IF j.status<>'pending' OR j.due_at>_at THEN RETURN; END IF;
 SELECT * INTO STRICT t FROM public.tasks WHERE id=j.task_id FOR UPDATE;
 SELECT * INTO STRICT p FROM public.laundry_bag_preparations WHERE task_id=t.id FOR UPDATE;
 -- Preparation locks its task/preparation before the queue; keep that lock order.
 SELECT * INTO STRICT j FROM public.laundry_scheduled_completions WHERE id=_job FOR UPDATE;
 IF j.status<>'pending' OR j.due_at>_at THEN RETURN; END IF;
 IF t.status='cancelled' OR t.propiedad_id IS DISTINCT FROM j.property_id OR t.sede_id IS DISTINCT FROM j.sede_id
 OR t.date IS DISTINCT FROM j.service_date OR p.status<>'prepared' OR p.content_snapshot IS DISTINCT FROM j.snapshot
 OR public.laundry_prepared_route_date(t.id,j.share_link_id) IS DISTINCT FROM j.delivery_date THEN
  RAISE EXCEPTION 'La tarea, bolsa o ruta cambió: revisar antes del registro automático';
 END IF;
 IF EXISTS(SELECT 1 FROM public.stock_sede_settings WHERE sede_id=j.sede_id AND laundry_route_inventory_enabled) THEN
  RAISE EXCEPTION 'Hay un motor antiguo activo: revisar para evitar duplicados';
 END IF;
 IF j.mode='cycle' THEN
  IF NOT public.laundry_cycle_eligible(t.id) THEN RAISE EXCEPTION 'El circuito ya no está activo para esta propiedad'; END IF;
  SELECT * INTO STRICT c FROM public.laundry_cycle_config WHERE sede_id=j.sede_id FOR UPDATE;
  SELECT * INTO STRICT b FROM public.laundry_cycle_bags WHERE task_key=t.id FOR UPDATE;
  IF b.generation<>j.generation OR b.property_id<>j.property_id OR b.state NOT IN ('prepared','delivered','used')
  OR b.lines IS DISTINCT FROM public.laundry_cycle_lines(t.id)
  OR b.destination_id IS DISTINCT FROM public.laundry_cycle_destination(j.property_id,j.sede_id) THEN
   RAISE EXCEPTION 'La bolsa física o su destino cambió: revisar la preparación';
  END IF;
  delivery_key:='route:'||j.share_link_id||':'||t.id||':deliver:'||b.generation;
  collection_key:='collection:'||t.id||':'||j.property_id;
  IF b.state='prepared' THEN
   IF EXISTS(SELECT 1 FROM public.laundry_cycle_events WHERE operation_key=delivery_key) THEN RAISE EXCEPTION 'Entrega previa incompatible con bolsa preparada'; END IF;
   UPDATE public.laundry_cycle_bags SET state='delivered',delivered_at=_at WHERE id=b.id;
   FOR line IN SELECT * FROM jsonb_to_recordset(b.lines) x("productId" uuid,quantity numeric) ORDER BY "productId" LOOP
    PERFORM public.laundry_cycle_move(line."productId",b.central_id,-line.quantity,t.id,j.property_id,'Entrega automática de muda a las 17:00');
    IF b.destination_id IS NOT NULL THEN PERFORM public.laundry_cycle_move(line."productId",b.destination_id,line.quantity,t.id,j.property_id,'Muda recibida automáticamente en trastero'); END IF;
   END LOOP;
   INSERT INTO public.laundry_cycle_events(operation_key,sede_id,task_id,task_key,property_id,kind,payload,happened_at)
   VALUES(delivery_key,j.sede_id,t.id,t.id,j.property_id,'deliver',jsonb_build_object('lines',b.lines,'automatic',true,'scheduledJob',j.id,'scheduledFor',j.due_at),_at);
  END IF;
  IF NOT EXISTS(SELECT 1 FROM public.laundry_cycle_events WHERE operation_key=collection_key) THEN
   IF c.collection_mode IS NULL THEN RAISE EXCEPTION 'Falta el modo de recogida'; END IF;
   IF c.collection_mode='one' THEN
    SELECT * INTO dirty_set FROM public.laundry_cycle_dirty_sets WHERE property_id=j.property_id AND collected_at IS NULL ORDER BY created_at,task_key LIMIT 1 FOR UPDATE;
   END IF;
   FOR dirty IN SELECT * FROM public.laundry_cycle_dirty WHERE property_id=j.property_id AND quantity>0 ORDER BY product_id FOR UPDATE LOOP
    amount:=dirty.quantity;
    IF c.collection_mode='one' THEN
     SELECT quantity INTO amount FROM jsonb_to_recordset(coalesce(dirty_set.lines,'[]')) x("productId" uuid,quantity numeric) WHERE x."productId"=dirty.product_id;
     IF amount IS NULL THEN CONTINUE; END IF;
     IF amount>dirty.quantity THEN RAISE EXCEPTION 'La muda sucia no coincide con el saldo'; END IF;
    END IF;
    UPDATE public.laundry_cycle_dirty SET quantity=quantity-amount WHERE property_id=dirty.property_id AND product_id=dirty.product_id;
    IF dirty.warehouse_id IS NOT NULL THEN
     UPDATE public.laundry_dirty_stock SET current_quantity=current_quantity-amount WHERE warehouse_id=dirty.warehouse_id AND product_id=dirty.product_id AND current_quantity>=amount;
     IF NOT FOUND THEN RAISE EXCEPTION 'El saldo sucio del trastero no coincide'; END IF;
    END IF;
    IF c.collection_destination='central' THEN
     INSERT INTO public.laundry_cycle_collected(sede_id,product_id,quantity) VALUES(j.sede_id,dirty.product_id,amount)
     ON CONFLICT(sede_id,product_id) DO UPDATE SET quantity=public.laundry_cycle_collected.quantity+EXCLUDED.quantity;
    ELSE
     INSERT INTO public.laundry_cycle_pool(sede_id,product_id,quantity) VALUES(j.sede_id,dirty.product_id,amount)
     ON CONFLICT(sede_id,product_id) DO UPDATE SET quantity=public.laundry_cycle_pool.quantity+EXCLUDED.quantity;
    END IF;
    collected_lines:=collected_lines||jsonb_build_array(jsonb_build_object('productId',dirty.product_id,'quantity',amount));
   END LOOP;
   UPDATE public.laundry_cycle_dirty_sets SET collected_at=_at WHERE property_id=j.property_id AND collected_at IS NULL AND (c.collection_mode='all' OR task_key=dirty_set.task_key);
   INSERT INTO public.laundry_cycle_events(operation_key,sede_id,task_id,task_key,property_id,kind,payload,happened_at)
   VALUES(collection_key,j.sede_id,t.id,t.id,j.property_id,'collect',jsonb_build_object('collectedLines',collected_lines,'automatic',true,'scheduledJob',j.id,'scheduledFor',j.due_at),_at);
  END IF;
 ELSIF j.mode='partial' THEN
  PERFORM public.lock_stock_bag_sede(j.sede_id);
  IF NOT EXISTS(SELECT 1 FROM public.stock_bag_accounting_config WHERE sede_id=j.sede_id AND active) THEN RAISE EXCEPTION 'Cambió el modo provisional'; END IF;
  SELECT * INTO STRICT partial FROM public.stock_bag_consumption WHERE task_key=t.id FOR UPDATE;
  IF partial.state<>'prepared' OR 'partial:'||extract(epoch FROM partial.changed_at)::text<>j.preparation_key THEN RAISE EXCEPTION 'Cambió el contenido preparado'; END IF;
  SELECT jsonb_agg(jsonb_build_object('productId',s.product_id,'sourceKey',s.source_key,'multiplier',s.multiplier,'kind',s.kind) ORDER BY s.product_id)
  INTO sources FROM public.stock_bag_accounting_sources s WHERE sede_id=j.sede_id;
  IF public.stock_bag_normalize(j.snapshot,sources,false) IS DISTINCT FROM partial.lines THEN RAISE EXCEPTION 'Cambió el material preparado'; END IF;
  -- Partial accounting already deducted the bag on preparation. Tracking only.
 ELSE
  IF public.laundry_cycle_eligible(t.id) OR EXISTS(SELECT 1 FROM public.stock_bag_accounting_config WHERE sede_id=j.sede_id AND active) THEN
   RAISE EXCEPTION 'El inventario se activó después de preparar: revisar esta bolsa';
  END IF;
 END IF;
 INSERT INTO public.laundry_delivery_tracking(share_link_id,task_id,status,collection_status,delivered_at,collected_at,delivered_by_name,collected_by_name)
 VALUES(j.share_link_id,t.id,'delivered','collected',_at,_at,'Automático · reparto 17:00','Automático · reparto 17:00')
 ON CONFLICT(share_link_id,task_id) DO UPDATE SET status='delivered',collection_status='collected',
 delivered_at=CASE WHEN public.laundry_delivery_tracking.status='delivered' THEN coalesce(public.laundry_delivery_tracking.delivered_at,EXCLUDED.delivered_at) ELSE EXCLUDED.delivered_at END,
 collected_at=CASE WHEN public.laundry_delivery_tracking.collection_status='collected' THEN coalesce(public.laundry_delivery_tracking.collected_at,EXCLUDED.collected_at) ELSE EXCLUDED.collected_at END,
 delivered_by_name=CASE WHEN public.laundry_delivery_tracking.status='delivered' THEN public.laundry_delivery_tracking.delivered_by_name ELSE EXCLUDED.delivered_by_name END,
 collected_by_name=CASE WHEN public.laundry_delivery_tracking.collection_status='collected' THEN public.laundry_delivery_tracking.collected_by_name ELSE EXCLUDED.collected_by_name END;
 UPDATE public.laundry_scheduled_completions SET status='completed',finished_at=_at,detail='Entrega y recogida registradas automáticamente' WHERE id=j.id;
 UPDATE public.laundry_cycle_issues SET resolved_at=_at WHERE sede_id=j.sede_id AND task_key=t.id AND code='scheduled_route_failed';
END $$;

CREATE FUNCTION public.run_scheduled_laundry_completions(_at timestamptz DEFAULT now()) RETURNS jsonb
LANGUAGE plpgsql SET search_path='' AS $$
DECLARE job record; completed integer:=0; blocked integer:=0;
BEGIN
 -- Avoid overlap with another tick, including slow or manually invoked runs.
 IF NOT pg_try_advisory_xact_lock(761016,1700) THEN RETURN jsonb_build_object('busy',true); END IF;
 FOR job IN SELECT id,sede_id,task_key FROM public.laundry_scheduled_completions WHERE status='pending' AND due_at<=_at ORDER BY due_at,id LIMIT 500 LOOP
  BEGIN
   PERFORM public.complete_scheduled_laundry_bag(job.id,_at);
   completed:=completed+1;
  EXCEPTION WHEN OTHERS THEN
   -- The subtransaction rolls back both delivery and collection on any error.
   UPDATE public.laundry_scheduled_completions SET status='blocked',finished_at=_at,detail=SQLERRM WHERE id=job.id;
   INSERT INTO public.laundry_cycle_issues(sede_id,task_key,code,detail) VALUES(job.sede_id,job.task_key,'scheduled_route_failed',SQLERRM)
   ON CONFLICT(sede_id,task_key,code) DO UPDATE SET detail=EXCLUDED.detail,resolved_at=NULL;
   blocked:=blocked+1;
  END;
 END LOOP;
 RETURN jsonb_build_object('completed',completed,'blocked',blocked);
END $$;

REVOKE ALL ON FUNCTION public.laundry_prepared_route_date(uuid,uuid),public.enqueue_laundry_completion(uuid),public.queue_prepared_laundry_completion(),public.complete_scheduled_laundry_bag(uuid,timestamptz),public.run_scheduled_laundry_completions(timestamptz) FROM PUBLIC,anon,authenticated,service_role;
-- The function owner (postgres) retains execution. No new client RPC or permission.

-- Adopt only already-prepared bags for today's/future routes. No old route completion.
DO $$ DECLARE p record; BEGIN
 FOR p IN SELECT task_id FROM public.laundry_bag_preparations WHERE status='prepared'
 AND public.laundry_prepared_route_date(task_id,last_share_link_id)>=(now() AT TIME ZONE 'Europe/Madrid')::date LOOP
  PERFORM public.enqueue_laundry_completion(p.task_id);
 END LOOP;
END $$;

-- Minute ticks honour Madrid DST via due_at, recover a missed tick and accept late bags.
SELECT cron.schedule('laundry-prepared-route-completion','* * * * *',$cron$SELECT public.run_scheduled_laundry_completions();$cron$);
COMMIT;
