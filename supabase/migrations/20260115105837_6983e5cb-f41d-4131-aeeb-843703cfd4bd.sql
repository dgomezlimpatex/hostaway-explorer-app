-- =============================================
-- FASE 1: Sistema de Portal de Clientes
-- =============================================

-- 1.1 Tabla client_portal_access
-- Almacena credenciales de acceso de cada cliente
CREATE TABLE public.client_portal_access (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  access_pin VARCHAR(6) NOT NULL,
  portal_token UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  last_access_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT unique_client_portal UNIQUE (client_id)
);

-- 1.2 Tabla client_reservations
-- Almacena las reservas creadas por los clientes
CREATE TABLE public.client_reservations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  property_id UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  check_in_date DATE NOT NULL,
  check_out_date DATE NOT NULL,
  guest_count INTEGER,
  special_requests TEXT,
  task_id UUID REFERENCES public.tasks(id) ON DELETE SET NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'cancelled', 'completed')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT check_dates CHECK (check_out_date > check_in_date)
);

-- 1.3 Tabla client_reservation_logs
-- Registro de todas las acciones sobre reservas
CREATE TABLE public.client_reservation_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  reservation_id UUID REFERENCES public.client_reservations(id) ON DELETE SET NULL,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  action VARCHAR(20) NOT NULL CHECK (action IN ('created', 'updated', 'cancelled')),
  old_data JSONB,
  new_data JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Índices para mejorar rendimiento
CREATE INDEX idx_client_portal_access_token ON public.client_portal_access(portal_token);
CREATE INDEX idx_client_portal_access_client ON public.client_portal_access(client_id);
CREATE INDEX idx_client_reservations_client ON public.client_reservations(client_id);
CREATE INDEX idx_client_reservations_property ON public.client_reservations(property_id);
CREATE INDEX idx_client_reservations_dates ON public.client_reservations(check_in_date, check_out_date);
CREATE INDEX idx_client_reservations_status ON public.client_reservations(status);
CREATE INDEX idx_client_reservation_logs_reservation ON public.client_reservation_logs(reservation_id);
CREATE INDEX idx_client_reservation_logs_client ON public.client_reservation_logs(client_id);
CREATE INDEX idx_client_reservation_logs_created ON public.client_reservation_logs(created_at);

-- Trigger para actualizar updated_at
CREATE TRIGGER update_client_portal_access_updated_at
  BEFORE UPDATE ON public.client_portal_access
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_client_reservations_updated_at
  BEFORE UPDATE ON public.client_reservations
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- =============================================
-- RLS Policies
-- =============================================

-- Habilitar RLS en todas las tablas
ALTER TABLE public.client_portal_access ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_reservations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_reservation_logs ENABLE ROW LEVEL SECURITY;

-- Políticas para client_portal_access
-- Los usuarios autenticados pueden ver/gestionar el acceso de sus clientes
CREATE POLICY "Users can view client portal access"
  ON public.client_portal_access
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can create client portal access"
  ON public.client_portal_access
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Users can update client portal access"
  ON public.client_portal_access
  FOR UPDATE
  TO authenticated
  USING (true);

CREATE POLICY "Users can delete client portal access"
  ON public.client_portal_access
  FOR DELETE
  TO authenticated
  USING (true);

-- Política para acceso anónimo (portal público) - solo lectura del token
CREATE POLICY "Anonymous can verify portal token"
  ON public.client_portal_access
  FOR SELECT
  TO anon
  USING (is_active = true);

-- Políticas para client_reservations
CREATE POLICY "Users can view all reservations"
  ON public.client_reservations
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can create reservations"
  ON public.client_reservations
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Users can update reservations"
  ON public.client_reservations
  FOR UPDATE
  TO authenticated
  USING (true);

CREATE POLICY "Users can delete reservations"
  ON public.client_reservations
  FOR DELETE
  TO authenticated
  USING (true);

-- Políticas para acceso anónimo (portal público)
CREATE POLICY "Anonymous can view reservations via portal"
  ON public.client_reservations
  FOR SELECT
  TO anon
  USING (
    EXISTS (
      SELECT 1 FROM public.client_portal_access cpa
      WHERE cpa.client_id = client_reservations.client_id
      AND cpa.is_active = true
    )
  );

CREATE POLICY "Anonymous can create reservations via portal"
  ON public.client_reservations
  FOR INSERT
  TO anon
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.client_portal_access cpa
      WHERE cpa.client_id = client_reservations.client_id
      AND cpa.is_active = true
    )
  );

CREATE POLICY "Anonymous can update reservations via portal"
  ON public.client_reservations
  FOR UPDATE
  TO anon
  USING (
    EXISTS (
      SELECT 1 FROM public.client_portal_access cpa
      WHERE cpa.client_id = client_reservations.client_id
      AND cpa.is_active = true
    )
  );

-- Políticas para client_reservation_logs
CREATE POLICY "Users can view all logs"
  ON public.client_reservation_logs
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can create logs"
  ON public.client_reservation_logs
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Anonymous can view logs via portal"
  ON public.client_reservation_logs
  FOR SELECT
  TO anon
  USING (
    EXISTS (
      SELECT 1 FROM public.client_portal_access cpa
      WHERE cpa.client_id = client_reservation_logs.client_id
      AND cpa.is_active = true
    )
  );

CREATE POLICY "Anonymous can create logs via portal"
  ON public.client_reservation_logs
  FOR INSERT
  TO anon
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.client_portal_access cpa
      WHERE cpa.client_id = client_reservation_logs.client_id
      AND cpa.is_active = true
    )
  );

-- =============================================
-- Función para generar PIN aleatorio de 6 dígitos
-- =============================================
CREATE OR REPLACE FUNCTION public.generate_random_pin()
RETURNS VARCHAR(6)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN LPAD(FLOOR(RANDOM() * 1000000)::TEXT, 6, '0');
END;
$$;