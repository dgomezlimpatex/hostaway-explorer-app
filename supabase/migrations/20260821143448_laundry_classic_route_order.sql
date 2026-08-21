-- Orden configurable de propiedades para los enlaces clasicos de lavanderia.
-- No se utiliza en route_v2, que mantiene su flujo secuencial independiente.
CREATE TABLE IF NOT EXISTS public.laundry_classic_route_order (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  sede_id UUID NOT NULL REFERENCES public.sedes(id) ON DELETE CASCADE,
  delivery_day INTEGER NOT NULL CHECK (delivery_day >= 0 AND delivery_day <= 6),
  property_id UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  position INTEGER NOT NULL CHECK (position >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (sede_id, delivery_day, property_id)
);

CREATE INDEX IF NOT EXISTS idx_laundry_classic_route_order_lookup
  ON public.laundry_classic_route_order(sede_id, delivery_day, position);

ALTER TABLE public.laundry_classic_route_order ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins and managers can view classic laundry route order"
  ON public.laundry_classic_route_order;
CREATE POLICY "Admins and managers can view classic laundry route order"
  ON public.laundry_classic_route_order
  FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR (
      public.has_role(auth.uid(), 'manager'::public.app_role)
      AND public.user_has_sede_access(auth.uid(), sede_id)
    )
  );

DROP POLICY IF EXISTS "Admins and managers can manage classic laundry route order"
  ON public.laundry_classic_route_order;
CREATE POLICY "Admins and managers can manage classic laundry route order"
  ON public.laundry_classic_route_order
  FOR ALL
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR (
      public.has_role(auth.uid(), 'manager'::public.app_role)
      AND public.user_has_sede_access(auth.uid(), sede_id)
    )
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR (
      public.has_role(auth.uid(), 'manager'::public.app_role)
      AND public.user_has_sede_access(auth.uid(), sede_id)
    )
  );

DROP TRIGGER IF EXISTS update_laundry_classic_route_order_updated_at
  ON public.laundry_classic_route_order;
CREATE TRIGGER update_laundry_classic_route_order_updated_at
  BEFORE UPDATE ON public.laundry_classic_route_order
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

GRANT SELECT, INSERT, UPDATE, DELETE
  ON public.laundry_classic_route_order TO authenticated;

ALTER TABLE public.laundry_share_links
  ADD COLUMN IF NOT EXISTS route_order_applied BOOLEAN NOT NULL DEFAULT false;

COMMENT ON TABLE public.laundry_classic_route_order IS
  'Orden por sede y dia de reparto para los enlaces clasicos /lavanderia.';
COMMENT ON COLUMN public.laundry_share_links.route_order_applied IS
  'Indica que snapshot_task_ids conserva el orden operativo de la ruta clasica.';
