
-- Crear la tabla de clientes con todas las columnas necesarias
CREATE TABLE public.clients (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nombre TEXT NOT NULL,
  cif_nif TEXT NOT NULL,
  telefono TEXT NOT NULL,
  email TEXT NOT NULL,
  direccion_facturacion TEXT NOT NULL,
  codigo_postal TEXT NOT NULL,
  ciudad TEXT NOT NULL,
  tipo_servicio TEXT NOT NULL CHECK (tipo_servicio IN (
    'limpieza-mantenimiento',
    'mantenimiento-cristaleria', 
    'mantenimiento-airbnb',
    'limpieza-puesta-punto',
    'limpieza-final-obra',
    'check-in',
    'desplazamiento',
    'limpieza-especial',
    'trabajo-extraordinario'
  )),
  metodo_pago TEXT NOT NULL CHECK (metodo_pago IN ('transferencia', 'efectivo', 'bizum')),
  supervisor TEXT NOT NULL,
  factura BOOLEAN NOT NULL DEFAULT false,
  fecha_creacion DATE NOT NULL DEFAULT CURRENT_DATE,
  fecha_actualizacion DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Habilitar Row Level Security (RLS)
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;

-- Crear políticas RLS para permitir acceso a todos los usuarios autenticados
-- (por ahora sin restricciones de usuario específico)
CREATE POLICY "Allow all operations for authenticated users" 
  ON public.clients 
  FOR ALL 
  USING (true)
  WITH CHECK (true);

-- Crear índices para optimizar consultas
CREATE INDEX idx_clients_nombre ON public.clients(nombre);
CREATE INDEX idx_clients_email ON public.clients(email);
CREATE INDEX idx_clients_tipo_servicio ON public.clients(tipo_servicio);

-- Crear función para actualizar automatically fecha_actualizacion
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    NEW.fecha_actualizacion = CURRENT_DATE;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Crear trigger para actualizar automáticamente fecha_actualizacion
CREATE TRIGGER update_clients_updated_at 
  BEFORE UPDATE ON public.clients 
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();
