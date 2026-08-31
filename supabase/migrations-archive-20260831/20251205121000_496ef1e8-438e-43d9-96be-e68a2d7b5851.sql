-- Crear enum para estados de entrega de lavandería
CREATE TYPE laundry_delivery_status AS ENUM ('pending', 'prepared', 'delivered');

-- Tabla para enlaces compartibles de lavandería
CREATE TABLE public.laundry_share_links (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  token TEXT NOT NULL UNIQUE,
  created_by UUID NOT NULL,
  date_start DATE NOT NULL,
  date_end DATE NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE,
  is_permanent BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  snapshot_task_ids UUID[] DEFAULT '{}',
  filters JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabla para seguimiento de entregas de lavandería
CREATE TABLE public.laundry_delivery_tracking (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  share_link_id UUID NOT NULL REFERENCES public.laundry_share_links(id) ON DELETE CASCADE,
  task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  status laundry_delivery_status NOT NULL DEFAULT 'pending',
  prepared_at TIMESTAMP WITH TIME ZONE,
  prepared_by_name TEXT,
  delivered_at TIMESTAMP WITH TIME ZONE,
  delivered_by_name TEXT,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(share_link_id, task_id)
);

-- Índices para mejor rendimiento
CREATE INDEX idx_laundry_share_links_token ON public.laundry_share_links(token);
CREATE INDEX idx_laundry_share_links_active ON public.laundry_share_links(is_active) WHERE is_active = true;
CREATE INDEX idx_laundry_share_links_dates ON public.laundry_share_links(date_start, date_end);
CREATE INDEX idx_laundry_delivery_tracking_link ON public.laundry_delivery_tracking(share_link_id);
CREATE INDEX idx_laundry_delivery_tracking_task ON public.laundry_delivery_tracking(task_id);
CREATE INDEX idx_laundry_delivery_tracking_status ON public.laundry_delivery_tracking(status);

-- Habilitar RLS
ALTER TABLE public.laundry_share_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.laundry_delivery_tracking ENABLE ROW LEVEL SECURITY;

-- RLS para laundry_share_links
-- Admin y managers pueden gestionar todos los enlaces
CREATE POLICY "Admin and managers can manage share links"
ON public.laundry_share_links
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
    AND ur.role IN ('admin', 'manager')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
    AND ur.role IN ('admin', 'manager')
  )
);

-- Lectura pública por token (para repartidores sin cuenta)
CREATE POLICY "Public can read active links by token"
ON public.laundry_share_links
FOR SELECT
USING (
  is_active = true
  AND (expires_at IS NULL OR expires_at > now())
);

-- RLS para laundry_delivery_tracking
-- Admin y managers pueden ver todo el tracking
CREATE POLICY "Admin and managers can view all tracking"
ON public.laundry_delivery_tracking
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
    AND ur.role IN ('admin', 'manager')
  )
);

-- Lectura pública para tracking de enlaces activos
CREATE POLICY "Public can read tracking for active links"
ON public.laundry_delivery_tracking
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.laundry_share_links lsl
    WHERE lsl.id = laundry_delivery_tracking.share_link_id
    AND lsl.is_active = true
    AND (lsl.expires_at IS NULL OR lsl.expires_at > now())
  )
);

-- Cualquiera puede insertar tracking para enlaces activos (repartidores sin cuenta)
CREATE POLICY "Public can insert tracking for active links"
ON public.laundry_delivery_tracking
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.laundry_share_links lsl
    WHERE lsl.id = laundry_delivery_tracking.share_link_id
    AND lsl.is_active = true
    AND (lsl.expires_at IS NULL OR lsl.expires_at > now())
  )
);

-- Cualquiera puede actualizar tracking para enlaces activos
CREATE POLICY "Public can update tracking for active links"
ON public.laundry_delivery_tracking
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.laundry_share_links lsl
    WHERE lsl.id = laundry_delivery_tracking.share_link_id
    AND lsl.is_active = true
    AND (lsl.expires_at IS NULL OR lsl.expires_at > now())
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.laundry_share_links lsl
    WHERE lsl.id = laundry_delivery_tracking.share_link_id
    AND lsl.is_active = true
    AND (lsl.expires_at IS NULL OR lsl.expires_at > now())
  )
);

-- Trigger para actualizar updated_at
CREATE TRIGGER update_laundry_share_links_updated_at
BEFORE UPDATE ON public.laundry_share_links
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_laundry_delivery_tracking_updated_at
BEFORE UPDATE ON public.laundry_delivery_tracking
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();