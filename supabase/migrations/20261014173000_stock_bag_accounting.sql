-- Prepared only. Activate separately after reviewing the live preview.
BEGIN;
ALTER TABLE public.stock_levels ADD COLUMN quantity_basis text NOT NULL DEFAULT 'registered'
 CHECK(quantity_basis IN ('registered','partial','counted'));
ALTER TABLE public.stock_levels ADD COLUMN counted_at timestamptz;
ALTER TABLE public.stock_levels DROP CONSTRAINT stock_levels_non_negative;
ALTER TABLE public.stock_levels ADD CONSTRAINT stock_levels_non_negative CHECK(
 (current_quantity>=0 OR quantity_basis='partial') AND current_quantity::text NOT IN ('NaN','Infinity','-Infinity')
 AND minimum_quantity>=0 AND target_quantity>=0 AND (cost_per_unit IS NULL OR cost_per_unit>=0));

CREATE TABLE public.stock_bag_accounting_config (
 sede_id uuid PRIMARY KEY REFERENCES public.sedes(id), central_id uuid NOT NULL REFERENCES public.stock_warehouses(id),
 start_date date NOT NULL, active boolean NOT NULL DEFAULT false, activated_at timestamptz NOT NULL DEFAULT now(),
 activated_by uuid REFERENCES auth.users(id), operation_key uuid NOT NULL UNIQUE
);
CREATE TABLE public.stock_bag_accounting_sources (
 sede_id uuid NOT NULL REFERENCES public.sedes(id), product_id uuid NOT NULL REFERENCES public.stock_products(id) ON DELETE RESTRICT,
 source_key text NOT NULL, multiplier numeric NOT NULL CHECK(multiplier>0 AND multiplier=trunc(multiplier)),
 kind text NOT NULL CHECK(kind IN ('laundry','amenity')),
 PRIMARY KEY(sede_id,product_id),
 CHECK(source_key='custom' OR source_key IN ('textiles.sheets','textiles.sheetsSmall','textiles.sheetsSuite','textiles.pillowCases','textiles.towelsLarge','textiles.towelsSmall','textiles.bathMats','amenities.trashSacks100L'))
);
CREATE TABLE public.stock_bag_consumption (
 task_key uuid PRIMARY KEY, task_id uuid REFERENCES public.tasks(id) ON DELETE SET NULL,
 sede_id uuid NOT NULL REFERENCES public.sedes(id), central_id uuid NOT NULL REFERENCES public.stock_warehouses(id),
 state text NOT NULL CHECK(state IN ('prepared','released')), generation integer NOT NULL DEFAULT 1,
 lines jsonb NOT NULL, changed_at timestamptz NOT NULL, property_code text NOT NULL,
 property_id uuid REFERENCES public.properties(id) ON DELETE SET NULL
);
CREATE TABLE public.stock_bag_accounting_operations (
 operation_key uuid PRIMARY KEY, sede_id uuid NOT NULL REFERENCES public.sedes(id), kind text NOT NULL,
 request_hash text NOT NULL, result jsonb NOT NULL, actor_id uuid REFERENCES auth.users(id), happened_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX stock_bag_consumption_sede ON public.stock_bag_consumption(sede_id,state);
DO $$ DECLARE object_name text; BEGIN
 FOREACH object_name IN ARRAY ARRAY['stock_bag_accounting_config','stock_bag_accounting_sources','stock_bag_consumption','stock_bag_accounting_operations'] LOOP
  EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',object_name);
  EXECUTE format('REVOKE ALL ON public.%I FROM PUBLIC,anon,authenticated',object_name);
  EXECUTE format('GRANT SELECT ON public.%I TO authenticated',object_name);
  EXECUTE format('GRANT ALL ON public.%I TO service_role',object_name);
  EXECUTE format('CREATE POLICY bag_stock_sede_read ON public.%I FOR SELECT TO authenticated USING(sede_id=ANY(public.get_user_stock_sedes()) AND EXISTS(SELECT 1 FROM public.user_roles WHERE user_id=auth.uid() AND role::text IN (''admin'',''manager'',''logistics'',''supervisor'')))',object_name);
 END LOOP;
END $$;

-- Only opening/closing briefly pause preparation. Daily operations retain row
-- locks; the sede settings fence excludes them during a mode transition.
CREATE FUNCTION public.lock_stock_bag_accounting() RETURNS void LANGUAGE plpgsql SET search_path='' AS $$
BEGIN LOCK TABLE public.laundry_bag_preparations IN SHARE ROW EXCLUSIVE MODE; END;
$$;
CREATE FUNCTION public.lock_stock_bag_sede(_sede uuid) RETURNS void LANGUAGE plpgsql SET search_path='' AS $$
BEGIN PERFORM 1 FROM public.stock_sede_settings WHERE sede_id=_sede FOR SHARE; END;
$$;

CREATE FUNCTION public.guard_stock_bag_basis() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF (TG_OP='INSERT' AND NEW.quantity_basis<>'registered') OR
    (TG_OP='UPDATE' AND NEW.quantity_basis IS DISTINCT FROM OLD.quantity_basis) THEN
  IF current_setting('app.bag_stock_write',true) IS DISTINCT FROM 'on' THEN
   RAISE EXCEPTION 'La base del saldo solo cambia mediante una operación comprobada' USING ERRCODE='42501';
  END IF;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER guard_stock_bag_basis BEFORE INSERT OR UPDATE OF quantity_basis ON public.stock_levels
 FOR EACH ROW EXECUTE FUNCTION public.guard_stock_bag_basis();

CREATE FUNCTION public.guard_stock_bag_settings() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF EXISTS(SELECT 1 FROM public.stock_bag_accounting_config c WHERE c.sede_id=NEW.sede_id AND c.active)
 AND (NEW.estimated_amenities_enabled OR NEW.auto_consumption_enabled OR NEW.laundry_route_inventory_enabled) THEN
  RAISE EXCEPTION 'El descuento por bolsas ya está activo. No actives otro descuento para la misma sede';
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER guard_stock_bag_settings BEFORE INSERT OR UPDATE ON public.stock_sede_settings
 FOR EACH ROW EXECUTE FUNCTION public.guard_stock_bag_settings();
CREATE FUNCTION public.guard_bag_stock_full_cycle() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 PERFORM public.lock_stock_bag_sede(NEW.sede_id);
 IF EXISTS(SELECT 1 FROM public.stock_bag_accounting_config c WHERE c.sede_id=NEW.sede_id AND c.active) THEN
  RAISE EXCEPTION 'Cierra el arranque provisional tras contar el almacén antes de activar el circuito físico';
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER guard_bag_stock_full_cycle BEFORE INSERT OR UPDATE OF active ON public.laundry_cycle_config
 FOR EACH ROW EXECUTE FUNCTION public.guard_bag_stock_full_cycle();

CREATE OR REPLACE FUNCTION public.laundry_cycle_stock_guard() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF TG_OP='DELETE' THEN
  IF public.laundry_cycle_reserved(OLD.warehouse_id,OLD.product_id)>0 THEN RAISE EXCEPTION 'Hay ropa reservada: no se puede borrar el saldo'; END IF;
  IF EXISTS(SELECT 1 FROM public.stock_bag_accounting_config c JOIN public.stock_bag_accounting_sources s USING(sede_id)
   WHERE c.active AND c.central_id=OLD.warehouse_id AND s.product_id=OLD.product_id) THEN RAISE EXCEPTION 'No borres un saldo del arranque operativo; conserva su historial'; END IF;
  RETURN OLD;
 END IF;
 IF NEW.current_quantity::text IN ('NaN','Infinity','-Infinity') THEN RAISE EXCEPTION 'Saldo de ropa no válido'; END IF;
 IF NEW.quantity_basis='partial' AND EXISTS(SELECT 1 FROM public.stock_bag_accounting_config c JOIN public.stock_bag_accounting_sources s USING(sede_id)
  WHERE c.active AND c.central_id=NEW.warehouse_id AND s.product_id=NEW.product_id) THEN RETURN NEW; END IF;
 IF NEW.current_quantity<public.laundry_cycle_reserved(NEW.warehouse_id,NEW.product_id) THEN
 RAISE EXCEPTION 'Hay ropa reservada en bolsas: resuelve esas bolsas antes de reducir el stock'; END IF;
 RETURN NEW;
END $$;

CREATE FUNCTION public.stock_bag_normalize(_snapshot jsonb,_sources jsonb,_historical boolean DEFAULT false) RETURNS jsonb
LANGUAGE plpgsql SET search_path='' AS $$
DECLARE source jsonb; item jsonb; raw jsonb; value numeric; answer jsonb:='{}'; count_items integer;
BEGIN
 IF jsonb_typeof(_snapshot) IS DISTINCT FROM 'object' THEN RAISE EXCEPTION 'Falta el contenido confirmado de una bolsa'; END IF;
 FOR source IN SELECT * FROM jsonb_array_elements(_sources) LOOP
  SELECT count(*),min(x::text)::jsonb INTO count_items,item FROM jsonb_array_elements(
   CASE WHEN jsonb_typeof(_snapshot->'stockConsumables')='array' THEN _snapshot->'stockConsumables' ELSE '[]'::jsonb END) x
   WHERE x->>'productId'=source->>'productId';
  IF count_items>1 THEN RAISE EXCEPTION 'Un producto aparece dos veces en la bolsa'; END IF;
  IF count_items=1 THEN raw:=item->'quantity';
  ELSIF source->>'sourceKey'='custom' THEN
   IF jsonb_typeof(_snapshot->'stockConsumables') IS DISTINCT FROM 'array' THEN
    IF _historical THEN CONTINUE; END IF;
    RAISE EXCEPTION 'Falta el contenido de consumibles de la bolsa';
   END IF;
   raw:='0'::jsonb;
  ELSE raw:=_snapshot #> string_to_array(source->>'sourceKey','.'); END IF;
  IF raw IS NULL OR raw='null'::jsonb THEN
   IF _historical THEN CONTINUE; END IF;
   RAISE EXCEPTION 'Falta detalle de % en una bolsa',source->>'sourceKey';
  END IF;
  IF jsonb_typeof(raw)<>'number' THEN RAISE EXCEPTION 'Cantidad de bolsa no válida'; END IF;
  value:=raw::text::numeric;
  IF value<0 OR value<>round(value,2) OR (source->>'kind'='laundry' AND value<>trunc(value)) OR value::text IN ('NaN','Infinity','-Infinity') THEN RAISE EXCEPTION 'Cantidad de bolsa no válida'; END IF;
  IF count_items=0 AND source->>'sourceKey'<>'custom' THEN value:=value*(source->>'multiplier')::numeric; END IF;
  answer:=answer||jsonb_build_object(source->>'productId',value);
 END LOOP;
 RETURN answer;
END $$;

CREATE FUNCTION public.preview_stock_bag_accounting_checked(_sede uuid,_central uuid,_start date) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE sources jsonb; rows jsonb:='[]'; bags jsonb:='[]'; source jsonb; material record; observation record;
 current_lines jsonb; prior_lines jsonb; snapshot jsonb; amount numeric; prepared numeric;
 adjustment record; plan jsonb; settings jsonb; mapping_count integer; source_key text; factor numeric; prior_event uuid; untracked integer;
BEGIN
 PERFORM public.laundry_cycle_admin(_sede);
 IF _start IS NULL OR _start>(now() AT TIME ZONE 'Europe/Madrid')::date THEN RAISE EXCEPTION 'Fecha de inicio inválida'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.stock_warehouses WHERE id=_central AND sede_id=_sede AND is_active AND location_type='central') THEN RAISE EXCEPTION 'Almacén central no válido'; END IF;
 IF EXISTS(SELECT 1 FROM public.laundry_cycle_config WHERE sede_id=_sede) THEN RAISE EXCEPTION 'Ya hay un circuito físico configurado; revisa su apertura antes de usar otro modo'; END IF;
 IF EXISTS(SELECT 1 FROM public.stock_bag_accounting_config WHERE sede_id=_sede) THEN RAISE EXCEPTION 'Esta sede ya tiene un arranque registrado; no vuelvas a cargarlo'; END IF;
 SELECT to_jsonb(s) INTO settings FROM public.stock_sede_settings s WHERE sede_id=_sede;
 IF settings IS NULL THEN RAISE EXCEPTION 'Falta configuración de la sede'; END IF;
 sources:='[]';
 FOR material IN SELECT p.*,c.kind FROM public.stock_products p JOIN public.stock_categories c ON c.id=p.category_id
 WHERE p.sede_id=_sede AND p.is_active AND c.kind IN ('laundry','amenity') ORDER BY p.id LOOP
  source_key:='custom'; factor:=1;
  SELECT count(*),min(CASE m.property_field
   WHEN 'numero_sabanas' THEN 'textiles.sheets' WHEN 'numero_sabanas_pequenas' THEN 'textiles.sheetsSmall'
   WHEN 'numero_sabanas_suite' THEN 'textiles.sheetsSuite' WHEN 'numero_fundas_almohada' THEN 'textiles.pillowCases'
   WHEN 'numero_toallas_grandes' THEN 'textiles.towelsLarge' WHEN 'numero_toallas_pequenas' THEN 'textiles.towelsSmall'
   WHEN 'numero_alfombrines' THEN 'textiles.bathMats' END),min(m.multiplier)
  INTO mapping_count,source_key,factor FROM public.stock_property_field_mappings m
  WHERE m.sede_id=_sede AND m.product_id=material.id AND m.is_active
   AND m.property_field IN ('numero_sabanas','numero_sabanas_pequenas','numero_sabanas_suite','numero_fundas_almohada','numero_toallas_grandes','numero_toallas_pequenas','numero_alfombrines')
   AND (m.warehouse_id IS NULL OR m.warehouse_id=_central);
  IF mapping_count>1 THEN RAISE EXCEPTION 'Producto con correspondencia ambigua'; END IF;
  source_key:=coalesce(source_key,'custom'); factor:=coalesce(factor,1);
  IF material.sku='SACOS-BASURA-100L' OR trim(material.name) ~* '^sacos? (de )?basura 100[[:space:]]*l$' THEN source_key:='amenities.trashSacks100L'; END IF;
  sources:=sources||jsonb_build_array(jsonb_build_object('productId',material.id,'name',material.name,'kind',material.kind,'sourceKey',source_key,'multiplier',factor));
 END LOOP;
 IF jsonb_array_length(sources)=0 THEN RAISE EXCEPTION 'No hay productos para el arranque'; END IF;
 IF EXISTS(SELECT 1 FROM public.stock_property_consumption_rules r JOIN public.properties p ON p.id=r.property_id
  WHERE p.sede_id=_sede AND r.is_active AND r.quantity_per_cleaning>0 AND r.warehouse_id IS NOT NULL AND r.warehouse_id<>_central) THEN
  RAISE EXCEPTION 'Hay consumibles configurados en otra ubicación; revisa su origen antes del arranque';
 END IF;
 FOR observation IN
  WITH recent AS (SELECT DISTINCT ON(task_key) * FROM public.laundry_bag_action_ledger WHERE sede_id=_sede AND action='prepared' ORDER BY task_key,happened_at DESC,id DESC)
  SELECT recent.*,b.content_snapshot,p.codigo,t.propiedad_id FROM recent
   LEFT JOIN public.laundry_bag_preparations b ON b.task_id=recent.task_key
   LEFT JOIN public.tasks t ON t.id=recent.task_key LEFT JOIN public.properties p ON p.id=t.propiedad_id
  WHERE (recent.happened_at AT TIME ZONE 'Europe/Madrid')::date>=_start ORDER BY recent.task_key LOOP
  snapshot:=observation.bag_items;
  IF NOT snapshot ? 'amenities' AND observation.content_snapshot->'textiles'=snapshot->'textiles'
    AND observation.content_snapshot->'stockConsumables'=snapshot->'stockConsumables' THEN
   snapshot:=snapshot||jsonb_build_object('amenities',observation.content_snapshot->'amenities');
  END IF;
  current_lines:=public.stock_bag_normalize(snapshot,sources,true);
  SELECT public.stock_bag_normalize(e.bag_items,sources,true),e.id INTO prior_lines,prior_event FROM public.laundry_bag_action_ledger e
   WHERE e.sede_id=_sede AND e.task_key=observation.task_key AND e.action='prepared'
   AND (e.happened_at AT TIME ZONE 'Europe/Madrid')::date<_start ORDER BY e.happened_at DESC,e.id DESC LIMIT 1;
  bags:=bags||jsonb_build_array(jsonb_build_object('taskId',observation.task_key,'eventId',observation.id,'lines',current_lines,
   'previous',coalesce(prior_lines,'{}'),'priorEventId',prior_event,'changedAt',observation.happened_at,'propertyId',observation.propiedad_id,'propertyCode',coalesce(observation.codigo,'Propiedad retirada')));
 END LOOP;
 FOR source IN SELECT * FROM jsonb_array_elements(sources) LOOP
  SELECT * INTO adjustment FROM public.stock_movements m WHERE m.product_id=(source->>'productId')::uuid AND m.warehouse_id=_central
   AND m.movement_type='ajuste' AND (m.created_at AT TIME ZONE 'Europe/Madrid')::date>=_start
   AND m.task_id IS NULL
   AND m.reason !~ '^Recepción [0-9]{4}-[0-9]{2}-[0-9]{2} v[0-9]+' ORDER BY m.created_at DESC,m.id DESC LIMIT 1;
  IF source->>'kind'='laundry' AND adjustment.id IS NOT NULL THEN RAISE EXCEPTION 'Hay un ajuste de ropa que debe revisarse antes de reconstruir el saldo'; END IF;
  SELECT coalesce(sum(m.new_quantity-m.previous_quantity),0) INTO amount FROM public.stock_movements m
   WHERE m.product_id=(source->>'productId')::uuid AND m.warehouse_id=_central AND (
    (m.reason ~ '^Recepción [0-9]{4}-[0-9]{2}-[0-9]{2} v[0-9]+'
      AND substring(m.reason from '^Recepción ([0-9]{4}-[0-9]{2}-[0-9]{2})')::date>=_start)
    OR (m.movement_type IN ('entrada','salida') AND m.task_id IS NULL AND m.reason !~ '^Recepción [0-9]{4}-[0-9]{2}-[0-9]{2} v[0-9]+'
      AND NOT EXISTS(SELECT 1 FROM public.stock_estimated_amenity_entries e WHERE e.reversal_movement_id=m.id)
      AND (m.created_at AT TIME ZONE 'Europe/Madrid')::date>=_start
      AND (adjustment.id IS NULL OR (m.created_at,m.id)>(adjustment.created_at,adjustment.id))));
  amount:=amount+coalesce(adjustment.new_quantity,0);
  -- An absent historical quantity is unknown, never a physical zero. Keep the
  -- confirmed current content as the future baseline, without inventing its
  -- change since an older event whose detail is unavailable.
  SELECT coalesce(sum(CASE WHEN NOT (b->'lines') ? (source->>'productId')
    OR (b->>'priorEventId' IS NOT NULL AND NOT (b->'previous') ? (source->>'productId')) THEN 0
   ELSE (b->'lines'->>(source->>'productId'))::numeric-coalesce((b->'previous'->>(source->>'productId'))::numeric,0) END),0),
   count(*) FILTER(WHERE NOT (b->'lines') ? (source->>'productId') OR
    (b->>'priorEventId' IS NOT NULL AND NOT (b->'previous') ? (source->>'productId') AND (b->'lines'->>(source->>'productId'))::numeric<>0))
   INTO prepared,untracked FROM jsonb_array_elements(bags) b;
  rows:=rows||jsonb_build_array(source||jsonb_build_object('introduced',amount,'prepared',prepared,'proposed',amount-prepared,
   'untrackedBags',untracked,'registered',(SELECT current_quantity FROM public.stock_levels WHERE product_id=(source->>'productId')::uuid AND warehouse_id=_central),
   'version',(SELECT stock_version FROM public.stock_levels WHERE product_id=(source->>'productId')::uuid AND warehouse_id=_central)));
 END LOOP;
 plan:=jsonb_build_object('sedeId',_sede,'centralId',_central,'startDate',_start,'rows',rows,'bags',bags,'settings',settings);
 RETURN plan||jsonb_build_object('fingerprint',md5(plan::text));
END $$;

CREATE FUNCTION public.activate_stock_bag_accounting_checked(_sede uuid,_central uuid,_start date,_fingerprint text,_operation uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE plan jsonb; line jsonb; bag jsonb; level_row public.stock_levels; request_hash text; prior public.stock_bag_accounting_operations; answer jsonb;
BEGIN
 PERFORM public.laundry_cycle_admin(_sede); PERFORM public.lock_stock_bag_accounting();
 IF _operation IS NULL THEN RAISE EXCEPTION 'Falta identidad de operación'; END IF;
 request_hash:=md5(jsonb_build_array(_sede,_central,_start,_fingerprint)::text);
 SELECT * INTO prior FROM public.stock_bag_accounting_operations WHERE operation_key=_operation;
 IF FOUND THEN IF prior.sede_id<>_sede OR prior.request_hash<>request_hash OR prior.kind<>'activate' THEN RAISE EXCEPTION 'La operación ya existe con otro contenido'; END IF; RETURN prior.result||jsonb_build_object('replayed',true); END IF;
 PERFORM 1 FROM public.stock_sede_settings WHERE sede_id=_sede FOR UPDATE;
 PERFORM 1 FROM public.stock_levels WHERE warehouse_id=_central ORDER BY product_id FOR UPDATE;
 plan:=public.preview_stock_bag_accounting_checked(_sede,_central,_start);
 IF plan->>'fingerprint' IS DISTINCT FROM _fingerprint THEN RAISE EXCEPTION 'Los registros cambiaron: actualiza la vista previa antes de activar' USING ERRCODE='40001'; END IF;
 PERFORM set_config('app.bag_stock_write','on',true);
 UPDATE public.stock_sede_settings SET estimated_amenities_enabled=false,auto_consumption_enabled=false,laundry_route_inventory_enabled=false WHERE sede_id=_sede;
 INSERT INTO public.stock_bag_accounting_config VALUES(_sede,_central,_start,true,now(),auth.uid(),_operation);
 FOR line IN SELECT * FROM jsonb_array_elements(plan->'rows') LOOP
  INSERT INTO public.stock_bag_accounting_sources VALUES(_sede,(line->>'productId')::uuid,line->>'sourceKey',(line->>'multiplier')::numeric,line->>'kind');
  SELECT * INTO level_row FROM public.stock_levels WHERE product_id=(line->>'productId')::uuid AND warehouse_id=_central FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Falta la existencia de un producto en el almacén central'; END IF;
  UPDATE public.stock_levels SET current_quantity=(line->>'proposed')::numeric,quantity_basis='partial',counted_at=NULL,updated_by=auth.uid() WHERE id=level_row.id;
  IF level_row.current_quantity<>(line->>'proposed')::numeric THEN
   INSERT INTO public.stock_movements(product_id,warehouse_id,movement_type,quantity,previous_quantity,new_quantity,reason,created_by)
   VALUES(level_row.product_id,_central,'ajuste',abs(level_row.current_quantity-(line->>'proposed')::numeric),level_row.current_quantity,(line->>'proposed')::numeric,
    'Conciliación de saldo parcial desde '||_start||' · operación '||_operation,auth.uid());
  END IF;
 END LOOP;
 FOR bag IN SELECT * FROM jsonb_array_elements(plan->'bags') LOOP
  INSERT INTO public.stock_bag_consumption(task_key,task_id,sede_id,central_id,state,lines,changed_at,property_code,property_id)
   VALUES((bag->>'taskId')::uuid,NULL,_sede,_central,'prepared',bag->'lines',(bag->>'changedAt')::timestamptz,bag->>'propertyCode',(bag->>'propertyId')::uuid);
 END LOOP;
 answer:=jsonb_build_object('active',true,'sedeId',_sede,'centralId',_central,'startDate',_start,'products',jsonb_array_length(plan->'rows'),'bags',jsonb_array_length(plan->'bags'));
 INSERT INTO public.stock_bag_accounting_operations VALUES(_operation,_sede,'activate',request_hash,answer,auth.uid(),now());
 RETURN answer;
END $$;

CREATE OR REPLACE FUNCTION public.record_laundry_bag_action() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE task_sede uuid; changed_event boolean:=false;
BEGIN
 IF TG_OP='INSERT' THEN changed_event:=true;
 ELSE changed_event:=NEW.status IS DISTINCT FROM OLD.status OR (NEW.status='issue' AND NEW.issue_reason IS DISTINCT FROM OLD.issue_reason)
  OR (NEW.status='prepared' AND NEW.content_snapshot IS DISTINCT FROM OLD.content_snapshot); END IF;
 IF NEW.status IN ('prepared','issue') AND changed_event THEN
  SELECT sede_id INTO task_sede FROM public.tasks WHERE id=NEW.task_id;
  IF task_sede IS NULL THEN RAISE EXCEPTION 'Bag preparation task is missing'; END IF;
  INSERT INTO public.laundry_bag_action_ledger(task_key,share_link_id,sede_id,action,actor_name,issue_reason,bag_items)
  VALUES(NEW.task_id,NEW.last_share_link_id,task_sede,NEW.status,
   CASE WHEN NEW.status='prepared' THEN NEW.prepared_by_name ELSE NEW.issue_by_name END,
   CASE WHEN NEW.status='issue' THEN NEW.issue_reason ELSE NULL END,
   jsonb_build_object('textiles',NEW.content_snapshot->'textiles','amenities',NEW.content_snapshot->'amenities','stockConsumables',NEW.content_snapshot->'stockConsumables'));
 END IF; RETURN NEW;
END $$;

CREATE FUNCTION public.apply_stock_bag_consumption() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE config public.stock_bag_accounting_config; bag public.stock_bag_consumption; task_row public.tasks;
 sources jsonb; lines jsonb; before_lines jsonb; previous_snapshot jsonb; source jsonb; level_row public.stock_levels;
 change numeric; previous numeric; next_amount numeric;
BEGIN
 IF NEW.status<>'prepared' THEN RETURN NEW; END IF;
 SELECT * INTO task_row FROM public.tasks WHERE id=NEW.task_id;
 SELECT * INTO config FROM public.stock_bag_accounting_config WHERE sede_id=task_row.sede_id AND active;
 IF NOT FOUND THEN RETURN NEW; END IF;
 PERFORM public.lock_stock_bag_sede(config.sede_id);
 IF NEW.content_snapshot->>'propertyId' IS DISTINCT FROM task_row.propiedad_id::text THEN RAISE EXCEPTION 'La propiedad cambió: recarga la ruta'; END IF;
 SELECT jsonb_agg(jsonb_build_object('productId',s.product_id,'sourceKey',s.source_key,'multiplier',s.multiplier,'kind',s.kind) ORDER BY s.product_id)
 INTO sources FROM public.stock_bag_accounting_sources s WHERE sede_id=config.sede_id;
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
 IF bag.task_key IS NOT NULL AND bag.state='prepared' AND lines=before_lines THEN RETURN NEW; END IF;
 IF bag.task_key IS NOT NULL AND NEW.content_snapshot ? 'stockChangedAt' AND (NEW.content_snapshot->>'stockChangedAt')::timestamptz IS DISTINCT FROM bag.changed_at THEN
  RAISE EXCEPTION 'La bolsa cambió: recarga antes de preparar' USING ERRCODE='40001';
 END IF;
 IF task_row.status IN ('completed','cancelled') THEN RAISE EXCEPTION 'No prepares contenido nuevo para una limpieza terminada o cancelada'; END IF;
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
   lines,now(),coalesce(p.codigo,'Propiedad'),task_row.propiedad_id FROM public.properties p WHERE p.id=task_row.propiedad_id
 ON CONFLICT(task_key) DO UPDATE SET lines=EXCLUDED.lines,state=EXCLUDED.state,generation=EXCLUDED.generation,changed_at=EXCLUDED.changed_at;
 RETURN NEW;
END $$;
CREATE TRIGGER zz_apply_stock_bag_consumption AFTER INSERT OR UPDATE OF status,content_snapshot ON public.laundry_bag_preparations
 FOR EACH ROW EXECUTE FUNCTION public.apply_stock_bag_consumption();

CREATE FUNCTION public.adjust_bag_stock_checked(_level uuid,_kind text,_quantity numeric,_reason text,_cost numeric,_version bigint,_verified boolean,_operation uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE level_row public.stock_levels; sede uuid; next_amount numeric; difference numeric; request_hash text; prior public.stock_bag_accounting_operations; answer jsonb;
BEGIN
 SELECT * INTO level_row FROM public.stock_levels WHERE id=_level;
 IF NOT FOUND THEN RAISE EXCEPTION 'No se encontró esa existencia'; END IF;
 SELECT sede_id INTO sede FROM public.stock_warehouses WHERE id=level_row.warehouse_id AND is_active;
 PERFORM public.laundry_cycle_admin(sede);
 PERFORM public.lock_stock_bag_sede(sede);
 SELECT * INTO STRICT level_row FROM public.stock_levels WHERE id=_level FOR UPDATE;
 IF _operation IS NULL OR _quantity IS NULL OR _quantity<0 OR _quantity>=10000000 OR _quantity::text IN ('NaN','Infinity','-Infinity') OR _reason IS NULL OR length(trim(_reason))<3
  OR _kind IS NULL OR _verified IS NULL OR _kind NOT IN ('entrada','salida','ajuste') OR (_verified AND _kind<>'ajuste') OR (_cost IS NOT NULL AND (_cost<0 OR _cost::text IN ('NaN','Infinity','-Infinity'))) THEN RAISE EXCEPTION 'Movimiento no válido'; END IF;
 IF _quantity<>round(_quantity,2) THEN RAISE EXCEPTION 'La cantidad admite hasta dos decimales'; END IF;
 IF _quantity<>trunc(_quantity) AND EXISTS(SELECT 1 FROM public.stock_bag_accounting_sources WHERE sede_id=sede AND product_id=level_row.product_id AND kind='laundry') THEN RAISE EXCEPTION 'La ropa se cuenta en prendas enteras'; END IF;
 request_hash:=md5(jsonb_build_array(_level,_kind,_quantity,_reason,_cost,_version,_verified)::text);
 SELECT * INTO prior FROM public.stock_bag_accounting_operations WHERE operation_key=_operation;
 IF FOUND THEN IF prior.sede_id<>sede OR prior.request_hash<>request_hash OR prior.kind<>'adjust' THEN RAISE EXCEPTION 'Operación ya usada con otros datos'; END IF; RETURN prior.result||jsonb_build_object('replayed',true); END IF;
 IF NOT EXISTS(SELECT 1 FROM public.stock_bag_accounting_config c JOIN public.stock_bag_accounting_sources s USING(sede_id)
  WHERE c.sede_id=sede AND c.central_id=level_row.warehouse_id AND c.active AND s.product_id=level_row.product_id) THEN RAISE EXCEPTION 'Este producto no usa el descuento por bolsas'; END IF;
 IF _version IS DISTINCT FROM level_row.stock_version THEN RAISE EXCEPTION 'El saldo cambió mientras lo editabas. Actualiza y vuelve a comprobarlo' USING ERRCODE='40001'; END IF;
 next_amount:=CASE _kind WHEN 'entrada' THEN level_row.current_quantity+_quantity WHEN 'salida' THEN level_row.current_quantity-_quantity ELSE _quantity END;
 IF next_amount<0 AND level_row.quantity_basis<>'partial' THEN RAISE EXCEPTION 'No alcanza el stock contado'; END IF;
 difference:=next_amount-level_row.current_quantity;
 IF difference=0 AND NOT _verified THEN RAISE EXCEPTION 'La cantidad debe cambiar el saldo'; END IF;
 PERFORM set_config('app.bag_stock_write','on',true);
 UPDATE public.stock_levels SET current_quantity=next_amount,cost_per_unit=coalesce(_cost,cost_per_unit),updated_by=auth.uid(),
  quantity_basis=CASE WHEN _verified THEN 'counted' ELSE quantity_basis END,counted_at=CASE WHEN _verified THEN now() ELSE counted_at END WHERE id=_level;
 IF difference<>0 THEN
  INSERT INTO public.stock_movements(product_id,warehouse_id,movement_type,quantity,previous_quantity,new_quantity,reason,created_by)
  VALUES(level_row.product_id,level_row.warehouse_id,_kind::public.stock_movement_type,abs(difference),level_row.current_quantity,next_amount,trim(_reason),auth.uid());
 END IF;
 answer:=jsonb_build_object('previous_quantity',level_row.current_quantity,'new_quantity',next_amount,'quantity',abs(difference),'counted',_verified);
 INSERT INTO public.stock_bag_accounting_operations VALUES(_operation,sede,'adjust',request_hash,answer,auth.uid(),now()); RETURN answer;
END $$;

CREATE FUNCTION public.read_stock_bag_accounting_checked(_sede uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE config jsonb; bags jsonb;
BEGIN
 IF auth.uid() IS NULL OR NOT coalesce(_sede=ANY(public.get_user_stock_sedes()),false) OR NOT EXISTS(SELECT 1 FROM public.user_roles WHERE user_id=auth.uid() AND role::text IN ('admin','manager','logistics','supervisor')) THEN RAISE EXCEPTION 'Sin acceso a la sede' USING ERRCODE='42501'; END IF;
 SELECT to_jsonb(c) INTO config FROM public.stock_bag_accounting_config c WHERE sede_id=_sede;
 SELECT coalesce(jsonb_agg(to_jsonb(b)||jsonb_build_object('taskStatus',t.status,'taskDate',t.date,'delivered',EXISTS(SELECT 1 FROM public.laundry_delivery_tracking d WHERE d.task_id=b.task_key AND d.status='delivered' AND d.delivered_at>=b.changed_at)) ORDER BY b.changed_at DESC),'[]'::jsonb)
 INTO bags FROM public.stock_bag_consumption b LEFT JOIN public.tasks t ON t.id=b.task_key WHERE b.sede_id=_sede AND b.state='prepared' AND t.status IS DISTINCT FROM 'completed';
 RETURN jsonb_build_object('active',coalesce((config->>'active')::boolean,false),'config',config,'bags',bags);
END $$;

CREATE FUNCTION public.stock_bag_accounting_route_state(_sede uuid,_tasks uuid[]) RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT jsonb_build_object('active',EXISTS(SELECT 1 FROM public.stock_bag_accounting_config WHERE sede_id=_sede AND active),
 'bags',coalesce((SELECT jsonb_agg(jsonb_build_object('taskId',task_key,'state',state,'changedAt',changed_at)) FROM public.stock_bag_consumption WHERE sede_id=_sede AND task_key=ANY(_tasks)),'[]'::jsonb));
$$;

CREATE FUNCTION public.deliver_stock_bag_checked(_task uuid,_link uuid,_worker uuid,_cleaner uuid,_name text,_snapshot jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE task_row public.tasks; link_row public.laundry_share_links; bag public.stock_bag_consumption;
 sources jsonb; delivered_time timestamptz; preparation_status text;
BEGIN
 SELECT * INTO STRICT link_row FROM public.laundry_share_links WHERE id=_link AND is_active AND workflow_version='route_v2' AND (expires_at IS NULL OR expires_at>now());
 SELECT * INTO STRICT task_row FROM public.tasks WHERE id=_task;
 IF task_row.sede_id<>link_row.sede_id OR task_row.status IN ('cancelled','completed') OR NOT coalesce(_task=ANY(link_row.snapshot_task_ids),false)
  OR NOT EXISTS(SELECT 1 FROM jsonb_array_elements_text(coalesce(link_row.filters->'routeDates','[]')) d WHERE d.value=task_row.date::text) THEN RAISE EXCEPTION 'Tarea fuera de la ruta actual'; END IF;
 IF EXISTS(SELECT 1 FROM public.laundry_route_workers WHERE sede_id=task_row.sede_id AND is_active) AND NOT EXISTS(
  SELECT 1 FROM public.laundry_route_workers WHERE id=_worker AND cleaner_id=_cleaner AND sede_id=task_row.sede_id AND is_active) THEN RAISE EXCEPTION 'Identifícate con tu PIN antes de entregar'; END IF;
 SELECT status INTO preparation_status FROM public.laundry_bag_preparations WHERE task_id=_task FOR UPDATE;
 SELECT * INTO STRICT bag FROM public.stock_bag_consumption WHERE task_key=_task FOR UPDATE;
 PERFORM public.lock_stock_bag_sede(task_row.sede_id);
 IF NOT EXISTS(SELECT 1 FROM public.stock_bag_accounting_config WHERE sede_id=task_row.sede_id AND active) THEN RAISE EXCEPTION 'El modo de inventario cambió: recarga la ruta'; END IF;
 IF preparation_status IS DISTINCT FROM 'prepared' OR bag.state<>'prepared' THEN RAISE EXCEPTION 'Prepara la bolsa antes de entregarla'; END IF;
 IF _snapshot->>'propertyId' IS DISTINCT FROM task_row.propiedad_id::text OR _snapshot->>'date' IS DISTINCT FROM task_row.date::text
  OR (_snapshot->>'stockChangedAt')::timestamptz IS DISTINCT FROM bag.changed_at THEN RAISE EXCEPTION 'La bolsa cambió: recarga antes de entregar' USING ERRCODE='40001'; END IF;
 SELECT jsonb_agg(jsonb_build_object('productId',s.product_id,'sourceKey',s.source_key,'multiplier',s.multiplier,'kind',s.kind) ORDER BY s.product_id)
 INTO sources FROM public.stock_bag_accounting_sources s WHERE sede_id=task_row.sede_id;
 IF public.stock_bag_normalize(_snapshot,sources,false) IS DISTINCT FROM bag.lines THEN RAISE EXCEPTION 'El contenido cambió: confirma la preparación antes de entregar' USING ERRCODE='40001'; END IF;
 SELECT min(delivered_at) INTO delivered_time FROM public.laundry_delivery_tracking WHERE task_id=_task AND status='delivered' AND delivered_at>=bag.changed_at;
 IF delivered_time IS NULL THEN
  delivered_time:=clock_timestamp();
  IF _worker IS NOT NULL THEN INSERT INTO public.laundry_route_worker_events(share_link_id,task_id,route_worker_id,worker_name,action,details)
   VALUES(_link,_task,_worker,_name,'deliver',jsonb_build_object('stockChangedAt',bag.changed_at,'trackingOnly',true)); END IF;
 END IF;
 INSERT INTO public.laundry_delivery_tracking(share_link_id,task_id,status,delivered_at,delivered_by_name,delivered_by_worker_id)
 VALUES(_link,_task,'delivered',delivered_time,_name,_cleaner)
 ON CONFLICT(share_link_id,task_id) DO UPDATE SET status='delivered',delivered_at=EXCLUDED.delivered_at,delivered_by_name=EXCLUDED.delivered_by_name,delivered_by_worker_id=EXCLUDED.delivered_by_worker_id;
 RETURN jsonb_build_object('delivered',true,'stockMoved',false);
END $$;

CREATE FUNCTION public.resolve_stock_bag_checked(_task uuid,_expected jsonb,_action text,_reason text,_confirmed boolean,_operation uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE bag public.stock_bag_consumption; line record; level_row public.stock_levels; prior public.stock_bag_accounting_operations;
 request_hash text; answer jsonb; delivered boolean;
BEGIN
 SELECT * INTO bag FROM public.stock_bag_consumption WHERE task_key=_task;
 IF NOT FOUND THEN RAISE EXCEPTION 'Bolsa no encontrada'; END IF;
 PERFORM public.laundry_cycle_admin(bag.sede_id);
 IF _operation IS NULL OR NOT coalesce(_confirmed,false) OR _action IS NULL OR _action NOT IN ('unpack','return') OR _reason IS NULL OR length(trim(_reason))<3 THEN RAISE EXCEPTION 'Confirma la resolución física y su motivo'; END IF;
 request_hash:=md5(jsonb_build_array(_task,_expected,_action,_reason,_confirmed)::text);
 SELECT * INTO prior FROM public.stock_bag_accounting_operations WHERE operation_key=_operation;
 IF FOUND THEN IF prior.sede_id<>bag.sede_id OR prior.request_hash<>request_hash OR prior.kind<>'resolve' THEN RAISE EXCEPTION 'Operación ya usada con otros datos'; END IF; RETURN prior.result||jsonb_build_object('replayed',true); END IF;
 PERFORM 1 FROM public.laundry_bag_preparations WHERE task_id=_task FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Falta la preparación original; revisa físicamente esta bolsa'; END IF;
 SELECT * INTO STRICT bag FROM public.stock_bag_consumption WHERE task_key=_task FOR UPDATE;
 SELECT * INTO prior FROM public.stock_bag_accounting_operations WHERE operation_key=_operation;
 IF FOUND THEN IF prior.sede_id<>bag.sede_id OR prior.request_hash<>request_hash OR prior.kind<>'resolve' THEN RAISE EXCEPTION 'Operación ya usada con otros datos'; END IF; RETURN prior.result||jsonb_build_object('replayed',true); END IF;
 PERFORM public.lock_stock_bag_sede(bag.sede_id);
 IF bag.state<>'prepared' OR _expected IS DISTINCT FROM bag.lines THEN RAISE EXCEPTION 'La bolsa cambió: recarga antes de resolverla' USING ERRCODE='40001'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.stock_bag_accounting_config WHERE sede_id=bag.sede_id AND active) THEN RAISE EXCEPTION 'El modo provisional ya no está activo'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.tasks WHERE id=bag.task_key AND status IS DISTINCT FROM 'completed') THEN RAISE EXCEPTION 'La tarea falta o la limpieza terminó; revisa la bolsa antes de devolverla como limpia'; END IF;
 SELECT EXISTS(SELECT 1 FROM public.laundry_delivery_tracking d WHERE d.task_id=bag.task_key AND d.status='delivered' AND d.delivered_at>=bag.changed_at) INTO delivered;
 IF delivered AND _action<>'return' THEN RAISE EXCEPTION 'Confirma la devolución al almacén de la bolsa entregada'; END IF;
 UPDATE public.laundry_bag_preparations SET status='pending',undone_at=now(),undone_reason=trim(_reason) WHERE task_id=_task;
 PERFORM set_config('app.bag_stock_write','on',true);
 FOR line IN SELECT key::uuid product_id,value::text::numeric quantity FROM jsonb_each(bag.lines) WHERE value::text::numeric>0 ORDER BY key LOOP
  SELECT * INTO STRICT level_row FROM public.stock_levels WHERE warehouse_id=bag.central_id AND product_id=line.product_id FOR UPDATE;
  UPDATE public.stock_levels SET current_quantity=current_quantity+line.quantity WHERE id=level_row.id;
  INSERT INTO public.stock_movements(product_id,warehouse_id,movement_type,quantity,previous_quantity,new_quantity,reason,task_id,property_id,created_by)
   VALUES(line.product_id,bag.central_id,'entrada',line.quantity,level_row.current_quantity,level_row.current_quantity+line.quantity,
    'Resolución física de bolsa: '||trim(_reason),bag.task_key,bag.property_id,auth.uid());
 END LOOP;
 UPDATE public.stock_bag_consumption SET state='released',lines='{}',changed_at=now() WHERE task_key=_task;
 answer:=jsonb_build_object('resolved',true,'taskId',_task);
 INSERT INTO public.stock_bag_accounting_operations VALUES(_operation,bag.sede_id,'resolve',request_hash,answer,auth.uid(),now()); RETURN answer;
END $$;

CREATE FUNCTION public.close_stock_bag_accounting_checked(_sede uuid,_operation uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
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
  WHERE c.sede_id=_sede AND (l.quantity_basis IS DISTINCT FROM 'counted' OR l.current_quantity<0)) THEN RAISE EXCEPTION 'Cuenta cada producto antes de cerrar el arranque provisional'; END IF;
 UPDATE public.stock_bag_accounting_config SET active=false WHERE sede_id=_sede AND active;
 IF NOT FOUND THEN RAISE EXCEPTION 'No hay un arranque activo'; END IF;
 answer:=jsonb_build_object('closed',true);
 INSERT INTO public.stock_bag_accounting_operations VALUES(_operation,_sede,'close',md5(_sede::text),answer,auth.uid(),now()); RETURN answer;
END $$;

DO $$ DECLARE function_row record; BEGIN
 FOR function_row IN SELECT p.oid::regprocedure signature,p.proname FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
 WHERE n.nspname='public' AND p.proname IN ('lock_stock_bag_accounting','lock_stock_bag_sede','guard_stock_bag_basis','guard_stock_bag_settings','guard_bag_stock_full_cycle','stock_bag_normalize','preview_stock_bag_accounting_checked','activate_stock_bag_accounting_checked','apply_stock_bag_consumption','adjust_bag_stock_checked','read_stock_bag_accounting_checked','stock_bag_accounting_route_state','deliver_stock_bag_checked','resolve_stock_bag_checked','close_stock_bag_accounting_checked') LOOP
  EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC,anon,authenticated',function_row.signature);
  EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role',function_row.signature);
  IF function_row.proname IN ('preview_stock_bag_accounting_checked','activate_stock_bag_accounting_checked','adjust_bag_stock_checked','read_stock_bag_accounting_checked','resolve_stock_bag_checked','close_stock_bag_accounting_checked') THEN
   EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated',function_row.signature);
  END IF;
 END LOOP;
END $$;
COMMIT;
