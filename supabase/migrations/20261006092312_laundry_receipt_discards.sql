-- Additive only. Existing receipts start at zero discards; historical snapshots stay unchanged.
-- No grants or RLS changes. Existing service-role RPC authorization is preserved.
BEGIN;
ALTER TABLE public.laundry_receipts ADD COLUMN discarded_counts jsonb NOT NULL DEFAULT '{"double_sheets":0,"single_sheets":0,"pillowcases":0,"bath_towels":0,"hand_towels":0,"bath_mats":0,"duvets":0,"mattress_protectors":0,"pillows":0}'::jsonb;
ALTER TABLE public.laundry_receipt_operations ADD COLUMN previous_discarded_counts jsonb;

CREATE OR REPLACE FUNCTION public.read_laundry_receipt(_token text, _session_hash text, _date date DEFAULT NULL) RETURNS jsonb
LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
DECLARE l public.laundry_receipt_links; r public.laundry_receipts; worker uuid;
BEGIN
  worker:=public.laundry_receipt_identity(_token,_session_hash);
  SELECT * INTO STRICT l FROM public.laundry_receipt_links WHERE token=_token;
  SELECT * INTO r FROM public.laundry_receipts WHERE link_id=l.id AND receipt_date=coalesce(_date,(now() AT TIME ZONE 'Europe/Madrid')::date);
  RETURN jsonb_build_object('date',coalesce(_date,(now() AT TIME ZONE 'Europe/Madrid')::date),'workerName',(SELECT c.name FROM public.laundry_route_workers rw JOIN public.cleaners c ON c.id=rw.cleaner_id WHERE rw.id=worker),'warehouseName',(SELECT name FROM public.stock_warehouses WHERE id=l.warehouse_id),'receipt',CASE WHEN r.id IS NULL THEN NULL ELSE to_jsonb(r)-'product_map' END,
    'versions',coalesce((SELECT jsonb_agg(to_jsonb(v)||jsonb_build_object('email',to_jsonb(e)) ORDER BY v.version DESC) FROM public.laundry_receipt_versions v JOIN public.laundry_receipt_emails e ON e.version_id=v.id WHERE v.receipt_id=r.id),'[]'::jsonb),
    'operations',coalesce((SELECT jsonb_agg(jsonb_build_object('id',o.id,'payload',o.payload,'worker_name',c.name,'created_at',o.created_at,'revision',o.result->'revision') ORDER BY o.created_at DESC) FROM public.laundry_receipt_operations o JOIN public.laundry_route_workers rw ON rw.id=o.worker_id JOIN public.cleaners c ON c.id=rw.cleaner_id WHERE o.receipt_id=r.id),'[]'::jsonb),
    'pendingDates',coalesce((SELECT jsonb_agg(q.receipt_date ORDER BY q.receipt_date) FROM public.laundry_receipts q LEFT JOIN public.laundry_receipt_versions v ON v.receipt_id=q.id AND v.version=q.latest_version WHERE q.link_id=l.id AND q.receipt_date<(now() AT TIME ZONE 'Europe/Madrid')::date AND (q.latest_version=0 OR q.counts<>v.snapshot->'counts' OR q.notes<>v.snapshot->>'notes' OR q.discarded_counts<>coalesce(v.snapshot->'discarded_counts','{"double_sheets":0,"single_sheets":0,"pillowcases":0,"bath_towels":0,"hand_towels":0,"bath_mats":0,"duvets":0,"mattress_protectors":0,"pillows":0}'::jsonb))),'[]'::jsonb));
END $$;

CREATE OR REPLACE FUNCTION public.mutate_laundry_receipt(_token text, _session_hash text, _date date, _op_id uuid, _payload jsonb) RETURNS jsonb
LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
DECLARE l public.laundry_receipt_links; r public.laundry_receipts; worker uuid; prior public.laundry_receipt_operations; before_counts jsonb; before_discards jsonb; k text; qty bigint; action text; expected integer; undo public.laundry_receipt_operations; v public.laundry_receipt_versions; old_counts jsonb; p uuid; delta numeric; balance numeric; mid uuid; mids uuid[]:='{}'; result jsonb; version_id uuid;
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
  before_counts:=r.counts; before_discards:=r.discarded_counts;
  expected:=(_payload->>'expectedRevision')::integer;
  IF action IN ('set','set_discard','notes','undo','confirm') AND (expected IS NULL OR expected<>r.revision) THEN RAISE EXCEPTION 'El recuento ha cambiado. Revisa el total actualizado.' USING ERRCODE='40001'; END IF;
  IF action IN ('add','set','add_discard','set_discard') THEN
    k:=_payload->>'material';
    IF NOT k=ANY(public.laundry_receipt_keys()) OR k IS NULL OR coalesce(_payload->>'quantity','') !~ '^[0-9]{1,9}$' THEN RAISE EXCEPTION 'Cantidad o material inválido'; END IF;
    qty:=(_payload->>'quantity')::bigint;
    IF action='add' THEN qty:=qty+(r.counts->>k)::bigint; ELSIF action='add_discard' THEN qty:=qty+(r.discarded_counts->>k)::bigint; END IF;
    IF qty>999999999 THEN RAISE EXCEPTION 'Cantidad demasiado grande'; END IF;
    IF action IN ('add_discard','set_discard') THEN r.discarded_counts:=jsonb_set(r.discarded_counts,ARRAY[k],to_jsonb(qty)); ELSE r.counts:=jsonb_set(r.counts,ARRAY[k],to_jsonb(qty)); END IF;
  ELSIF action='notes' THEN
    IF length(coalesce(_payload->>'notes',''))>2000 THEN RAISE EXCEPTION 'Observación demasiado larga'; END IF;
    r.notes:=coalesce(_payload->>'notes','');
  ELSIF action='undo' THEN
    SELECT * INTO STRICT undo FROM public.laundry_receipt_operations WHERE id=(_payload->>'targetId')::uuid AND receipt_id=r.id AND payload->>'action' IN ('add','set','add_discard','set_discard');
    IF (undo.result->>'revision')::integer<>r.revision THEN RAISE EXCEPTION 'Solo se puede deshacer la última suma o corrección. Revisa el total.'; END IF;
    IF undo.payload->>'action' IN ('add_discard','set_discard') THEN r.discarded_counts:=undo.previous_discarded_counts; ELSE r.counts:=undo.previous_counts; END IF;
  ELSIF action='confirm' THEN
    SELECT * INTO v FROM public.laundry_receipt_versions WHERE receipt_id=r.id AND version=r.latest_version;
    old_counts:=coalesce(v.snapshot->'counts',before_counts);
    IF r.latest_version=0 THEN old_counts:=(SELECT jsonb_object_agg(key,0) FROM jsonb_each(r.counts)); END IF;
    IF r.latest_version>0 AND r.counts=old_counts AND r.notes=v.snapshot->>'notes' AND r.discarded_counts=coalesce(v.snapshot->'discarded_counts','{"double_sheets":0,"single_sheets":0,"pillowcases":0,"bath_towels":0,"hand_towels":0,"bath_mats":0,"duvets":0,"mattress_protectors":0,"pillows":0}'::jsonb) THEN
      result:=jsonb_build_object('versionId',v.id,'revision',r.revision,'unchanged',true);
    ELSE
      IF NOT EXISTS(SELECT 1 FROM jsonb_each_text(r.counts) WHERE value::bigint>0) AND NOT EXISTS(SELECT 1 FROM jsonb_each_text(r.discarded_counts) WHERE value::bigint>0) AND r.latest_version=0 THEN RAISE EXCEPTION 'Añade ropa aceptada o descartes antes de confirmar'; END IF;
      -- Lock levels in product-id order, including no-delta products: deterministic lock order.
      FOR k,p IN SELECT key,value::uuid FROM jsonb_each_text(r.product_map) ORDER BY value LOOP
        IF NOT EXISTS(SELECT 1 FROM public.stock_products sp JOIN public.stock_categories sc ON sc.id=sp.category_id WHERE sp.id=p AND sp.is_active AND sc.kind='laundry') THEN RAISE EXCEPTION 'Producto desactivado. Contacta con administración.'; END IF;
        delta:=(r.counts->>k)::numeric-(old_counts->>k)::numeric;
        IF delta=0 THEN CONTINUE; END IF;
        INSERT INTO public.stock_levels(product_id,warehouse_id,current_quantity,minimum_quantity,target_quantity) VALUES(p,l.warehouse_id,0,0,0) ON CONFLICT(product_id,warehouse_id) DO NOTHING;
        SELECT current_quantity INTO STRICT balance FROM public.stock_levels WHERE product_id=p AND warehouse_id=l.warehouse_id FOR UPDATE;
        IF balance+delta<0 THEN RAISE EXCEPTION 'La corrección dejaría stock negativo. Administración debe revisar los movimientos posteriores.'; END IF;
        IF delta<>0 THEN
          UPDATE public.stock_levels SET current_quantity=balance+delta,last_updated=now(),updated_by=NULL WHERE product_id=p AND warehouse_id=l.warehouse_id;
          INSERT INTO public.stock_movements(product_id,warehouse_id,movement_type,quantity,previous_quantity,new_quantity,reason)
          VALUES(p,l.warehouse_id,CASE WHEN delta>0 THEN 'entrada'::public.stock_movement_type ELSE 'salida'::public.stock_movement_type END,abs(delta),balance,balance+delta,format('Recepción %s v%s · %s · empleado %s',r.receipt_date,r.latest_version+1,r.id,worker)) RETURNING id INTO mid;
          mids:=array_append(mids,mid);
        END IF;
      END LOOP;
      INSERT INTO public.laundry_receipt_versions(receipt_id,version,revision,worker_id,movement_ids,snapshot)
      VALUES(r.id,r.latest_version+1,r.revision,worker,mids,jsonb_build_object('receipt_date',r.receipt_date,'warehouse_name',(SELECT name FROM public.stock_warehouses WHERE id=l.warehouse_id),'version',r.latest_version+1,'worker_name',(SELECT c.name FROM public.laundry_route_workers rw JOIN public.cleaners c ON c.id=rw.cleaner_id WHERE rw.id=worker),'confirmed_at',now(),'counts',r.counts,'discarded_counts',r.discarded_counts,'notes',r.notes)) RETURNING id INTO version_id;
      INSERT INTO public.laundry_receipt_emails(version_id) VALUES(version_id);
      r.latest_version:=r.latest_version+1;
      result:=jsonb_build_object('versionId',version_id,'revision',r.revision,'unchanged',false);
    END IF;
  ELSIF action<>'start' OR action IS NULL THEN RAISE EXCEPTION 'Acción inválida'; END IF;
  IF action IN ('add','set','add_discard','set_discard','notes','undo') THEN r.revision:=r.revision+1; END IF;
  UPDATE public.laundry_receipts SET counts=r.counts,discarded_counts=r.discarded_counts,notes=r.notes,revision=r.revision,latest_version=r.latest_version,updated_at=now() WHERE id=r.id;
  result:=coalesce(result,jsonb_build_object('revision',r.revision));
  INSERT INTO public.laundry_receipt_operations(id,receipt_id,worker_id,payload,previous_counts,previous_discarded_counts,result) VALUES(_op_id,r.id,worker,_payload,before_counts,before_discards,result);
  RETURN result;
END $$;


COMMIT;
