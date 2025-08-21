-- Crear tabla para auditoría de cambios de sede
CREATE TABLE IF NOT EXISTS public.sede_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL CHECK (event_type IN ('sede_changed', 'sede_access_granted', 'sede_access_revoked', 'sede_created', 'sede_updated', 'sede_deactivated')),
  from_sede_id UUID REFERENCES public.sedes(id) ON DELETE SET NULL,
  to_sede_id UUID REFERENCES public.sedes(id) ON DELETE SET NULL,
  event_data JSONB DEFAULT '{}'::jsonb,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Habilitar RLS en la tabla de auditoría
ALTER TABLE public.sede_audit_log ENABLE ROW LEVEL SECURITY;

-- Solo administradores pueden ver los logs de auditoría
CREATE POLICY "Only admins can view sede audit logs" 
ON public.sede_audit_log 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() AND role = 'admin'::app_role
  )
);

-- Solo el sistema puede insertar logs de auditoría
CREATE POLICY "System can insert sede audit logs" 
ON public.sede_audit_log 
FOR INSERT 
WITH CHECK (true);

-- Crear índices para optimizar consultas de auditoría
CREATE INDEX IF NOT EXISTS idx_sede_audit_log_user_id ON public.sede_audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_sede_audit_log_event_type ON public.sede_audit_log(event_type);
CREATE INDEX IF NOT EXISTS idx_sede_audit_log_created_at ON public.sede_audit_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sede_audit_log_sede_ids ON public.sede_audit_log(from_sede_id, to_sede_id);

-- Función para insertar logs de auditoría de sede
CREATE OR REPLACE FUNCTION public.log_sede_event(
  event_type_param TEXT,
  from_sede_id_param UUID DEFAULT NULL,
  to_sede_id_param UUID DEFAULT NULL,
  event_data_param JSONB DEFAULT '{}'::jsonb
) RETURNS VOID AS $$
BEGIN
  INSERT INTO public.sede_audit_log (
    user_id,
    event_type,
    from_sede_id,
    to_sede_id,
    event_data,
    ip_address
  ) VALUES (
    auth.uid(),
    event_type_param,
    from_sede_id_param,
    to_sede_id_param,
    event_data_param,
    inet_client_addr()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Comentarios para documentar la tabla
COMMENT ON TABLE public.sede_audit_log IS 'Log de auditoría para eventos relacionados con sedes';
COMMENT ON COLUMN public.sede_audit_log.event_type IS 'Tipo de evento: sede_changed, sede_access_granted, sede_access_revoked, etc.';
COMMENT ON COLUMN public.sede_audit_log.from_sede_id IS 'Sede origen (para cambios de sede)';
COMMENT ON COLUMN public.sede_audit_log.to_sede_id IS 'Sede destino (para cambios de sede)';
COMMENT ON COLUMN public.sede_audit_log.event_data IS 'Datos adicionales del evento en formato JSON';