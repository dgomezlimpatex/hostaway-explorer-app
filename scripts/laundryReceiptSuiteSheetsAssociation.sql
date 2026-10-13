-- Specific operational step, NOT a migration. Requires Dani's authorization.
-- Only associate the existing suite-sheet product with the existing reception link.
-- Does not rotate tokens, revoke sessions, change old mappings, counts or stock.
BEGIN;
DO $$
DECLARE l public.laundry_receipt_links; p public.stock_products; warehouse_sede uuid;
BEGIN
  SELECT * INTO STRICT l FROM public.laundry_receipt_links
    WHERE id='410762cf-ec90-43a5-a53a-4c6217e31e50' FOR UPDATE;
  SELECT sede_id INTO STRICT warehouse_sede FROM public.stock_warehouses
    WHERE id=l.warehouse_id AND is_active;
  SELECT sp.* INTO STRICT p FROM public.stock_products sp
    JOIN public.stock_categories sc ON sc.id=sp.category_id
    WHERE sp.id='8a619a5e-25b6-47fb-b2f1-32ae1cbf1e9d'
      AND sp.sede_id=warehouse_sede AND sp.is_active AND sc.is_active AND sc.kind='laundry';
  IF NOT 'suite_sheets'=ANY(public.laundry_receipt_keys()) THEN
    RAISE EXCEPTION 'Apply the reviewed suite-sheet migration first';
  END IF;
  IF l.product_map ? 'suite_sheets' THEN
    RAISE EXCEPTION 'Suite association already exists: inspect, do not overwrite';
  END IF;
  IF (SELECT count(*) FROM jsonb_object_keys(l.product_map))<>9
    OR EXISTS(SELECT 1 FROM jsonb_each_text(l.product_map) WHERE value=p.id::text) THEN
    RAISE EXCEPTION 'Unexpected existing product map: inspect before continuing';
  END IF;
  UPDATE public.laundry_receipt_links SET product_map=product_map || jsonb_build_object('suite_sheets',p.id::text)
    WHERE id=l.id;
END $$;
COMMIT;
