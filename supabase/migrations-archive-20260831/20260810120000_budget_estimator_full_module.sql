-- Presupuestador turístico completo: persistencia, tarifas versionadas y activación operativa.
-- Migración aditiva. No elimina ni renombra objetos existentes.

CREATE TYPE public.tourist_budget_status AS ENUM (
  'draft',
  'review',
  'sent',
  'accepted',
  'rejected',
  'expired',
  'archived'
);

CREATE TYPE public.tourist_budget_logistics_mode AS ENUM (
  'provisional-hourly',
  'activity-based'
);

CREATE TYPE public.tourist_budget_activation_status AS ENUM (
  'proposed',
  'applied',
  'failed'
);

CREATE SEQUENCE public.tourist_budget_quote_seq START WITH 1 INCREMENT BY 1;

CREATE TABLE public.budget_rate_profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  sede_id UUID NOT NULL REFERENCES public.sedes(id) ON DELETE CASCADE,
  client_id UUID REFERENCES public.clients(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.budget_rate_profile_versions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  profile_id UUID NOT NULL REFERENCES public.budget_rate_profiles(id) ON DELETE CASCADE,
  version_number INTEGER NOT NULL CHECK (version_number > 0),
  effective_from DATE NOT NULL DEFAULT CURRENT_DATE,
  effective_until DATE,
  labor_cost_per_hour NUMERIC(12,2) NOT NULL CHECK (labor_cost_per_hour >= 0),
  route_allocation_per_hour NUMERIC(12,2) NOT NULL CHECK (route_allocation_per_hour >= 0),
  cleaning_sale_price_per_hour NUMERIC(12,2) NOT NULL CHECK (cleaning_sale_price_per_hour >= 0),
  logistics_mode public.tourist_budget_logistics_mode NOT NULL DEFAULT 'provisional-hourly',
  target_margin_percentage NUMERIC(6,2) CHECK (target_margin_percentage >= 0 AND target_margin_percentage <= 100),
  minimum_margin_percentage NUMERIC(6,2) CHECK (minimum_margin_percentage >= 0 AND minimum_margin_percentage <= 100),
  time_template JSONB NOT NULL DEFAULT '{}'::jsonb,
  logistics_config JSONB NOT NULL DEFAULT '{}'::jsonb,
  default_lines JSONB NOT NULL DEFAULT '{}'::jsonb,
  commercial_terms JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (profile_id, version_number),
  CHECK (effective_until IS NULL OR effective_until >= effective_from)
);

CREATE TABLE public.tourist_budgets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  sede_id UUID NOT NULL REFERENCES public.sedes(id) ON DELETE RESTRICT,
  client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
  quote_number TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  prospect_name TEXT,
  status public.tourist_budget_status NOT NULL DEFAULT 'draft',
  validity_date DATE,
  currency TEXT NOT NULL DEFAULT 'EUR' CHECK (currency = 'EUR'),
  current_version_number INTEGER NOT NULL DEFAULT 1 CHECK (current_version_number > 0),
  monthly_rotations INTEGER NOT NULL DEFAULT 1 CHECK (monthly_rotations > 0),
  total_cost NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (total_cost >= 0),
  total_revenue NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (total_revenue >= 0),
  contribution NUMERIC(12,2) NOT NULL DEFAULT 0,
  margin_percentage NUMERIC(7,2) NOT NULL DEFAULT 0,
  monthly_cost NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (monthly_cost >= 0),
  monthly_revenue NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (monthly_revenue >= 0),
  monthly_contribution NUMERIC(12,2) NOT NULL DEFAULT 0,
  commercial_notes TEXT,
  internal_notes TEXT,
  terms TEXT,
  created_by UUID NOT NULL REFERENCES auth.users(id),
  accepted_by UUID REFERENCES auth.users(id),
  accepted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.tourist_budget_versions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  budget_id UUID NOT NULL REFERENCES public.tourist_budgets(id) ON DELETE CASCADE,
  version_number INTEGER NOT NULL CHECK (version_number > 0),
  source_profile_version_id UUID REFERENCES public.budget_rate_profile_versions(id) ON DELETE SET NULL,
  input_snapshot JSONB NOT NULL,
  totals_snapshot JSONB NOT NULL,
  change_reason TEXT,
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (budget_id, version_number)
);

CREATE TABLE public.tourist_budget_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  budget_version_id UUID NOT NULL REFERENCES public.tourist_budget_versions(id) ON DELETE CASCADE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  property_id UUID REFERENCES public.properties(id) ON DELETE SET NULL,
  property_code TEXT,
  property_name TEXT NOT NULL,
  property_address TEXT,
  feature_counts JSONB NOT NULL DEFAULT '{}'::jsonb,
  time_input JSONB NOT NULL DEFAULT '{}'::jsonb,
  logistics_input JSONB NOT NULL DEFAULT '{}'::jsonb,
  service_lines JSONB NOT NULL DEFAULT '{}'::jsonb,
  result_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.tourist_budget_status_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  budget_id UUID NOT NULL REFERENCES public.tourist_budgets(id) ON DELETE CASCADE,
  from_status public.tourist_budget_status,
  to_status public.tourist_budget_status NOT NULL,
  note TEXT,
  changed_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.tourist_budget_documents (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  budget_id UUID NOT NULL REFERENCES public.tourist_budgets(id) ON DELETE CASCADE,
  version_id UUID NOT NULL REFERENCES public.tourist_budget_versions(id) ON DELETE CASCADE,
  document_type TEXT NOT NULL DEFAULT 'commercial_pdf' CHECK (document_type = 'commercial_pdf'),
  file_name TEXT NOT NULL,
  storage_path TEXT,
  content_sha256 TEXT,
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.tourist_budget_activation_runs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  budget_id UUID NOT NULL REFERENCES public.tourist_budgets(id) ON DELETE CASCADE,
  version_id UUID NOT NULL REFERENCES public.tourist_budget_versions(id) ON DELETE RESTRICT,
  status public.tourist_budget_activation_status NOT NULL DEFAULT 'proposed',
  error_message TEXT,
  created_by UUID NOT NULL REFERENCES auth.users(id),
  applied_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  applied_at TIMESTAMPTZ
);

CREATE TABLE public.tourist_budget_activation_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  activation_run_id UUID NOT NULL REFERENCES public.tourist_budget_activation_runs(id) ON DELETE CASCADE,
  property_id UUID REFERENCES public.properties(id) ON DELETE SET NULL,
  action TEXT NOT NULL CHECK (action IN ('create', 'update')),
  before_snapshot JSONB,
  after_snapshot JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX budget_rate_profiles_sede_idx ON public.budget_rate_profiles(sede_id);
CREATE INDEX budget_rate_profiles_client_idx ON public.budget_rate_profiles(client_id);
CREATE INDEX tourist_budgets_sede_status_idx ON public.tourist_budgets(sede_id, status, updated_at DESC);
CREATE INDEX tourist_budgets_client_idx ON public.tourist_budgets(client_id);
CREATE INDEX tourist_budget_versions_budget_idx ON public.tourist_budget_versions(budget_id, version_number DESC);
CREATE INDEX tourist_budget_items_version_idx ON public.tourist_budget_items(budget_version_id, sort_order);
CREATE INDEX tourist_budget_status_history_budget_idx ON public.tourist_budget_status_history(budget_id, created_at DESC);
CREATE INDEX tourist_budget_documents_budget_idx ON public.tourist_budget_documents(budget_id, created_at DESC);
CREATE INDEX tourist_budget_activation_runs_budget_idx ON public.tourist_budget_activation_runs(budget_id, created_at DESC);

CREATE UNIQUE INDEX budget_rate_profiles_default_name_idx
  ON public.budget_rate_profiles(sede_id, COALESCE(client_id, '00000000-0000-0000-0000-000000000000'::uuid), lower(name));

CREATE OR REPLACE FUNCTION public.touch_tourist_budget_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER tourist_budgets_updated_at
  BEFORE UPDATE ON public.tourist_budgets
  FOR EACH ROW EXECUTE FUNCTION public.touch_tourist_budget_updated_at();

CREATE TRIGGER budget_rate_profiles_updated_at
  BEFORE UPDATE ON public.budget_rate_profiles
  FOR EACH ROW EXECUTE FUNCTION public.touch_tourist_budget_updated_at();

DO $$
DECLARE
  table_name TEXT;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'budget_rate_profiles',
    'budget_rate_profile_versions',
    'tourist_budgets',
    'tourist_budget_versions',
    'tourist_budget_items',
    'tourist_budget_status_history',
    'tourist_budget_documents',
    'tourist_budget_activation_runs',
    'tourist_budget_activation_items'
  ] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', table_name);
    EXECUTE format('REVOKE ALL ON TABLE public.%I FROM anon, PUBLIC', table_name);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR ALL TO authenticated USING (public.has_role(auth.uid(), ''admin''::public.app_role)) WITH CHECK (public.has_role(auth.uid(), ''admin''::public.app_role))', table_name || '_admin_all', table_name);
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated', table_name);
  END LOOP;
END;
$$;

GRANT USAGE, SELECT ON SEQUENCE public.tourist_budget_quote_seq TO authenticated;

CREATE OR REPLACE FUNCTION public.create_tourist_budget(
  p_sede_id UUID,
  p_client_id UUID,
  p_title TEXT,
  p_prospect_name TEXT,
  p_validity_date DATE,
  p_snapshot JSONB,
  p_totals JSONB,
  p_items JSONB,
  p_commercial_notes TEXT DEFAULT NULL,
  p_internal_notes TEXT DEFAULT NULL,
  p_terms TEXT DEFAULT NULL,
  p_source_profile_version_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_budget_id UUID;
  new_version_id UUID;
  quote TEXT;
  item JSONB;
  item_index INTEGER := 0;
  total_cost NUMERIC(12,2) := COALESCE((p_totals->>'totalCost')::NUMERIC, 0);
  total_revenue NUMERIC(12,2) := COALESCE((p_totals->>'totalRevenue')::NUMERIC, 0);
  contribution NUMERIC(12,2) := COALESCE((p_totals->>'contribution')::NUMERIC, 0);
  margin NUMERIC(7,2) := COALESCE((p_totals->>'marginPercentage')::NUMERIC, 0);
  monthly_cost NUMERIC(12,2) := COALESCE((p_totals->>'monthlyCost')::NUMERIC, 0);
  monthly_revenue NUMERIC(12,2) := COALESCE((p_totals->>'monthlyRevenue')::NUMERIC, 0);
  monthly_contribution NUMERIC(12,2) := COALESCE((p_totals->>'monthlyContribution')::NUMERIC, 0);
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'Solo un administrador puede crear presupuestos';
  END IF;
  IF p_sede_id IS NULL OR p_title IS NULL OR length(trim(p_title)) = 0 THEN
    RAISE EXCEPTION 'La sede y el título del presupuesto son obligatorios';
  END IF;
  IF total_cost < 0 OR total_revenue < 0 OR monthly_cost < 0 OR monthly_revenue < 0 THEN
    RAISE EXCEPTION 'Los totales no pueden ser negativos';
  END IF;

  quote := format('PRES-%s-%s', to_char(current_date, 'YYYYMMDD'), lpad(nextval('public.tourist_budget_quote_seq')::TEXT, 5, '0'));

  INSERT INTO public.tourist_budgets (
    sede_id, client_id, quote_number, title, prospect_name, validity_date,
    monthly_rotations, total_cost, total_revenue, contribution, margin_percentage,
    monthly_cost, monthly_revenue, monthly_contribution,
    commercial_notes, internal_notes, terms, created_by
  ) VALUES (
    p_sede_id, p_client_id, quote, trim(p_title), NULLIF(trim(p_prospect_name), ''), p_validity_date,
    GREATEST(COALESCE((p_snapshot->>'monthlyRotations')::INTEGER, 1), 1),
    total_cost, total_revenue, contribution, margin, monthly_cost, monthly_revenue, monthly_contribution,
    p_commercial_notes, p_internal_notes, p_terms, auth.uid()
  ) RETURNING id INTO new_budget_id;

  INSERT INTO public.tourist_budget_versions (
    budget_id, version_number, source_profile_version_id, input_snapshot, totals_snapshot, created_by
  ) VALUES (
    new_budget_id, 1, p_source_profile_version_id, COALESCE(p_snapshot, '{}'::jsonb), COALESCE(p_totals, '{}'::jsonb), auth.uid()
  ) RETURNING id INTO new_version_id;

  FOR item IN SELECT value FROM jsonb_array_elements(COALESCE(p_items, '[]'::jsonb)) LOOP
    INSERT INTO public.tourist_budget_items (
      budget_version_id, sort_order, property_id, property_code, property_name, property_address,
      feature_counts, time_input, logistics_input, service_lines, result_snapshot
    ) VALUES (
      new_version_id,
      item_index,
      NULLIF(item->>'propertyId', '')::UUID,
      NULLIF(item->>'propertyCode', ''),
      COALESCE(NULLIF(item->>'propertyName', ''), format('Propiedad %s', item_index + 1)),
      NULLIF(item->>'propertyAddress', ''),
      COALESCE(item->'featureCounts', '{}'::jsonb),
      COALESCE(item->'timeInput', '{}'::jsonb),
      COALESCE(item->'logisticsInput', '{}'::jsonb),
      COALESCE(item->'serviceLines', '{}'::jsonb),
      COALESCE(item->'resultSnapshot', '{}'::jsonb)
    );
    item_index := item_index + 1;
  END LOOP;

  INSERT INTO public.tourist_budget_status_history (budget_id, from_status, to_status, changed_by)
  VALUES (new_budget_id, NULL, 'draft', auth.uid());

  RETURN jsonb_build_object('budgetId', new_budget_id, 'versionId', new_version_id, 'quoteNumber', quote);
END;
$$;

CREATE OR REPLACE FUNCTION public.save_tourist_budget_version(
  p_budget_id UUID,
  p_snapshot JSONB,
  p_totals JSONB,
  p_items JSONB,
  p_change_reason TEXT DEFAULT NULL,
  p_source_profile_version_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  budget_row public.tourist_budgets%ROWTYPE;
  new_version_number INTEGER;
  new_version_id UUID;
  item JSONB;
  item_index INTEGER := 0;
  total_cost NUMERIC(12,2) := COALESCE((p_totals->>'totalCost')::NUMERIC, 0);
  total_revenue NUMERIC(12,2) := COALESCE((p_totals->>'totalRevenue')::NUMERIC, 0);
  contribution NUMERIC(12,2) := COALESCE((p_totals->>'contribution')::NUMERIC, 0);
  margin NUMERIC(7,2) := COALESCE((p_totals->>'marginPercentage')::NUMERIC, 0);
  monthly_cost NUMERIC(12,2) := COALESCE((p_totals->>'monthlyCost')::NUMERIC, 0);
  monthly_revenue NUMERIC(12,2) := COALESCE((p_totals->>'monthlyRevenue')::NUMERIC, 0);
  monthly_contribution NUMERIC(12,2) := COALESCE((p_totals->>'monthlyContribution')::NUMERIC, 0);
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'Solo un administrador puede versionar presupuestos';
  END IF;

  SELECT * INTO budget_row FROM public.tourist_budgets WHERE id = p_budget_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Presupuesto no encontrado'; END IF;
  IF budget_row.status IN ('accepted', 'archived') THEN
    RAISE EXCEPTION 'Un presupuesto aceptado o archivado no se puede editar; cree una nueva versión operativa';
  END IF;

  new_version_number := budget_row.current_version_number + 1;
  INSERT INTO public.tourist_budget_versions (
    budget_id, version_number, source_profile_version_id, input_snapshot, totals_snapshot, change_reason, created_by
  ) VALUES (
    p_budget_id, new_version_number, p_source_profile_version_id, COALESCE(p_snapshot, '{}'::jsonb), COALESCE(p_totals, '{}'::jsonb), p_change_reason, auth.uid()
  ) RETURNING id INTO new_version_id;

  FOR item IN SELECT value FROM jsonb_array_elements(COALESCE(p_items, '[]'::jsonb)) LOOP
    INSERT INTO public.tourist_budget_items (
      budget_version_id, sort_order, property_id, property_code, property_name, property_address,
      feature_counts, time_input, logistics_input, service_lines, result_snapshot
    ) VALUES (
      new_version_id,
      item_index,
      NULLIF(item->>'propertyId', '')::UUID,
      NULLIF(item->>'propertyCode', ''),
      COALESCE(NULLIF(item->>'propertyName', ''), format('Propiedad %s', item_index + 1)),
      NULLIF(item->>'propertyAddress', ''),
      COALESCE(item->'featureCounts', '{}'::jsonb),
      COALESCE(item->'timeInput', '{}'::jsonb),
      COALESCE(item->'logisticsInput', '{}'::jsonb),
      COALESCE(item->'serviceLines', '{}'::jsonb),
      COALESCE(item->'resultSnapshot', '{}'::jsonb)
    );
    item_index := item_index + 1;
  END LOOP;

  UPDATE public.tourist_budgets SET
    current_version_number = new_version_number,
    monthly_rotations = GREATEST(COALESCE((p_snapshot->>'monthlyRotations')::INTEGER, monthly_rotations), 1),
    total_cost = total_cost,
    total_revenue = total_revenue,
    contribution = contribution,
    margin_percentage = margin,
    monthly_cost = monthly_cost,
    monthly_revenue = monthly_revenue,
    monthly_contribution = monthly_contribution
  WHERE id = p_budget_id;

  RETURN jsonb_build_object('budgetId', p_budget_id, 'versionId', new_version_id, 'versionNumber', new_version_number);
END;
$$;

CREATE OR REPLACE FUNCTION public.transition_tourist_budget(
  p_budget_id UUID,
  p_to_status public.tourist_budget_status,
  p_note TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_status public.tourist_budget_status;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'Solo un administrador puede cambiar estados';
  END IF;

  SELECT status INTO current_status FROM public.tourist_budgets WHERE id = p_budget_id FOR UPDATE;
  IF current_status IS NULL THEN RAISE EXCEPTION 'Presupuesto no encontrado'; END IF;

  IF NOT (
    (current_status = 'draft' AND p_to_status IN ('review', 'sent', 'rejected', 'archived')) OR
    (current_status = 'review' AND p_to_status IN ('draft', 'sent', 'rejected', 'archived')) OR
    (current_status = 'sent' AND p_to_status IN ('accepted', 'rejected', 'expired')) OR
    (current_status = 'rejected' AND p_to_status IN ('draft', 'archived')) OR
    (current_status = 'expired' AND p_to_status IN ('draft', 'archived')) OR
    (current_status = 'accepted' AND p_to_status = 'archived') OR
    (current_status = 'archived' AND p_to_status = 'draft')
  ) THEN
    RAISE EXCEPTION 'Transición de estado no permitida: % -> %', current_status, p_to_status;
  END IF;

  UPDATE public.tourist_budgets SET
    status = p_to_status,
    accepted_by = CASE WHEN p_to_status = 'accepted' THEN auth.uid() ELSE accepted_by END,
    accepted_at = CASE WHEN p_to_status = 'accepted' THEN now() ELSE accepted_at END
  WHERE id = p_budget_id;

  INSERT INTO public.tourist_budget_status_history (budget_id, from_status, to_status, note, changed_by)
  VALUES (p_budget_id, current_status, p_to_status, p_note, auth.uid());

  RETURN jsonb_build_object('budgetId', p_budget_id, 'fromStatus', current_status, 'toStatus', p_to_status);
END;
$$;

CREATE OR REPLACE FUNCTION public.activate_tourist_budget(
  p_budget_id UUID,
  p_version_id UUID,
  p_items JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  budget_row public.tourist_budgets%ROWTYPE;
  version_exists BOOLEAN;
  previous_run UUID;
  run_id UUID;
  item JSONB;
  item_index INTEGER := 0;
  requested_property_id UUID;
  final_property_id UUID;
  action_name TEXT;
  action_choice TEXT;
  before_snapshot JSONB;
  after_snapshot JSONB;
  property_name TEXT;
  property_address TEXT;
  property_code TEXT;
  duration_minutes INTEGER;
  sale_price NUMERIC(10,2);
  bedrooms INTEGER;
  bathrooms INTEGER;
  beds INTEGER;
  kitchens INTEGER;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'Solo un administrador puede activar presupuestos';
  END IF;

  SELECT * INTO budget_row FROM public.tourist_budgets WHERE id = p_budget_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Presupuesto no encontrado'; END IF;
  IF budget_row.status <> 'accepted' THEN
    RAISE EXCEPTION 'Solo se puede activar un presupuesto aceptado';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.tourist_budget_versions WHERE id = p_version_id AND budget_id = p_budget_id
  ) INTO version_exists;
  IF NOT version_exists THEN RAISE EXCEPTION 'La versión no pertenece al presupuesto'; END IF;

  SELECT id INTO previous_run
  FROM public.tourist_budget_activation_runs
  WHERE budget_id = p_budget_id AND version_id = p_version_id AND status = 'applied'
  ORDER BY created_at DESC LIMIT 1;
  IF previous_run IS NOT NULL THEN
    RETURN jsonb_build_object('activationRunId', previous_run, 'idempotent', true);
  END IF;

  INSERT INTO public.tourist_budget_activation_runs (
    budget_id, version_id, status, created_by, applied_by, applied_at
  ) VALUES (
    p_budget_id, p_version_id, 'applied', auth.uid(), auth.uid(), now()
  ) RETURNING id INTO run_id;

  FOR item IN SELECT value FROM jsonb_array_elements(COALESCE(p_items, '[]'::jsonb)) LOOP
    requested_property_id := NULLIF(item->>'propertyId', '')::UUID;
    property_name := COALESCE(NULLIF(item->>'propertyName', ''), item #>> '{property,name}', format('Propiedad %s', item_index + 1));
    property_address := COALESCE(NULLIF(item->>'propertyAddress', ''), item #>> '{property,address}', 'Dirección pendiente');
    property_code := COALESCE(NULLIF(item->>'propertyCode', ''), item #>> '{property,code}', format('%s-%s', budget_row.quote_number, item_index + 1));
    duration_minutes := GREATEST(COALESCE(NULLIF(item->>'durationMinutes', '')::INTEGER, (item #>> '{resultSnapshot,durationMinutes}')::INTEGER, 60), 1);
    sale_price := GREATEST(COALESCE(NULLIF(item->>'salePrice', '')::NUMERIC, (item #>> '{resultSnapshot,salePrice}')::NUMERIC, 0), 0);
    bedrooms := GREATEST(COALESCE(NULLIF(item->>'bedrooms', '')::INTEGER, (item #>> '{featureCounts,bedrooms}')::INTEGER, 0), 0);
    bathrooms := GREATEST(COALESCE(NULLIF(item->>'bathrooms', '')::INTEGER, (item #>> '{featureCounts,bathrooms}')::INTEGER, 0), 0);
    beds := GREATEST(COALESCE(NULLIF(item->>'beds', '')::INTEGER, (item #>> '{featureCounts,beds}')::INTEGER, 0), 0);
    kitchens := GREATEST(COALESCE(NULLIF(item->>'kitchens', '')::INTEGER, (item #>> '{featureCounts,kitchens}')::INTEGER, 0), 0);
    action_choice := COALESCE(item->>'activationAction', CASE WHEN requested_property_id IS NULL THEN 'create' ELSE 'update' END);
    IF action_choice NOT IN ('create', 'update') THEN
      RAISE EXCEPTION 'La acción de activación no es válida';
    END IF;
    IF requested_property_id IS NULL AND action_choice <> 'create' THEN
      RAISE EXCEPTION 'Una propiedad nueva debe activarse con la acción crear';
    END IF;
    IF requested_property_id IS NOT NULL AND action_choice <> 'update' THEN
      RAISE EXCEPTION 'Una propiedad existente debe activarse con la acción actualizar';
    END IF;

    IF requested_property_id IS NULL THEN
      IF budget_row.client_id IS NULL THEN
        RAISE EXCEPTION 'No se puede crear una propiedad sin cliente vinculado';
      END IF;
      INSERT INTO public.properties (
        codigo, nombre, direccion, numero_camas, numero_banos, numero_cocinas,
        duracion_servicio, coste_servicio, cliente_id, sede_id,
        planning_estimated_checkout_minutes, planning_estimated_stay_minutes,
        planning_required_cleaners, planning_complexity,
        planning_requires_linen_load, planning_requires_amenities_load, notas
      ) VALUES (
        property_code, property_name, property_address, beds, bathrooms, kitchens,
        duration_minutes, sale_price, budget_row.client_id, budget_row.sede_id,
        duration_minutes, duration_minutes, GREATEST(1, LEAST(4, CEIL(duration_minutes / 180.0)::INTEGER)),
        GREATEST(1, LEAST(5, CEIL(duration_minutes / 60.0)::INTEGER)),
        COALESCE((item #>> '{logisticsInput,bags}')::NUMERIC, 0) > 0,
        COALESCE((item #>> '{serviceLines,amenities,salePrice}')::NUMERIC, 0) > 0,
        format('Creada desde el presupuesto %s. Revisar configuración operativa antes de programar.', budget_row.quote_number)
      ) RETURNING id INTO final_property_id;
      action_name := 'create';
      before_snapshot := NULL;
    ELSE
      SELECT to_jsonb(p) INTO before_snapshot
      FROM public.properties p
      WHERE p.id = requested_property_id AND p.sede_id = budget_row.sede_id
      FOR UPDATE;
      IF before_snapshot IS NULL THEN
        RAISE EXCEPTION 'La propiedad seleccionada no pertenece a la sede del presupuesto';
      END IF;
      UPDATE public.properties SET
        duracion_servicio = duration_minutes,
        coste_servicio = sale_price,
        numero_camas = CASE WHEN beds > 0 THEN beds ELSE numero_camas END,
        numero_banos = CASE WHEN bathrooms > 0 THEN bathrooms ELSE numero_banos END,
        numero_cocinas = CASE WHEN kitchens > 0 THEN kitchens ELSE numero_cocinas END,
        planning_estimated_checkout_minutes = duration_minutes,
        planning_estimated_stay_minutes = duration_minutes,
        planning_required_cleaners = GREATEST(1, LEAST(4, CEIL(duration_minutes / 180.0)::INTEGER)),
        planning_complexity = GREATEST(1, LEAST(5, CEIL(duration_minutes / 60.0)::INTEGER)),
        planning_requires_linen_load = COALESCE((item #>> '{logisticsInput,bags}')::NUMERIC, 0) > 0,
        planning_requires_amenities_load = COALESCE((item #>> '{serviceLines,amenities,salePrice}')::NUMERIC, 0) > 0,
        notas = concat_ws(E'\n', NULLIF(notas, ''), format('Actualizada desde el presupuesto %s.', budget_row.quote_number))
      WHERE id = requested_property_id;
      final_property_id := requested_property_id;
      action_name := 'update';
    END IF;

    SELECT to_jsonb(p) INTO after_snapshot FROM public.properties p WHERE p.id = final_property_id;
    INSERT INTO public.tourist_budget_activation_items (
      activation_run_id, property_id, action, before_snapshot, after_snapshot
    ) VALUES (run_id, final_property_id, action_name, before_snapshot, after_snapshot);
    item_index := item_index + 1;
  END LOOP;

  RETURN jsonb_build_object('activationRunId', run_id, 'idempotent', false, 'items', item_index);
EXCEPTION WHEN OTHERS THEN
  IF run_id IS NOT NULL THEN
    UPDATE public.tourist_budget_activation_runs SET status = 'failed', error_message = SQLERRM WHERE id = run_id;
  END IF;
  RAISE;
END;
$$;

REVOKE ALL ON FUNCTION public.create_tourist_budget(UUID, UUID, TEXT, TEXT, DATE, JSONB, JSONB, JSONB, TEXT, TEXT, TEXT, UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.save_tourist_budget_version(UUID, JSONB, JSONB, JSONB, TEXT, UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.transition_tourist_budget(UUID, public.tourist_budget_status, TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.activate_tourist_budget(UUID, UUID, JSONB) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_tourist_budget(UUID, UUID, TEXT, TEXT, DATE, JSONB, JSONB, JSONB, TEXT, TEXT, TEXT, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.save_tourist_budget_version(UUID, JSONB, JSONB, JSONB, TEXT, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.transition_tourist_budget(UUID, public.tourist_budget_status, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.activate_tourist_budget(UUID, UUID, JSONB) TO authenticated;

-- Perfil base por sede: solo crea configuración aditiva para sedes activas sin perfil estándar.
INSERT INTO public.budget_rate_profiles (sede_id, name, description, created_by)
SELECT s.id, 'Turístico estándar', 'Perfil inicial editable para presupuestos turísticos', auth.uid()
FROM public.sedes s
WHERE s.is_active
  AND auth.uid() IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.budget_rate_profiles p
    WHERE p.sede_id = s.id AND p.client_id IS NULL AND lower(p.name) = lower('Turístico estándar')
  );
