-- =========================================
-- FASE 1.1: CREACIÓN DE TABLAS BASE - SEDES
-- =========================================

-- Crear tabla sedes
CREATE TABLE public.sedes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nombre TEXT NOT NULL,
  codigo TEXT NOT NULL UNIQUE,
  ciudad TEXT NOT NULL,
  direccion TEXT,
  telefono TEXT,
  email TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Crear tabla user_sede_access para permisos
CREATE TABLE public.user_sede_access (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  sede_id UUID NOT NULL REFERENCES public.sedes(id) ON DELETE CASCADE,
  can_access BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, sede_id)
);

-- =========================================
-- POLÍTICAS RLS PARA TABLA SEDES
-- =========================================

-- Habilitar RLS en la tabla sedes
ALTER TABLE public.sedes ENABLE ROW LEVEL SECURITY;

-- Política: Admins pueden gestionar todas las sedes
CREATE POLICY "Admins pueden gestionar todas las sedes"
ON public.sedes
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
    AND ur.role = 'admin'::app_role
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
    AND ur.role = 'admin'::app_role
  )
);

-- Política: Managers pueden ver y actualizar sedes (no crear/eliminar)
CREATE POLICY "Managers pueden ver y actualizar sedes"
ON public.sedes
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
    AND ur.role IN ('manager'::app_role, 'supervisor'::app_role, 'cleaner'::app_role, 'client'::app_role, 'logistics'::app_role)
  )
);

CREATE POLICY "Managers pueden actualizar sedes"
ON public.sedes
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
    AND ur.role = 'manager'::app_role
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
    AND ur.role = 'manager'::app_role
  )
);

-- =========================================
-- POLÍTICAS RLS PARA TABLA USER_SEDE_ACCESS
-- =========================================

-- Habilitar RLS en la tabla user_sede_access
ALTER TABLE public.user_sede_access ENABLE ROW LEVEL SECURITY;

-- Política: Admins pueden gestionar todos los accesos
CREATE POLICY "Admins pueden gestionar accesos de sedes"
ON public.user_sede_access
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
    AND ur.role = 'admin'::app_role
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
    AND ur.role = 'admin'::app_role
  )
);

-- Política: Managers pueden gestionar accesos
CREATE POLICY "Managers pueden gestionar accesos de sedes"
ON public.user_sede_access
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
    AND ur.role = 'manager'::app_role
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
    AND ur.role = 'manager'::app_role
  )
);

-- Política: Usuarios pueden ver sus propios accesos
CREATE POLICY "Usuarios pueden ver sus propios accesos"
ON public.user_sede_access
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- =========================================
-- TRIGGERS PARA UPDATED_AT
-- =========================================

-- Trigger para actualizar updated_at en sedes
CREATE TRIGGER update_sedes_updated_at
  BEFORE UPDATE ON public.sedes
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Trigger para actualizar updated_at en user_sede_access
CREATE TRIGGER update_user_sede_access_updated_at
  BEFORE UPDATE ON public.user_sede_access
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- =========================================
-- DATOS INICIALES - SEDE POR DEFECTO
-- =========================================

-- Insertar sede por defecto para migración de datos existentes
INSERT INTO public.sedes (
  nombre,
  codigo,
  ciudad,
  direccion,
  is_active
) VALUES (
  'Sede Principal',
  'PRINCIPAL',
  'Ciudad Principal',
  'Dirección de la sede principal',
  true
);

-- =========================================
-- COMENTARIOS PARA DOCUMENTACIÓN
-- =========================================

COMMENT ON TABLE public.sedes IS 'Tabla que almacena la información de las diferentes sedes de la empresa';
COMMENT ON TABLE public.user_sede_access IS 'Tabla que controla qué usuarios tienen acceso a qué sedes';
COMMENT ON COLUMN public.sedes.codigo IS 'Código único identificador de la sede (ej: MAD, BCN, VAL)';
COMMENT ON COLUMN public.user_sede_access.can_access IS 'Indica si el usuario tiene acceso activo a la sede';