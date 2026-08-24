-- Supervisión 2.0: vincular la ruta interna automática a un edificio.
ALTER TABLE public.supervision_routes
  ADD COLUMN IF NOT EXISTS property_group_id UUID REFERENCES public.property_groups(id) ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS supervision_routes_building_date_key
  ON public.supervision_routes(property_group_id, route_date)
  WHERE property_group_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_supervision_routes_building_date
  ON public.supervision_routes(property_group_id, route_date);
