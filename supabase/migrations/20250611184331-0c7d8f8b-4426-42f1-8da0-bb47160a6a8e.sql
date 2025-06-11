
-- Añadir campos a la tabla properties para mapear con Hostaway
ALTER TABLE public.properties 
ADD COLUMN IF NOT EXISTS hostaway_listing_id INTEGER,
ADD COLUMN IF NOT EXISTS hostaway_internal_name TEXT;

-- Crear índice para búsquedas rápidas por nombre de Hostaway
CREATE INDEX IF NOT EXISTS idx_properties_hostaway_name 
ON public.properties(hostaway_internal_name);

-- Crear tabla para tracking de reservas sincronizadas
CREATE TABLE IF NOT EXISTS public.hostaway_reservations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  hostaway_reservation_id INTEGER NOT NULL UNIQUE,
  property_id UUID REFERENCES public.properties(id),
  cliente_id UUID REFERENCES public.clients(id),
  arrival_date DATE NOT NULL,
  departure_date DATE NOT NULL,
  reservation_date DATE,
  cancellation_date DATE,
  nights INTEGER,
  status TEXT NOT NULL,
  adults INTEGER,
  task_id UUID REFERENCES public.tasks(id),
  last_sync_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Crear índices para optimizar búsquedas
CREATE INDEX IF NOT EXISTS idx_hostaway_reservations_property 
ON public.hostaway_reservations(property_id);

CREATE INDEX IF NOT EXISTS idx_hostaway_reservations_status 
ON public.hostaway_reservations(status);

CREATE INDEX IF NOT EXISTS idx_hostaway_reservations_departure 
ON public.hostaway_reservations(departure_date);

-- Trigger para actualizar updated_at
CREATE OR REPLACE TRIGGER update_hostaway_reservations_updated_at
    BEFORE UPDATE ON public.hostaway_reservations
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- Crear tabla para logs de sincronización
CREATE TABLE IF NOT EXISTS public.hostaway_sync_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  sync_started_at TIMESTAMP WITH TIME ZONE NOT NULL,
  sync_completed_at TIMESTAMP WITH TIME ZONE,
  reservations_processed INTEGER DEFAULT 0,
  new_reservations INTEGER DEFAULT 0,
  updated_reservations INTEGER DEFAULT 0,
  cancelled_reservations INTEGER DEFAULT 0,
  tasks_created INTEGER DEFAULT 0,
  errors TEXT[],
  status TEXT NOT NULL DEFAULT 'running', -- running, completed, failed
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
