-- Step 2 (retry): Create logistics schema objects and RLS without IF NOT EXISTS in policies

-- Enums for logistics statuses (idempotent)
DO $$ BEGIN
  CREATE TYPE public.logistics_picklist_status AS ENUM ('draft','preparing','packed','committed','cancelled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.logistics_delivery_status AS ENUM ('planned','in_transit','completed','cancelled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.logistics_stop_status AS ENUM ('pending','delivered','failed','skipped');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Tables
CREATE TABLE IF NOT EXISTS public.logistics_picklists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  status public.logistics_picklist_status NOT NULL DEFAULT 'draft',
  scheduled_date date,
  created_by uuid,
  committed_by uuid,
  committed_at timestamptz,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.logistics_picklist_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  picklist_id uuid NOT NULL REFERENCES public.logistics_picklists(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.inventory_products(id),
  quantity integer NOT NULL DEFAULT 0,
  property_id uuid REFERENCES public.properties(id),
  reserved boolean NOT NULL DEFAULT false,
  reserved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.logistics_deliveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  picklist_id uuid REFERENCES public.logistics_picklists(id) ON DELETE SET NULL,
  status public.logistics_delivery_status NOT NULL DEFAULT 'planned',
  started_at timestamptz,
  completed_at timestamptz,
  created_by uuid,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.logistics_delivery_stops (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  delivery_id uuid NOT NULL REFERENCES public.logistics_deliveries(id) ON DELETE CASCADE,
  property_id uuid NOT NULL REFERENCES public.properties(id),
  planned_time timestamptz,
  actual_time timestamptz,
  status public.logistics_stop_status NOT NULL DEFAULT 'pending',
  signature_url text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.logistics_delivery_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  stop_id uuid NOT NULL REFERENCES public.logistics_delivery_stops(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.inventory_products(id),
  quantity integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_picklist_items_picklist ON public.logistics_picklist_items(picklist_id);
CREATE INDEX IF NOT EXISTS idx_picklist_items_product ON public.logistics_picklist_items(product_id);
CREATE INDEX IF NOT EXISTS idx_picklist_items_property ON public.logistics_picklist_items(property_id);
CREATE INDEX IF NOT EXISTS idx_deliveries_picklist ON public.logistics_deliveries(picklist_id);
CREATE INDEX IF NOT EXISTS idx_stops_delivery ON public.logistics_delivery_stops(delivery_id);
CREATE INDEX IF NOT EXISTS idx_stops_property ON public.logistics_delivery_stops(property_id);
CREATE INDEX IF NOT EXISTS idx_delivery_items_stop ON public.logistics_delivery_items(stop_id);
CREATE INDEX IF NOT EXISTS idx_delivery_items_product ON public.logistics_delivery_items(product_id);

-- Enable RLS
ALTER TABLE public.logistics_picklists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.logistics_picklist_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.logistics_deliveries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.logistics_delivery_stops ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.logistics_delivery_items ENABLE ROW LEVEL SECURITY;

-- Policies: Admin/Manager full access
DROP POLICY IF EXISTS "Admin and managers can manage picklists" ON public.logistics_picklists;
CREATE POLICY "Admin and managers can manage picklists" ON public.logistics_picklists
  FOR ALL USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager'))
  WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager'));

DROP POLICY IF EXISTS "Admin and managers can manage picklist items" ON public.logistics_picklist_items;
CREATE POLICY "Admin and managers can manage picklist items" ON public.logistics_picklist_items
  FOR ALL USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager'))
  WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager'));

DROP POLICY IF EXISTS "Admin and managers can manage deliveries" ON public.logistics_deliveries;
CREATE POLICY "Admin and managers can manage deliveries" ON public.logistics_deliveries
  FOR ALL USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager'))
  WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager'));

DROP POLICY IF EXISTS "Admin and managers can manage delivery stops" ON public.logistics_delivery_stops;
CREATE POLICY "Admin and managers can manage delivery stops" ON public.logistics_delivery_stops
  FOR ALL USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager'))
  WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager'));

DROP POLICY IF EXISTS "Admin and managers can manage delivery items" ON public.logistics_delivery_items;
CREATE POLICY "Admin and managers can manage delivery items" ON public.logistics_delivery_items
  FOR ALL USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager'))
  WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager'));

-- Policies: Logistics role manage operational tables
DROP POLICY IF EXISTS "Logistics can manage picklists" ON public.logistics_picklists;
CREATE POLICY "Logistics can manage picklists" ON public.logistics_picklists
  FOR ALL USING (has_role(auth.uid(), 'logistics'))
  WITH CHECK (has_role(auth.uid(), 'logistics'));

DROP POLICY IF EXISTS "Logistics can manage picklist items" ON public.logistics_picklist_items;
CREATE POLICY "Logistics can manage picklist items" ON public.logistics_picklist_items
  FOR ALL USING (has_role(auth.uid(), 'logistics'))
  WITH CHECK (has_role(auth.uid(), 'logistics'));

DROP POLICY IF EXISTS "Logistics can manage deliveries" ON public.logistics_deliveries;
CREATE POLICY "Logistics can manage deliveries" ON public.logistics_deliveries
  FOR ALL USING (has_role(auth.uid(), 'logistics'))
  WITH CHECK (has_role(auth.uid(), 'logistics'));

DROP POLICY IF EXISTS "Logistics can manage delivery stops" ON public.logistics_delivery_stops;
CREATE POLICY "Logistics can manage delivery stops" ON public.logistics_delivery_stops
  FOR ALL USING (has_role(auth.uid(), 'logistics'))
  WITH CHECK (has_role(auth.uid(), 'logistics'));

DROP POLICY IF EXISTS "Logistics can manage delivery items" ON public.logistics_delivery_items;
CREATE POLICY "Logistics can manage delivery items" ON public.logistics_delivery_items
  FOR ALL USING (has_role(auth.uid(), 'logistics'))
  WITH CHECK (has_role(auth.uid(), 'logistics'));

-- Policies: Supervisors read-only
DROP POLICY IF EXISTS "Supervisors can view picklists" ON public.logistics_picklists;
CREATE POLICY "Supervisors can view picklists" ON public.logistics_picklists
  FOR SELECT USING (has_role(auth.uid(), 'supervisor'));

DROP POLICY IF EXISTS "Supervisors can view picklist items" ON public.logistics_picklist_items;
CREATE POLICY "Supervisors can view picklist items" ON public.logistics_picklist_items
  FOR SELECT USING (has_role(auth.uid(), 'supervisor'));

DROP POLICY IF EXISTS "Supervisors can view deliveries" ON public.logistics_deliveries;
CREATE POLICY "Supervisors can view deliveries" ON public.logistics_deliveries
  FOR SELECT USING (has_role(auth.uid(), 'supervisor'));

DROP POLICY IF EXISTS "Supervisors can view delivery stops" ON public.logistics_delivery_stops;
CREATE POLICY "Supervisors can view delivery stops" ON public.logistics_delivery_stops
  FOR SELECT USING (has_role(auth.uid(), 'supervisor'));

DROP POLICY IF EXISTS "Supervisors can view delivery items" ON public.logistics_delivery_items;
CREATE POLICY "Supervisors can view delivery items" ON public.logistics_delivery_items
  FOR SELECT USING (has_role(auth.uid(), 'supervisor'));

-- Triggers to maintain updated_at
DROP TRIGGER IF EXISTS set_updated_at_logistics_picklists ON public.logistics_picklists;
CREATE TRIGGER set_updated_at_logistics_picklists
  BEFORE UPDATE ON public.logistics_picklists
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS set_updated_at_logistics_picklist_items ON public.logistics_picklist_items;
CREATE TRIGGER set_updated_at_logistics_picklist_items
  BEFORE UPDATE ON public.logistics_picklist_items
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS set_updated_at_logistics_deliveries ON public.logistics_deliveries;
CREATE TRIGGER set_updated_at_logistics_deliveries
  BEFORE UPDATE ON public.logistics_deliveries
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS set_updated_at_logistics_delivery_stops ON public.logistics_delivery_stops;
CREATE TRIGGER set_updated_at_logistics_delivery_stops
  BEFORE UPDATE ON public.logistics_delivery_stops
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS set_updated_at_logistics_delivery_items ON public.logistics_delivery_items;
CREATE TRIGGER set_updated_at_logistics_delivery_items
  BEFORE UPDATE ON public.logistics_delivery_items
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();