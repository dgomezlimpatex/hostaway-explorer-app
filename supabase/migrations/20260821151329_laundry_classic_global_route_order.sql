-- Permite guardar un orden base comun para todas las rutas.
-- delivery_day = -1 significa "todas las rutas".
ALTER TABLE public.laundry_classic_route_order
  DROP CONSTRAINT IF EXISTS laundry_classic_route_order_delivery_day_check;

ALTER TABLE public.laundry_classic_route_order
  ADD CONSTRAINT laundry_classic_route_order_delivery_day_check
  CHECK (delivery_day = -1 OR (delivery_day >= 0 AND delivery_day <= 6));

COMMENT ON COLUMN public.laundry_classic_route_order.delivery_day IS
  '-1 es el orden base comun; 0-6 son excepciones por dia de reparto.';
