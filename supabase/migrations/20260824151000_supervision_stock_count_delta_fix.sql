-- Corrección Ola 3: el movimiento de un recuento debe comparar contra la cantidad física anterior.
CREATE OR REPLACE FUNCTION public.complete_supervision_stock_check(
  _check_id UUID,
  _notes TEXT DEFAULT NULL
)
RETURNS public.supervision_stock_checks
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_check public.supervision_stock_checks;
  line RECORD;
  result_check public.supervision_stock_checks;
  target_delta NUMERIC(12,2);
  physical_delta NUMERIC(12,2);
BEGIN
  SELECT * INTO current_check FROM public.supervision_stock_checks WHERE id = _check_id FOR UPDATE;
  IF current_check.id IS NULL THEN RAISE EXCEPTION 'stock check not found'; END IF;
  IF NOT public.supervision_stock_warehouse_can_access(current_check.warehouse_id) THEN RAISE EXCEPTION 'stock warehouse access denied'; END IF;
  IF current_check.status = 'completed' THEN RETURN current_check; END IF;

  FOR line IN SELECT c.*, l.current_quantity AS physical_quantity, l.warehouse_id, l.product_id AS level_product_id
    FROM public.supervision_stock_check_lines c
    JOIN public.stock_levels l ON l.id = c.stock_level_id
    WHERE c.check_id = _check_id
    FOR UPDATE OF c, l LOOP
    IF line.observed_quantity IS NULL THEN RAISE EXCEPTION 'all stock lines require an observed quantity'; END IF;
    target_delta := line.observed_quantity - line.expected_quantity;
    physical_delta := line.observed_quantity - line.physical_quantity;

    UPDATE public.supervision_stock_check_lines
    SET difference = target_delta, updated_at = now()
    WHERE id = line.id;

    IF physical_delta <> 0 THEN
      UPDATE public.stock_levels
      SET current_quantity = line.observed_quantity, updated_by = auth.uid()
      WHERE id = line.stock_level_id;
      INSERT INTO public.stock_movements (
        product_id, warehouse_id, movement_type, quantity, previous_quantity, new_quantity, reason, created_by
      ) VALUES (
        line.level_product_id, line.warehouse_id, 'ajuste'::public.stock_movement_type,
        abs(physical_delta), line.physical_quantity, line.observed_quantity,
        'Recuento de supervisión ' || current_check.id::text, auth.uid()
      );
    END IF;
  END LOOP;

  UPDATE public.supervision_stock_checks
  SET status = 'completed', notes = COALESCE(_notes, notes), completed_at = now(), updated_at = now()
  WHERE id = _check_id
  RETURNING * INTO result_check;
  RETURN result_check;
END;
$$;
