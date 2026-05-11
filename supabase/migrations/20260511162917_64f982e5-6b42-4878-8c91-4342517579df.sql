
-- Paso 2: Migración aditiva para sincronización con REGISTRO
-- Solo añade columnas nullables a cleaners (cero impacto en datos existentes)
-- y crea tabla de auditoría employee_sync_log.

ALTER TABLE public.cleaners
  ADD COLUMN IF NOT EXISTS external_id TEXT,
  ADD COLUMN IF NOT EXISTS first_name TEXT,
  ADD COLUMN IF NOT EXISTS last_name TEXT,
  ADD COLUMN IF NOT EXISTS dni TEXT,
  ADD COLUMN IF NOT EXISTS pin TEXT,
  ADD COLUMN IF NOT EXISTS category TEXT,
  ADD COLUMN IF NOT EXISTS delegation_name TEXT,
  ADD COLUMN IF NOT EXISTS office_name TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS cleaners_external_id_unique
  ON public.cleaners (external_id)
  WHERE external_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.employee_sync_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  triggered_by TEXT NOT NULL DEFAULT 'manual', -- 'manual' | 'cron' | 'link_decision'
  triggered_by_user UUID,
  dry_run BOOLEAN NOT NULL DEFAULT true,
  since_param TIMESTAMPTZ,
  include_inactive BOOLEAN NOT NULL DEFAULT false,
  fetched INTEGER NOT NULL DEFAULT 0,
  created INTEGER NOT NULL DEFAULT 0,
  updated INTEGER NOT NULL DEFAULT 0,
  deactivated INTEGER NOT NULL DEFAULT 0,
  linked INTEGER NOT NULL DEFAULT 0,
  errors JSONB NOT NULL DEFAULT '[]'::jsonb,
  duration_ms INTEGER,
  success BOOLEAN NOT NULL DEFAULT false
);

CREATE INDEX IF NOT EXISTS employee_sync_log_run_at_idx
  ON public.employee_sync_log (run_at DESC);

ALTER TABLE public.employee_sync_log ENABLE ROW LEVEL SECURITY;

-- Solo admin/manager pueden leer la auditoría
CREATE POLICY "Admin/manager can view sync log"
  ON public.employee_sync_log
  FOR SELECT
  TO authenticated
  USING (public.user_is_admin_or_manager());

-- Inserts/updates se hacen únicamente desde la edge function con service_role,
-- que ignora RLS. No definimos policies de INSERT/UPDATE para usuarios.
