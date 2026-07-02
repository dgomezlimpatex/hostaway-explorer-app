-- Operational planning MVP

ALTER TABLE public.property_groups
  ADD COLUMN IF NOT EXISTS internal_code TEXT,
  ADD COLUMN IF NOT EXISTS display_name TEXT,
  ADD COLUMN IF NOT EXISTS zone TEXT,
  ADD COLUMN IF NOT EXISTS client_name TEXT,
  ADD COLUMN IF NOT EXISTS supervisor_name TEXT,
  ADD COLUMN IF NOT EXISTS general_instructions TEXT,
  ADD COLUMN IF NOT EXISTS difficulty_level INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS recommended_capacity INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS planning_notes TEXT;

ALTER TABLE public.cleaner_group_assignments
  ADD COLUMN IF NOT EXISTS role_type TEXT NOT NULL DEFAULT 'primary'
    CHECK (role_type IN ('primary', 'secondary', 'backup')),
  ADD COLUMN IF NOT EXISTS knowledge_level INTEGER NOT NULL DEFAULT 3
    CHECK (knowledge_level BETWEEN 1 AND 5),
  ADD COLUMN IF NOT EXISTS notes TEXT,
  ADD COLUMN IF NOT EXISTS max_daily_minutes_override INTEGER;

ALTER TABLE public.properties
  ADD COLUMN IF NOT EXISTS planning_estimated_checkout_minutes INTEGER,
  ADD COLUMN IF NOT EXISTS planning_estimated_stay_minutes INTEGER,
  ADD COLUMN IF NOT EXISTS planning_required_cleaners INTEGER NOT NULL DEFAULT 1
    CHECK (planning_required_cleaners BETWEEN 1 AND 4),
  ADD COLUMN IF NOT EXISTS planning_complexity INTEGER NOT NULL DEFAULT 1
    CHECK (planning_complexity BETWEEN 1 AND 5),
  ADD COLUMN IF NOT EXISTS planning_requires_linen_load BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS planning_requires_amenities_load BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS planning_special_instructions TEXT;

ALTER TABLE public.cleaners
  ADD COLUMN IF NOT EXISTS planning_max_daily_minutes INTEGER NOT NULL DEFAULT 480,
  ADD COLUMN IF NOT EXISTS planning_zone TEXT,
  ADD COLUMN IF NOT EXISTS planning_operational_restrictions TEXT,
  ADD COLUMN IF NOT EXISTS planning_can_handle_linen_load BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS planning_can_handle_complex_cleanings BOOLEAN NOT NULL DEFAULT true;

CREATE TABLE IF NOT EXISTS public.planning_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sede_id UUID REFERENCES public.sedes(id) ON DELETE CASCADE,
  horizon_days INTEGER NOT NULL DEFAULT 14 CHECK (horizon_days BETWEEN 1 AND 30),
  buffer_minutes INTEGER NOT NULL DEFAULT 30 CHECK (buffer_minutes BETWEEN 0 AND 180),
  allow_backups BOOLEAN NOT NULL DEFAULT true,
  exclude_extraordinary BOOLEAN NOT NULL DEFAULT true,
  approval_required BOOLEAN NOT NULL DEFAULT true,
  fallback_daily_capacity_minutes INTEGER NOT NULL DEFAULT 480 CHECK (fallback_daily_capacity_minutes BETWEEN 60 AND 900),
  weekly_tolerance_percent NUMERIC(5,2) NOT NULL DEFAULT 10 CHECK (weekly_tolerance_percent BETWEEN 0 AND 100),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (sede_id)
);

CREATE TABLE IF NOT EXISTS public.planning_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sede_id UUID REFERENCES public.sedes(id) ON DELETE CASCADE,
  date_from DATE NOT NULL,
  date_to DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'approved', 'discarded')),
  summary JSONB NOT NULL DEFAULT '{}'::jsonb,
  generated_by UUID REFERENCES auth.users(id),
  approved_by UUID REFERENCES auth.users(id),
  approved_at TIMESTAMPTZ,
  discarded_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.planning_run_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id UUID NOT NULL REFERENCES public.planning_runs(id) ON DELETE CASCADE,
  task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  property_id UUID REFERENCES public.properties(id) ON DELETE SET NULL,
  property_group_id UUID REFERENCES public.property_groups(id) ON DELETE SET NULL,
  proposed_cleaner_ids UUID[] NOT NULL DEFAULT '{}'::uuid[],
  proposed_cleaner_names TEXT[] NOT NULL DEFAULT '{}'::text[],
  role_source TEXT NOT NULL,
  explanation TEXT NOT NULL,
  warnings TEXT[] NOT NULL DEFAULT '{}'::text[],
  score NUMERIC(8,2) NOT NULL DEFAULT 0,
  proposal JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'approved', 'discarded', 'applied')),
  applied_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (run_id, task_id)
);

CREATE TABLE IF NOT EXISTS public.planning_conflicts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id UUID NOT NULL REFERENCES public.planning_runs(id) ON DELETE CASCADE,
  task_id UUID REFERENCES public.tasks(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  message TEXT NOT NULL,
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.planning_notification_batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id UUID NOT NULL REFERENCES public.planning_runs(id) ON DELETE CASCADE,
  cleaner_id UUID NOT NULL REFERENCES public.cleaners(id) ON DELETE CASCADE,
  cleaner_email TEXT,
  cleaner_name TEXT NOT NULL,
  task_date DATE NOT NULL,
  task_ids UUID[] NOT NULL DEFAULT '{}'::uuid[],
  notification_key TEXT NOT NULL UNIQUE,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed')),
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_planning_runs_sede_status_created
  ON public.planning_runs(sede_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_planning_run_items_run_id
  ON public.planning_run_items(run_id);

CREATE INDEX IF NOT EXISTS idx_planning_run_items_task_id
  ON public.planning_run_items(task_id);

CREATE INDEX IF NOT EXISTS idx_planning_conflicts_run_id
  ON public.planning_conflicts(run_id);

CREATE INDEX IF NOT EXISTS idx_planning_notification_batches_run_id
  ON public.planning_notification_batches(run_id);

CREATE INDEX IF NOT EXISTS idx_planning_notification_batches_cleaner_date
  ON public.planning_notification_batches(cleaner_id, task_date DESC);

ALTER TABLE public.planning_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.planning_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.planning_run_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.planning_conflicts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.planning_notification_batches ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins and managers manage planning settings" ON public.planning_settings;
CREATE POLICY "Admins and managers manage planning settings"
ON public.planning_settings
FOR ALL
TO authenticated
USING (public.user_has_role('admin') OR public.user_has_role('manager'))
WITH CHECK (public.user_has_role('admin') OR public.user_has_role('manager'));

DROP POLICY IF EXISTS "Admins and managers manage planning runs" ON public.planning_runs;
CREATE POLICY "Admins and managers manage planning runs"
ON public.planning_runs
FOR ALL
TO authenticated
USING (public.user_has_role('admin') OR public.user_has_role('manager'))
WITH CHECK (public.user_has_role('admin') OR public.user_has_role('manager'));

DROP POLICY IF EXISTS "Admins and managers manage planning run items" ON public.planning_run_items;
CREATE POLICY "Admins and managers manage planning run items"
ON public.planning_run_items
FOR ALL
TO authenticated
USING (public.user_has_role('admin') OR public.user_has_role('manager'))
WITH CHECK (public.user_has_role('admin') OR public.user_has_role('manager'));

DROP POLICY IF EXISTS "Admins and managers manage planning conflicts" ON public.planning_conflicts;
CREATE POLICY "Admins and managers manage planning conflicts"
ON public.planning_conflicts
FOR ALL
TO authenticated
USING (public.user_has_role('admin') OR public.user_has_role('manager'))
WITH CHECK (public.user_has_role('admin') OR public.user_has_role('manager'));

DROP POLICY IF EXISTS "Admins and managers manage planning notification batches" ON public.planning_notification_batches;
CREATE POLICY "Admins and managers manage planning notification batches"
ON public.planning_notification_batches
FOR ALL
TO authenticated
USING (public.user_has_role('admin') OR public.user_has_role('manager'))
WITH CHECK (public.user_has_role('admin') OR public.user_has_role('manager'));

DROP TRIGGER IF EXISTS update_planning_settings_updated_at ON public.planning_settings;
CREATE TRIGGER update_planning_settings_updated_at
  BEFORE UPDATE ON public.planning_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_planning_runs_updated_at ON public.planning_runs;
CREATE TRIGGER update_planning_runs_updated_at
  BEFORE UPDATE ON public.planning_runs
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_planning_run_items_updated_at ON public.planning_run_items;
CREATE TRIGGER update_planning_run_items_updated_at
  BEFORE UPDATE ON public.planning_run_items
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_planning_notification_batches_updated_at ON public.planning_notification_batches;
CREATE TRIGGER update_planning_notification_batches_updated_at
  BEFORE UPDATE ON public.planning_notification_batches
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
