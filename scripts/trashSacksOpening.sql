-- Authorized by Dani: existing properties, one sack per kitchen; 500 in A Coruña / Simón Bolívar.
-- Run only with an active reviewed-release reservation, after date guards are installed.
BEGIN;
SELECT pg_advisory_xact_lock(hashtext('limpatex-trash-sacks-100l-opening'));
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.stock_warehouses WHERE id='af1ff0bf-414a-4d64-8298-06b1a3b7ab82' AND sede_id='1e0759ec-5e63-4edd-9dad-e493c715bbba' AND name='Simón Bolívar' AND is_active) THEN
    RAISE EXCEPTION 'Opening warehouse mismatch';
  END IF;
  IF EXISTS (SELECT 1 FROM public.properties WHERE numero_cocinas IS NULL OR numero_cocinas < 0) THEN
    RAISE EXCEPTION 'Review missing/invalid kitchens before initializing sacks';
  END IF;
END $$;
INSERT INTO public.stock_products(sede_id,category_id,name,sku,unit_of_measure,is_consumable,is_active,sort_order,description)
SELECT s.id,'a76bb11c-aecf-47fc-bb3e-e57f159d708c','Sacos de basura 100 L','SACOS-BASURA-100L','unidades',true,true,145,
  'Uso desde 09/10/2026. Coste inicial 0,10 EUR/unidad. Cantidad editable por propiedad; adicional a las bolsas pequeñas.'
FROM public.sedes s WHERE EXISTS(SELECT 1 FROM public.properties p WHERE p.sede_id=s.id)
ON CONFLICT(sede_id,sku) DO NOTHING;
INSERT INTO public.stock_property_consumption_rules(property_id,product_id,warehouse_id,quantity_per_cleaning,is_active,notes)
SELECT p.id,sp.id,CASE WHEN p.sede_id='1e0759ec-5e63-4edd-9dad-e493c715bbba' THEN 'af1ff0bf-414a-4d64-8298-06b1a3b7ab82'::uuid ELSE NULL END,
  p.numero_cocinas,true,'Inicializado una vez: un saco por cocina. Uso desde 09/10/2026; editable.'
FROM public.properties p JOIN public.stock_products sp ON sp.sede_id=p.sede_id AND sp.sku='SACOS-BASURA-100L'
ON CONFLICT(property_id,product_id) DO NOTHING;
DO $$
DECLARE product_key uuid; current_stock numeric;
BEGIN
  SELECT id INTO STRICT product_key FROM public.stock_products WHERE sede_id='1e0759ec-5e63-4edd-9dad-e493c715bbba' AND sku='SACOS-BASURA-100L';
  IF EXISTS(SELECT 1 FROM public.stock_movements WHERE product_id=product_key AND reason='Apertura autorizada sacos 100 L 2026-10-09: 500 unidades Simón Bolívar') THEN RETURN; END IF;
  INSERT INTO public.stock_levels(product_id,warehouse_id,current_quantity,cost_per_unit)
  VALUES(product_key,'af1ff0bf-414a-4d64-8298-06b1a3b7ab82',0,0.10) ON CONFLICT(product_id,warehouse_id) DO NOTHING;
  SELECT current_quantity INTO STRICT current_stock FROM public.stock_levels WHERE product_id=product_key AND warehouse_id='af1ff0bf-414a-4d64-8298-06b1a3b7ab82' FOR UPDATE;
  IF current_stock <> 0 THEN RAISE EXCEPTION 'Unexpected existing sack stock; reconcile before opening'; END IF;
  UPDATE public.stock_levels SET current_quantity=500,cost_per_unit=0.10 WHERE product_id=product_key AND warehouse_id='af1ff0bf-414a-4d64-8298-06b1a3b7ab82';
  INSERT INTO public.stock_movements(product_id,warehouse_id,movement_type,quantity,previous_quantity,new_quantity,reason,unit_cost_at_movement)
  VALUES(product_key,'af1ff0bf-414a-4d64-8298-06b1a3b7ab82','entrada',500,0,500,'Apertura autorizada sacos 100 L 2026-10-09: 500 unidades Simón Bolívar',0.10);
END $$;
COMMIT;
