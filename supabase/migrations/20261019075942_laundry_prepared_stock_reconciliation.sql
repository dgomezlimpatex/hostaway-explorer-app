-- Physical bag confirmation reconciles only missing clean textiles, with audit.
-- No backfill, automatic bag confirmation, permissions or scheduling changes.
BEGIN;
CREATE OR REPLACE FUNCTION public.laundry_cycle_route(_task uuid, _link uuid, _action text, _worker uuid, _cleaner uuid, _name text, _snapshot jsonb DEFAULT NULL::jsonb, _issue text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE t public.tasks; c public.laundry_cycle_config; l public.laundry_share_links;
 b public.laundry_cycle_bags; line record; content jsonb; dest uuid; available numeric; dirty record; dirty_set public.laundry_cycle_dirty_sets; processed integer:=0; key text; event_id uuid; collected_lines jsonb:='[]'; required_stock numeric; stock_reconciliations jsonb:='[]';
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
 IF b.state IN ('delivered','used') THEN RAISE EXCEPTION 'La bolsa ya se entregó; conserva su historial'; END IF;
 content:=public.laundry_cycle_lines(_task); dest:=public.laundry_cycle_destination(t.propiedad_id,t.sede_id);
 IF _snapshot->'cycleLines' IS DISTINCT FROM content THEN RAISE EXCEPTION 'La dotación cambió después de abrir la ruta: recarga antes de preparar'; END IF;
 FOR line IN SELECT * FROM jsonb_to_recordset(content) x("productId" uuid,quantity numeric) ORDER BY "productId" LOOP
  -- The worker confirms the physical contents, including clean linen whose return
  -- was not recorded. Reconcile only the shortage, preserving other reservations.
  INSERT INTO public.stock_levels(product_id,warehouse_id,current_quantity)
  VALUES(line."productId",c.central_id,0) ON CONFLICT DO NOTHING;
  SELECT current_quantity INTO STRICT available FROM public.stock_levels WHERE product_id=line."productId" AND warehouse_id=c.central_id FOR UPDATE;
  required_stock:=public.laundry_cycle_reserved(c.central_id,line."productId",b.id)+line.quantity;
  IF available<required_stock THEN
   UPDATE public.stock_levels SET current_quantity=required_stock,last_updated=now()
   WHERE product_id=line."productId" AND warehouse_id=c.central_id;
   INSERT INTO public.stock_movements(product_id,warehouse_id,movement_type,quantity,previous_quantity,new_quantity,reason,task_id,property_id)
   VALUES(line."productId",c.central_id,'ajuste',required_stock-available,available,required_stock,
    'Ajuste de ropa disponible confirmado al preparar bolsa · inventario estimado',_task,t.propiedad_id);
   stock_reconciliations:=stock_reconciliations||jsonb_build_array(jsonb_build_object('productId',line."productId",'quantity',required_stock-available,'previousQuantity',available,'newQuantity',required_stock));
  END IF;
 END LOOP;
 INSERT INTO public.laundry_cycle_bags(task_key,task_id,property_id,sede_id,property_code,central_id,destination_id,state,lines)
 VALUES(_task,_task,t.propiedad_id,t.sede_id,(SELECT codigo FROM public.properties WHERE id=t.propiedad_id),c.central_id,dest,'prepared',content)
 ON CONFLICT(task_key) DO UPDATE SET state='prepared',lines=EXCLUDED.lines,destination_id=EXCLUDED.destination_id,prepared_at=now(),property_id=EXCLUDED.property_id,property_code=EXCLUDED.property_code,task_id=EXCLUDED.task_id,central_id=EXCLUDED.central_id,
 generation=CASE WHEN public.laundry_cycle_bags.state IN ('released','returned') OR public.laundry_cycle_bags.lines IS DISTINCT FROM EXCLUDED.lines THEN public.laundry_cycle_bags.generation+1 ELSE public.laundry_cycle_bags.generation END
 RETURNING * INTO b;
 PERFORM public.upsert_laundry_route_preparation_checked(_task,_link,'prepare',NULL,_worker,_cleaner,_name,_snapshot);
 INSERT INTO public.laundry_cycle_events(operation_key,sede_id,task_id,task_key,property_id,kind,payload)
 VALUES('preparation:'||_task||':'||b.generation,t.sede_id,_task,_task,t.propiedad_id,'prepared',jsonb_build_object('lines',b.lines,'snapshot',_snapshot,'stockReconciliations',stock_reconciliations,'workerId',_worker,'cleanerId',_cleaner,'worker',_name)) ON CONFLICT(operation_key) DO NOTHING RETURNING id INTO event_id;
 IF event_id IS NOT NULL THEN INSERT INTO public.laundry_route_worker_events(share_link_id,task_id,route_worker_id,worker_name,action,details) VALUES(_link,_task,_worker,_name,'prepare',jsonb_build_object('cycle_event_id',event_id)); END IF;
 UPDATE public.laundry_cycle_issues SET resolved_at=now() WHERE task_key=_task AND code='route_issue';
 RETURN jsonb_build_object('processed',jsonb_array_length(content),'reserved',true,'stockReconciliations',stock_reconciliations);
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
END $function$;
COMMIT;
