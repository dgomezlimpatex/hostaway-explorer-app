-- READ ONLY. No tokens, PINs, addresses, counts by property or operational writes.
SELECT version() AS postgres_version,
 to_regprocedure('public.apply_laundry_receipt_operation(uuid,uuid,uuid,text,date,uuid,jsonb)') IS NOT NULL AS receipt_v4,
 to_regprocedure('public.resolve_laundry_bag_lines(uuid)') IS NOT NULL AS canonical_lines,
 to_regprocedure('public.upsert_laundry_route_preparation_checked(uuid,uuid,text,text,uuid,uuid,text,jsonb)') IS NOT NULL AS checked_preparation,
 to_regclass('public.laundry_cycle_config') IS NOT NULL AS cycle_installed;

SELECT proname,pg_get_function_identity_arguments(p.oid) AS arguments,md5(pg_get_functiondef(p.oid)) AS definition_fingerprint
FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
WHERE n.nspname='public' AND proname IN ('apply_laundry_receipt_operation','resolve_laundry_bag_lines','upsert_laundry_route_preparation_checked','get_user_stock_sedes') ORDER BY proname;

SELECT sede_id,laundry_route_inventory_enabled,auto_consumption_enabled FROM public.stock_sede_settings ORDER BY sede_id;
SELECT workflow_version,count(*) AS active_links FROM public.laundry_share_links WHERE is_active AND (expires_at IS NULL OR expires_at>now()) GROUP BY workflow_version;
SELECT count(*) AS unconfirmed_receipts FROM public.laundry_receipts WHERE latest_version=0;
SELECT count(*) AS receipt_links_with_active_staff FROM public.laundry_receipt_links l WHERE l.is_active AND EXISTS(SELECT 1 FROM public.laundry_route_workers w WHERE w.id=ANY(l.worker_ids) AND w.is_active);
