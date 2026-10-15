-- Replenishment uses the clean spare already at the property; a route may arrive after cleaning.
-- Unknown opening balances remain explicitly unknown, without a fictitious zero count.
BEGIN;
ALTER TABLE public.laundry_cycle_config ADD COLUMN opening_unknown_kinds text[] NOT NULL DEFAULT '{}'
 CHECK(opening_unknown_kinds <@ ARRAY['outside','rejected','collected']::text[] AND array_position(opening_unknown_kinds,NULL) IS NULL);
CREATE OR REPLACE FUNCTION public.laundry_cycle_complete(_task uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE t public.tasks; b public.laundry_cycle_bags; line record; old_quantity numeric; key text; removed jsonb:='[]';
BEGIN
 SELECT * INTO STRICT t FROM public.tasks WHERE id=_task FOR UPDATE;
 IF t.status<>'completed' OR NOT public.laundry_cycle_eligible(_task) THEN RETURN jsonb_build_object('processed',0); END IF;
 PERFORM 1 FROM public.laundry_cycle_config WHERE sede_id=t.sede_id FOR UPDATE;
 key:='cleaning:'||_task;
 IF EXISTS(SELECT 1 FROM public.laundry_cycle_events WHERE operation_key=key) THEN RETURN jsonb_build_object('processed',0,'replayed',true); END IF;
 IF EXISTS(SELECT 1 FROM public.laundry_cycle_events e WHERE e.task_key=t.id AND e.kind='opening_cleaning' AND e.property_id=t.propiedad_id AND e.payload->>'date'=t.date::text) THEN
  RETURN jsonb_build_object('processed',0,'includedInOpening',true);
 END IF;
 -- Consume the oldest physical spare at this property. The bag associated
 -- with this cleaning can be its later replenishment and must remain intact.
 SELECT * INTO b FROM public.laundry_cycle_bags
 WHERE property_id=t.propiedad_id AND sede_id=t.sede_id AND state='delivered'
 ORDER BY coalesce(delivered_at,prepared_at),id LIMIT 1 FOR UPDATE;
 IF b.id IS NULL THEN RAISE EXCEPTION 'Falta una muda limpia disponible en la propiedad'; END IF;
 IF b.destination_id IS DISTINCT FROM public.laundry_cycle_destination(t.propiedad_id,t.sede_id) THEN
  RAISE EXCEPTION 'La ubicación de la muda cambió; confirma dónde está antes de utilizarla';
 END IF;
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
 VALUES(key,t.sede_id,_task,_task,t.propiedad_id,'cleaning',jsonb_build_object('replacement',b.lines,'consumedBagId',b.id,'replenishmentTask',_task));
 UPDATE public.laundry_cycle_issues SET resolved_at=now() WHERE task_key=_task AND code='cleaning_failed';
 RETURN jsonb_build_object('processed',jsonb_array_length(b.lines));
END $$;
CREATE OR REPLACE FUNCTION public.laundry_cycle_route(_task uuid,_link uuid,_action text,_worker uuid,_cleaner uuid,_name text,_snapshot jsonb DEFAULT NULL,_issue text DEFAULT NULL)
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
CREATE OR REPLACE FUNCTION public.validate_laundry_cycle_opening(_sede uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE c public.laundry_cycle_config; prop record; product record; destination uuid;
BEGIN
 SELECT * INTO STRICT c FROM public.laundry_cycle_config WHERE sede_id=_sede FOR UPDATE;
 IF c.active THEN RETURN; END IF;
 IF EXISTS(SELECT 1 FROM public.laundry_cycle_scope s JOIN public.properties p ON p.id=s.property_id LEFT JOIN public.clients cl ON cl.id=p.cliente_id WHERE s.sede_id=_sede AND (p.sede_id<>_sede OR NOT coalesce(p.is_active,cl.is_active,false) OR NOT coalesce(p.linen_control_enabled,cl.linen_control_enabled,false))) THEN RAISE EXCEPTION 'El alcance cambió desde la preparación: revisa las propiedades antes de activar'; END IF;
 IF cardinality(c.opening_unknown_kinds)>0 AND c.strict_receipts THEN RAISE EXCEPTION 'Un saldo inicial desconocido necesita recepción sin bloqueo por saldo previo'; END IF;
 IF c.opened_at IS NULL OR c.collection_mode IS NULL THEN RAISE EXCEPTION 'Falta el recuento o la operativa'; END IF;
 IF c.collection_mode='one' AND EXISTS(SELECT 1 FROM public.laundry_cycle_openings WHERE sede_id=_sede AND kind='dirty' AND quantity>0) THEN RAISE EXCEPTION 'Para recoger una muda por visita, empieza sin sucia anterior: recoge la acumulada antes del recuento o elige recoger toda'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.laundry_receipt_links l WHERE l.warehouse_id=c.central_id AND l.is_active AND EXISTS(SELECT 1 FROM public.laundry_route_workers w WHERE w.id=ANY(l.worker_ids) AND w.sede_id=_sede AND w.is_active)) THEN RAISE EXCEPTION 'Prepara el acceso de recepción con un empleado activo'; END IF;
 IF EXISTS(SELECT 1 FROM public.laundry_cycle_products p WHERE p.sede_id=_sede AND NOT EXISTS(SELECT 1 FROM public.laundry_receipt_links l,jsonb_each_text(l.product_map) m WHERE l.warehouse_id=c.central_id AND l.is_active AND m.value=p.product_id::text)) THEN RAISE EXCEPTION 'Falta una tipología del circuito en la recepción de lavandería'; END IF;
 IF EXISTS(SELECT 1 FROM public.laundry_receipts r JOIN public.laundry_receipt_links l ON l.id=r.link_id WHERE l.warehouse_id=c.central_id AND r.latest_version=0 AND r.updated_at<=c.opened_at AND r.receipt_date>=c.start_date) THEN RAISE EXCEPTION 'Hay recepciones pendientes anteriores al recuento: termínalas antes de volver a contar y activar'; END IF;
 IF EXISTS(SELECT 1 FROM public.laundry_cycle_openings o LEFT JOIN public.stock_levels l ON l.product_id=o.product_id AND l.warehouse_id=o.warehouse_id
 WHERE o.sede_id=_sede AND o.kind='clean' AND o.warehouse_id IS NOT NULL AND l.current_quantity IS DISTINCT FROM o.quantity) THEN RAISE EXCEPTION 'El stock cambió después del recuento: vuelve a comprobarlo'; END IF;
 IF EXISTS(SELECT 1 FROM public.stock_sede_settings WHERE sede_id=_sede AND (laundry_route_inventory_enabled OR auto_consumption_enabled)) THEN RAISE EXCEPTION 'Desactiva los motores anteriores para evitar duplicar movimientos'; END IF;
 IF EXISTS(SELECT 1 FROM public.laundry_cycle_openings WHERE sede_id=_sede AND prepared_quantity>0) THEN RAISE EXCEPTION 'Hay bolsas anteriores preparadas: vincúlalas al circuito o deshazlas físicamente y actualiza el recuento'; END IF;
 IF EXISTS(SELECT 1 FROM public.tasks t JOIN public.laundry_cycle_scope s ON s.property_id=t.propiedad_id AND s.sede_id=t.sede_id WHERE t.sede_id=_sede AND t.date>=c.start_date AND t.status='completed' AND NOT EXISTS(SELECT 1 FROM public.laundry_cycle_events e WHERE e.task_key=t.id AND e.kind='opening_cleaning' AND e.property_id=t.propiedad_id AND e.payload->>'date'=t.date::text)) THEN RAISE EXCEPTION 'La fecha incluye limpiezas ya realizadas'; END IF;
 FOR prop IN SELECT p.* FROM public.properties p JOIN public.laundry_cycle_scope s ON s.property_id=p.id WHERE s.sede_id=_sede LOOP
  destination:=public.laundry_cycle_destination(prop.id,_sede);
  FOR product IN SELECT product_id id FROM public.laundry_cycle_products WHERE sede_id=_sede LOOP
   IF NOT EXISTS(SELECT 1 FROM public.laundry_cycle_openings WHERE sede_id=_sede AND product_id=product.id AND kind='clean' AND warehouse_id=c.central_id)
   OR (NOT ('outside'=ANY(c.opening_unknown_kinds)) AND NOT EXISTS(SELECT 1 FROM public.laundry_cycle_openings WHERE sede_id=_sede AND product_id=product.id AND kind='outside'))
   OR (NOT ('rejected'=ANY(c.opening_unknown_kinds)) AND NOT EXISTS(SELECT 1 FROM public.laundry_cycle_openings WHERE sede_id=_sede AND product_id=product.id AND kind='rejected' AND warehouse_id=c.central_id))
   OR (NOT ('collected'=ANY(c.opening_unknown_kinds)) AND NOT EXISTS(SELECT 1 FROM public.laundry_cycle_openings WHERE sede_id=_sede AND product_id=product.id AND kind='collected' AND warehouse_id=c.central_id))
   OR NOT EXISTS(SELECT 1 FROM public.laundry_cycle_openings WHERE sede_id=_sede AND product_id=product.id AND kind='installed' AND property_id=prop.id)
   OR NOT EXISTS(SELECT 1 FROM public.laundry_cycle_openings WHERE sede_id=_sede AND product_id=product.id AND kind='dirty' AND property_id=prop.id AND warehouse_id IS NOT DISTINCT FROM destination)
   OR (destination IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.laundry_cycle_openings WHERE sede_id=_sede AND product_id=product.id AND kind='clean' AND warehouse_id=destination)) THEN RAISE EXCEPTION 'Faltan categorías contadas; un dato ausente no significa cero'; END IF;
   IF destination IS NULL AND NOT EXISTS(SELECT 1 FROM public.laundry_cycle_openings WHERE sede_id=_sede AND product_id=product.id AND kind='clean' AND warehouse_id IS NULL AND property_id=prop.id) THEN RAISE EXCEPTION 'Cuenta también las bolsas limpias que esperan en la propiedad'; END IF;
  END LOOP;
 END LOOP;
END $$;
REVOKE ALL ON FUNCTION public.validate_laundry_cycle_opening(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.validate_laundry_cycle_opening(uuid) TO service_role;
CREATE OR REPLACE FUNCTION public.activate_laundry_cycle_checked(_sede uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 PERFORM public.laundry_cycle_admin(_sede);
 PERFORM 1 FROM public.laundry_cycle_config WHERE sede_id=_sede FOR UPDATE;
 PERFORM public.validate_laundry_cycle_opening(_sede);
 UPDATE public.laundry_cycle_config SET active=true WHERE sede_id=_sede;
END $$;
CREATE OR REPLACE FUNCTION public.close_stock_bag_accounting_checked(_sede uuid,_operation uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE answer jsonb;
BEGIN
 PERFORM public.laundry_cycle_admin(_sede); PERFORM public.lock_stock_bag_accounting();
 PERFORM 1 FROM public.stock_sede_settings WHERE sede_id=_sede FOR UPDATE;
 IF _operation IS NULL THEN RAISE EXCEPTION 'Falta identidad de operación'; END IF;
 IF EXISTS(SELECT 1 FROM public.stock_bag_accounting_operations WHERE operation_key=_operation AND (sede_id<>_sede OR kind<>'close')) THEN RAISE EXCEPTION 'Operación ya usada con otros datos'; END IF;
 SELECT result INTO answer FROM public.stock_bag_accounting_operations WHERE operation_key=_operation;
 IF FOUND THEN RETURN answer; END IF;
 IF EXISTS(SELECT 1 FROM public.stock_bag_accounting_config c JOIN public.stock_bag_accounting_sources s USING(sede_id)
  LEFT JOIN public.stock_levels l ON l.product_id=s.product_id AND l.warehouse_id=c.central_id
  WHERE c.sede_id=_sede AND (l.current_quantity<0 OR (l.quantity_basis IS DISTINCT FROM 'counted' AND NOT (
   s.kind='laundry' AND s.source_key='custom'
   AND NOT EXISTS(SELECT 1 FROM public.stock_property_field_mappings m WHERE m.sede_id=c.sede_id AND m.product_id=s.product_id AND m.is_active)
   AND NOT EXISTS(SELECT 1 FROM public.stock_property_consumption_rules r JOIN public.properties p ON p.id=r.property_id WHERE p.sede_id=c.sede_id AND r.product_id=s.product_id AND r.is_active AND r.quantity_per_cleaning>0)
  )))) THEN RAISE EXCEPTION 'Cuenta cada producto antes de cerrar el arranque provisional'; END IF;
 UPDATE public.stock_bag_accounting_config SET active=false WHERE sede_id=_sede AND active;
 IF NOT FOUND THEN RAISE EXCEPTION 'No hay un arranque activo'; END IF;
 answer:=jsonb_build_object('closed',true);
 INSERT INTO public.stock_bag_accounting_operations VALUES(_operation,_sede,'close',md5(_sede::text),answer,auth.uid(),now()); RETURN answer;
END $$;
CREATE OR REPLACE FUNCTION public.laundry_cycle_stock_checked(_sede uuid,_from date,_to date) RETURNS jsonb
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
 WHERE t.sede_id=_sede AND t.date BETWEEN _from AND _to AND t.status<>'cancelled' AND public.laundry_cycle_eligible(t.id)),'[]'));
END $$;
CREATE OR REPLACE FUNCTION public.laundry_cycle_adopt_checked(_sede uuid,_bags jsonb) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE c public.laundry_cycle_config; input record; t public.tasks; line record; content jsonb; bag_state text; dest uuid; counted_location uuid;
BEGIN
 PERFORM public.laundry_cycle_admin(_sede);
 SELECT * INTO STRICT c FROM public.laundry_cycle_config WHERE sede_id=_sede AND NOT active AND opened_at IS NOT NULL FOR UPDATE;
 IF jsonb_typeof(_bags) IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'Indica las bolsas físicamente contadas'; END IF;
 FOR input IN SELECT * FROM jsonb_to_recordset(_bags) x("taskId" uuid,lines jsonb,state text) LOOP
  SELECT * INTO STRICT t FROM public.tasks WHERE id=input."taskId" AND sede_id=_sede AND date>=c.start_date AND status<>'cancelled' FOR UPDATE;
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
CREATE OR REPLACE FUNCTION public.apply_stock_bag_consumption() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE config public.stock_bag_accounting_config; bag public.stock_bag_consumption; task_row public.tasks;
 sources jsonb; lines jsonb; before_lines jsonb; previous_snapshot jsonb; source jsonb; level_row public.stock_levels;
 change numeric; previous numeric; next_amount numeric; full_cycle boolean:=false;
BEGIN
 IF NEW.status<>'prepared' THEN RETURN NEW; END IF;
 SELECT * INTO task_row FROM public.tasks WHERE id=NEW.task_id;
 SELECT EXISTS(SELECT 1 FROM public.laundry_cycle_config c WHERE c.sede_id=task_row.sede_id AND c.active AND public.laundry_cycle_eligible(task_row.id)) INTO full_cycle;
 SELECT * INTO config FROM public.stock_bag_accounting_config WHERE sede_id=task_row.sede_id AND (active OR full_cycle);
 IF NOT FOUND THEN RETURN NEW; END IF;
 PERFORM public.lock_stock_bag_sede(config.sede_id);
 IF NEW.content_snapshot->>'propertyId' IS DISTINCT FROM task_row.propiedad_id::text THEN RAISE EXCEPTION 'La propiedad cambió: recarga la ruta'; END IF;
 SELECT jsonb_agg(jsonb_build_object('productId',s.product_id,'sourceKey',s.source_key,'multiplier',s.multiplier,'kind',s.kind) ORDER BY s.product_id)
 INTO sources FROM public.stock_bag_accounting_sources s WHERE sede_id=config.sede_id AND (NOT full_cycle OR s.kind='amenity');
 IF sources IS NULL THEN RETURN NEW; END IF;
 lines:=public.stock_bag_normalize(NEW.content_snapshot,sources,false);
 IF EXISTS(SELECT 1 FROM jsonb_array_elements(NEW.content_snapshot->'stockConsumables') x
  WHERE NOT EXISTS(SELECT 1 FROM public.stock_bag_accounting_sources s WHERE s.sede_id=config.sede_id AND s.product_id::text=x->>'productId')) THEN
  RAISE EXCEPTION 'Hay un producto nuevo sin configurar para el descuento por bolsas';
 END IF;
 IF EXISTS(SELECT 1 FROM public.stock_property_consumption_rules WHERE property_id=task_row.propiedad_id AND is_active AND quantity_per_cleaning>0 AND warehouse_id IS NOT NULL AND warehouse_id<>config.central_id) THEN
  RAISE EXCEPTION 'Hay productos configurados en otro almacén; revisa su origen'; END IF;
 SELECT * INTO bag FROM public.stock_bag_consumption WHERE task_key=NEW.task_id FOR UPDATE;
 IF FOUND THEN before_lines:=bag.lines;
 ELSE
  SELECT e.bag_items INTO previous_snapshot FROM public.laundry_bag_action_ledger e WHERE e.task_key=NEW.task_id AND e.action='prepared'
   AND (e.happened_at AT TIME ZONE 'Europe/Madrid')::date<config.start_date ORDER BY e.happened_at DESC,e.id DESC LIMIT 1;
  IF previous_snapshot IS NULL AND TG_OP='UPDATE' AND (OLD.prepared_at AT TIME ZONE 'Europe/Madrid')::date<config.start_date THEN previous_snapshot:=OLD.content_snapshot; END IF;
  before_lines:=CASE WHEN previous_snapshot IS NULL THEN '{}'::jsonb ELSE public.stock_bag_normalize(previous_snapshot,sources,true) END;
 END IF;
 IF full_cycle THEN
  SELECT coalesce(jsonb_object_agg(e.key,e.value),'{}') INTO before_lines FROM jsonb_each(before_lines) e
   WHERE EXISTS(SELECT 1 FROM jsonb_array_elements(sources) s WHERE s->>'productId'=e.key);
 END IF;
 IF bag.task_key IS NOT NULL AND bag.state='prepared' AND lines=before_lines THEN RETURN NEW; END IF;
 IF NOT full_cycle AND bag.task_key IS NOT NULL AND NEW.content_snapshot ? 'stockChangedAt' AND (NEW.content_snapshot->>'stockChangedAt')::timestamptz IS DISTINCT FROM bag.changed_at THEN
  RAISE EXCEPTION 'La bolsa cambió: recarga antes de preparar' USING ERRCODE='40001';
 END IF;
 IF task_row.status='cancelled' OR (task_row.status='completed' AND NOT full_cycle) THEN RAISE EXCEPTION 'No prepares contenido nuevo para una limpieza terminada o cancelada'; END IF;
 IF bag.state='prepared' AND EXISTS(SELECT 1 FROM public.laundry_delivery_tracking d WHERE d.task_id=NEW.task_id AND d.status='delivered' AND d.delivered_at>=bag.changed_at) THEN
  RAISE EXCEPTION 'La bolsa ya se entregó: confirma su devolución antes de cambiar su contenido';
 END IF;
 PERFORM set_config('app.bag_stock_write','on',true);
 FOR source IN SELECT * FROM jsonb_array_elements(sources) LOOP
  IF bag.task_key IS NULL AND previous_snapshot IS NOT NULL AND NOT before_lines ? (source->>'productId') THEN CONTINUE; END IF;
  change:=coalesce((before_lines->>(source->>'productId'))::numeric,0)-coalesce((lines->>(source->>'productId'))::numeric,0);
  IF change=0 THEN CONTINUE; END IF;
  SELECT * INTO level_row FROM public.stock_levels WHERE warehouse_id=config.central_id AND product_id=(source->>'productId')::uuid FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Falta la existencia de un producto en el almacén'; END IF;
  previous:=level_row.current_quantity; next_amount:=previous+change;
  IF next_amount<0 AND level_row.quantity_basis<>'partial' THEN RAISE EXCEPTION 'No alcanza el stock contado para preparar esta bolsa'; END IF;
  UPDATE public.stock_levels SET current_quantity=next_amount WHERE id=level_row.id;
  INSERT INTO public.stock_movements(product_id,warehouse_id,movement_type,quantity,previous_quantity,new_quantity,reason,task_id,property_id)
   VALUES(level_row.product_id,config.central_id,CASE WHEN change<0 THEN 'consumo_automatico'::public.stock_movement_type ELSE 'entrada'::public.stock_movement_type END,
    abs(change),previous,next_amount,CASE WHEN change<0 THEN 'Contenido confirmado de bolsa' ELSE 'Corrección de contenido de bolsa' END,NEW.task_id,task_row.propiedad_id);
 END LOOP;
 INSERT INTO public.stock_bag_consumption(task_key,task_id,sede_id,central_id,state,generation,lines,changed_at,property_code,property_id)
  SELECT NEW.task_id,NEW.task_id,config.sede_id,config.central_id,'prepared',coalesce(bag.generation,1)+CASE WHEN bag.state='released' THEN 1 ELSE 0 END,
   CASE WHEN full_cycle THEN coalesce(bag.lines,'{}')||lines ELSE lines END,now(),coalesce(p.codigo,'Propiedad'),task_row.propiedad_id FROM public.properties p WHERE p.id=task_row.propiedad_id
 ON CONFLICT(task_key) DO UPDATE SET lines=EXCLUDED.lines,state=EXCLUDED.state,generation=EXCLUDED.generation,changed_at=EXCLUDED.changed_at;
 RETURN NEW;
END $$;
CREATE OR REPLACE FUNCTION public.resolve_laundry_cycle_bag_checked(_bag uuid,_action text,_reason text,_operation uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE b public.laundry_cycle_bags; row record; key text; consumption public.stock_bag_consumption; balance public.stock_levels;
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
 -- Consumables are consumed when the bag is prepared, independently of
 -- the physical linen transfer. A confirmed unpack/return restores them once.
 SELECT * INTO consumption FROM public.stock_bag_consumption WHERE task_key=b.task_key AND state='prepared' FOR UPDATE;
 IF FOUND THEN
  PERFORM set_config('app.bag_stock_write','on',true);
  FOR row IN SELECT e.key::uuid product_id,e.value::numeric quantity FROM jsonb_each_text(consumption.lines) e
   JOIN public.stock_bag_accounting_sources s ON s.sede_id=b.sede_id AND s.product_id=e.key::uuid AND s.kind='amenity'
   WHERE e.value::numeric>0 ORDER BY e.key LOOP
   SELECT * INTO STRICT balance FROM public.stock_levels WHERE warehouse_id=b.central_id AND product_id=row.product_id FOR UPDATE;
   UPDATE public.stock_levels SET current_quantity=current_quantity+row.quantity WHERE id=balance.id;
   INSERT INTO public.stock_movements(product_id,warehouse_id,movement_type,quantity,previous_quantity,new_quantity,reason,task_id,property_id,created_by)
   VALUES(row.product_id,b.central_id,'entrada',row.quantity,balance.current_quantity,balance.current_quantity+row.quantity,'Consumibles de bolsa devuelta o deshecha: '||_reason,b.task_id,b.property_id,auth.uid());
  END LOOP;
  UPDATE public.stock_bag_consumption SET state='released',lines='{}',changed_at=now() WHERE task_key=b.task_key;
 END IF;
 INSERT INTO public.laundry_cycle_events(operation_key,sede_id,task_id,task_key,property_id,kind,payload)
 VALUES(key,b.sede_id,b.task_id,b.task_key,b.property_id,'physical_resolution',jsonb_build_object('bag',_bag,'action',_action,'reason',_reason,'priorPreparation',(SELECT to_jsonb(p) FROM public.laundry_bag_preparations p WHERE p.task_id=b.task_id)));
 UPDATE public.laundry_bag_preparations SET status='pending',content_snapshot=NULL,snapshot_locked_at=NULL,route_delivery_status='pending',route_novelty_type='undone',route_novelty_resolved=false,updated_at=now(),undone_at=now(),undone_reason=_reason,undone_by_name=(SELECT full_name FROM public.profiles WHERE id=auth.uid()) WHERE task_id=b.task_id;
 UPDATE public.laundry_delivery_tracking SET status='pending',delivered_at=NULL,delivered_by_name=NULL,delivered_by_worker_id=NULL WHERE task_id=b.task_id;
END $$;
CREATE OR REPLACE FUNCTION public.apply_laundry_receipt_operation(_link uuid, _worker uuid, _admin uuid, _actor_name text, _date date, _op_id uuid, _payload jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE result jsonb; c public.laundry_cycle_config; r public.laundry_receipts; l public.laundry_receipt_links;
 old public.laundry_cycle_receipt_postings; item record; current_pool numeric; delta numeric; matched numeric; new_pooled numeric; key text; previous_counts jsonb; reject_delta numeric; new_rejected numeric; new_quarantined numeric; quarantine_balance numeric; returned numeric;
BEGIN
 -- Same lock order as mutate_laundry_receipt: receipt link, configuration,
 -- then stock. Taking configuration only after the legacy stock write would
 -- deadlock with route delivery or cleaner completion.
 SELECT * INTO STRICT l FROM public.laundry_receipt_links WHERE id=_link FOR UPDATE;
 PERFORM public.lock_stock_bag_sede((SELECT sede_id FROM public.stock_warehouses WHERE id=l.warehouse_id));
 SELECT * INTO c FROM public.laundry_cycle_config WHERE central_id=l.warehouse_id AND active FOR UPDATE;
 SELECT * INTO r FROM public.laundry_receipts WHERE link_id=_link AND receipt_date=_date FOR UPDATE;
 IF c.sede_id IS NOT NULL AND _payload->>'action'='confirm' AND coalesce(r.latest_version,0)=0 AND _date<c.start_date THEN
  RAISE EXCEPTION 'Esta recepción histórica está fuera del arranque: se conserva el borrador; corrige el stock mediante un recuento si procede';
 END IF;
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
END $function$

;
-- Existing signatures, actors, grants and RLS remain in force.
COMMIT;

