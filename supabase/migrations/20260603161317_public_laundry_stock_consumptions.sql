CREATE OR REPLACE FUNCTION public.get_public_laundry_stock_consumptions(token_param TEXT)
RETURNS TABLE (
  task_id UUID,
  property_id UUID,
  product_id UUID,
  product_name TEXT,
  unit_of_measure TEXT,
  category_name TEXT,
  category_kind public.stock_item_kind,
  quantity NUMERIC
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
  WITH valid_link AS (
    SELECT
      l.id,
      l.snapshot_task_ids
    FROM public.laundry_share_links l
    WHERE l.token = token_param
      AND l.is_active = true
      AND (l.expires_at IS NULL OR l.expires_at > now())
    LIMIT 1
  )
  SELECT
    t.id AS task_id,
    p.id AS property_id,
    sp.id AS product_id,
    sp.name::TEXT AS product_name,
    sp.unit_of_measure::TEXT AS unit_of_measure,
    sc.name::TEXT AS category_name,
    sc.kind AS category_kind,
    r.quantity_per_cleaning AS quantity
  FROM valid_link l
  JOIN public.tasks t ON t.id = ANY(l.snapshot_task_ids)
  JOIN public.properties p ON p.id = t.propiedad_id
  JOIN public.stock_property_consumption_rules r ON r.property_id = p.id
  JOIN public.stock_products sp ON sp.id = r.product_id
  LEFT JOIN public.stock_categories sc ON sc.id = sp.category_id
  WHERE r.is_active = true
    AND r.quantity_per_cleaning > 0
    AND sp.is_active = true
    AND sp.is_consumable = true
    AND sp.sede_id = p.sede_id
    AND COALESCE(sc.kind, 'other'::public.stock_item_kind) <> 'laundry'::public.stock_item_kind
  ORDER BY
    t.date,
    p.codigo,
    CASE
      WHEN lower(coalesce(sc.name, '')) LIKE '%consumible%' THEN 10
      WHEN sc.kind = 'amenity'::public.stock_item_kind THEN 20
      ELSE 30
    END,
    sp.sort_order,
    sp.name;
$function$;

GRANT EXECUTE ON FUNCTION public.get_public_laundry_stock_consumptions(TEXT) TO anon, authenticated;
