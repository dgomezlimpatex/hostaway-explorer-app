
-- Crear tabla de propiedades
CREATE TABLE public.properties (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  codigo TEXT NOT NULL UNIQUE,
  nombre TEXT NOT NULL,
  direccion TEXT NOT NULL,
  numero_camas INTEGER NOT NULL DEFAULT 0,
  numero_banos INTEGER NOT NULL DEFAULT 0,
  duracion_servicio INTEGER NOT NULL DEFAULT 60, -- en minutos
  coste_servicio DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  check_in_predeterminado TIME NOT NULL DEFAULT '15:00',
  check_out_predeterminado TIME NOT NULL DEFAULT '11:00',
  numero_sabanas INTEGER NOT NULL DEFAULT 0,
  numero_toallas_grandes INTEGER NOT NULL DEFAULT 0,
  numero_toallas_pequenas INTEGER NOT NULL DEFAULT 0,
  numero_alfombrines INTEGER NOT NULL DEFAULT 0,
  numero_fundas_almohada INTEGER NOT NULL DEFAULT 0,
  notas TEXT DEFAULT '',
  cliente_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  fecha_creacion DATE NOT NULL DEFAULT CURRENT_DATE,
  fecha_actualizacion DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Crear tabla de trabajadores/limpiadores
CREATE TABLE public.cleaners (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT,
  telefono TEXT,
  avatar TEXT, -- URL del avatar
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Crear tabla de tareas
CREATE TABLE public.tasks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  property TEXT NOT NULL, -- nombre de la propiedad
  address TEXT NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  type TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending', 'in-progress', 'completed')) DEFAULT 'pending',
  check_out TIME NOT NULL,
  check_in TIME NOT NULL,
  cleaner TEXT, -- nombre del limpiador asignado
  background_color TEXT DEFAULT '#3B82F6',
  date DATE NOT NULL,
  cliente_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
  propiedad_id UUID REFERENCES public.properties(id) ON DELETE SET NULL,
  cleaner_id UUID REFERENCES public.cleaners(id) ON DELETE SET NULL,
  duracion INTEGER, -- en minutos
  coste DECIMAL(10,2), -- en euros
  metodo_pago TEXT,
  supervisor TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Crear tabla de tareas recurrentes
CREATE TABLE public.recurring_tasks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  cliente_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
  propiedad_id UUID REFERENCES public.properties(id) ON DELETE SET NULL,
  type TEXT NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  check_out TIME NOT NULL,
  check_in TIME NOT NULL,
  duracion INTEGER, -- en minutos
  coste DECIMAL(10,2), -- en euros
  metodo_pago TEXT,
  supervisor TEXT,
  cleaner TEXT, -- nombre del limpiador
  cleaner_id UUID REFERENCES public.cleaners(id) ON DELETE SET NULL,
  
  -- Configuración de recurrencia
  frequency TEXT NOT NULL CHECK (frequency IN ('daily', 'weekly', 'monthly')),
  interval_days INTEGER NOT NULL DEFAULT 1,
  days_of_week INTEGER[], -- array para días de la semana (0=domingo, 1=lunes, etc.)
  day_of_month INTEGER, -- para frecuencia mensual
  start_date DATE NOT NULL,
  end_date DATE, -- opcional
  
  -- Estado
  is_active BOOLEAN NOT NULL DEFAULT true,
  next_execution DATE NOT NULL,
  last_execution DATE,
  
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Habilitar RLS en todas las tablas
ALTER TABLE public.properties ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cleaners ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recurring_tasks ENABLE ROW LEVEL SECURITY;

-- Crear políticas RLS para permitir acceso a todos los usuarios autenticados
CREATE POLICY "Allow all operations for authenticated users" 
  ON public.properties FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow all operations for authenticated users" 
  ON public.cleaners FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow all operations for authenticated users" 
  ON public.tasks FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow all operations for authenticated users" 
  ON public.recurring_tasks FOR ALL USING (true) WITH CHECK (true);

-- Crear índices para optimizar consultas
CREATE INDEX idx_properties_cliente_id ON public.properties(cliente_id);
CREATE INDEX idx_properties_codigo ON public.properties(codigo);
CREATE INDEX idx_properties_nombre ON public.properties(nombre);

CREATE INDEX idx_cleaners_name ON public.cleaners(name);
CREATE INDEX idx_cleaners_is_active ON public.cleaners(is_active);

CREATE INDEX idx_tasks_date ON public.tasks(date);
CREATE INDEX idx_tasks_status ON public.tasks(status);
CREATE INDEX idx_tasks_cleaner_id ON public.tasks(cleaner_id);
CREATE INDEX idx_tasks_propiedad_id ON public.tasks(propiedad_id);

CREATE INDEX idx_recurring_tasks_next_execution ON public.recurring_tasks(next_execution);
CREATE INDEX idx_recurring_tasks_is_active ON public.recurring_tasks(is_active);

-- Crear triggers para actualizar automáticamente updated_at
CREATE TRIGGER update_properties_updated_at 
  BEFORE UPDATE ON public.properties 
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_cleaners_updated_at 
  BEFORE UPDATE ON public.cleaners 
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_tasks_updated_at 
  BEFORE UPDATE ON public.tasks 
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_recurring_tasks_updated_at 
  BEFORE UPDATE ON public.recurring_tasks 
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();
