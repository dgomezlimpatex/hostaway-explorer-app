
-- Table to store export tokens for secure CSV endpoint access
CREATE TABLE public.report_export_tokens (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  token text NOT NULL DEFAULT encode(gen_random_bytes(32), 'hex') UNIQUE,
  name text NOT NULL DEFAULT 'Token de exportación',
  sede_id uuid REFERENCES public.sedes(id),
  created_by uuid NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  last_used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.report_export_tokens ENABLE ROW LEVEL SECURITY;

-- Only admins/managers can manage tokens
CREATE POLICY "Admins and managers can view tokens"
  ON public.report_export_tokens FOR SELECT
  USING (public.user_is_admin_or_manager());

CREATE POLICY "Admins and managers can create tokens"
  ON public.report_export_tokens FOR INSERT
  WITH CHECK (public.user_is_admin_or_manager() AND auth.uid() = created_by);

CREATE POLICY "Admins and managers can update tokens"
  ON public.report_export_tokens FOR UPDATE
  USING (public.user_is_admin_or_manager());

CREATE POLICY "Admins and managers can delete tokens"
  ON public.report_export_tokens FOR DELETE
  USING (public.user_is_admin_or_manager());

-- Trigger for updated_at
CREATE TRIGGER update_report_export_tokens_updated_at
  BEFORE UPDATE ON public.report_export_tokens
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Log table for export history
CREATE TABLE public.daily_report_export_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  export_date date NOT NULL,
  rows_exported integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'success',
  error_message text,
  token_id uuid REFERENCES public.report_export_tokens(id),
  sede_id uuid REFERENCES public.sedes(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.daily_report_export_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins and managers can view export logs"
  ON public.daily_report_export_logs FOR SELECT
  USING (public.user_is_admin_or_manager());
