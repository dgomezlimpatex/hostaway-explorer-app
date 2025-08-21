-- =========================================
-- FASE 1.3: ACTUALIZACIÓN DE POLÍTICAS RLS PARA FILTRAR POR SEDE
-- =========================================

-- Crear función helper para verificar acceso a sede (evita recursión RLS)
CREATE OR REPLACE FUNCTION public.user_has_sede_access(_user_id uuid, _sede_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
AS $$
  -- Verificar si el usuario es admin (acceso a todas las sedes)
  SELECT CASE 
    WHEN EXISTS (
      SELECT 1 FROM public.user_roles 
      WHERE user_id = _user_id AND role = 'admin'::app_role
    ) THEN true
    -- Si no es admin, verificar acceso específico a la sede
    ELSE EXISTS (
      SELECT 1 FROM public.user_sede_access 
      WHERE user_id = _user_id 
      AND sede_id = _sede_id 
      AND can_access = true
    )
  END;
$$;

-- Crear función para obtener sedes accesibles por el usuario actual
CREATE OR REPLACE FUNCTION public.get_user_accessible_sedes()
RETURNS uuid[]
LANGUAGE sql
STABLE SECURITY DEFINER
AS $$
  SELECT CASE 
    WHEN EXISTS (
      SELECT 1 FROM public.user_roles 
      WHERE user_id = auth.uid() AND role = 'admin'::app_role
    ) THEN (
      -- Admin: todas las sedes activas
      SELECT array_agg(id) FROM public.sedes WHERE is_active = true
    )
    ELSE (
      -- Usuario normal: solo sedes con acceso
      SELECT array_agg(usa.sede_id) 
      FROM public.user_sede_access usa
      JOIN public.sedes s ON s.id = usa.sede_id
      WHERE usa.user_id = auth.uid() 
      AND usa.can_access = true 
      AND s.is_active = true
    )
  END;
$$;

-- =========================================
-- ACTUALIZAR RLS PARA TABLA CLIENTS
-- =========================================

-- Eliminar políticas existentes de clients si existen
DROP POLICY IF EXISTS "Admin, manager, supervisor can manage clients" ON public.clients;

-- Nueva política para clients con filtro por sede
CREATE POLICY "Users can access clients from their assigned sedes"
ON public.clients
FOR ALL
TO authenticated
USING (
  sede_id = ANY(public.get_user_accessible_sedes()) 
  AND EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
    AND ur.role = ANY (ARRAY['admin'::app_role, 'manager'::app_role, 'supervisor'::app_role])
  )
)
WITH CHECK (
  sede_id = ANY(public.get_user_accessible_sedes())
  AND EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
    AND ur.role = ANY (ARRAY['admin'::app_role, 'manager'::app_role, 'supervisor'::app_role])
  )
);

-- =========================================
-- ACTUALIZAR RLS PARA TABLA PROPERTIES
-- =========================================

-- Eliminar políticas existentes de properties
DROP POLICY IF EXISTS "Admin, manager, supervisor can manage properties" ON public.properties;
DROP POLICY IF EXISTS "Cleaners can view properties for their assigned tasks" ON public.properties;
DROP POLICY IF EXISTS "Logistics can view properties" ON public.properties;

-- Nueva política para properties con filtro por sede
CREATE POLICY "Users can access properties from their assigned sedes"
ON public.properties
FOR ALL
TO authenticated
USING (
  sede_id = ANY(public.get_user_accessible_sedes())
  AND EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
    AND ur.role = ANY (ARRAY['admin'::app_role, 'manager'::app_role, 'supervisor'::app_role])
  )
)
WITH CHECK (
  sede_id = ANY(public.get_user_accessible_sedes())
  AND EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
    AND ur.role = ANY (ARRAY['admin'::app_role, 'manager'::app_role, 'supervisor'::app_role])
  )
);

-- Política para cleaners ver propiedades de sus tareas en sus sedes
CREATE POLICY "Cleaners can view properties for their tasks in assigned sedes"
ON public.properties
FOR SELECT
TO authenticated
USING (
  sede_id = ANY(public.get_user_accessible_sedes())
  AND EXISTS (
    SELECT 1 FROM cleaners c
    JOIN tasks t ON t.cleaner_id = c.id
    WHERE c.user_id = auth.uid()
    AND t.propiedad_id = properties.id
    AND c.sede_id = properties.sede_id
  )
);

-- Política para logistics ver propiedades de sus sedes
CREATE POLICY "Logistics can view properties from assigned sedes"
ON public.properties
FOR SELECT
TO authenticated
USING (
  sede_id = ANY(public.get_user_accessible_sedes())
  AND has_role(auth.uid(), 'logistics'::app_role)
);

-- =========================================
-- ACTUALIZAR RLS PARA TABLA CLEANERS
-- =========================================

-- Eliminar políticas existentes de cleaners
DROP POLICY IF EXISTS "Admins and managers can manage cleaners" ON public.cleaners;
DROP POLICY IF EXISTS "Cleaners can view and update their own data" ON public.cleaners;
DROP POLICY IF EXISTS "Supervisors can view cleaners" ON public.cleaners;

-- Nueva política para cleaners con filtro por sede
CREATE POLICY "Users can manage cleaners from their assigned sedes"
ON public.cleaners
FOR ALL
TO authenticated
USING (
  sede_id = ANY(public.get_user_accessible_sedes())
  AND EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
    AND ur.role = ANY (ARRAY['admin'::app_role, 'manager'::app_role])
  )
)
WITH CHECK (
  sede_id = ANY(public.get_user_accessible_sedes())
  AND EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
    AND ur.role = ANY (ARRAY['admin'::app_role, 'manager'::app_role])
  )
);

-- Política para cleaners ver/actualizar sus propios datos
CREATE POLICY "Cleaners can manage their own data"
ON public.cleaners
FOR ALL
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- Política para supervisors ver cleaners de sus sedes
CREATE POLICY "Supervisors can view cleaners from assigned sedes"
ON public.cleaners
FOR SELECT
TO authenticated
USING (
  sede_id = ANY(public.get_user_accessible_sedes())
  AND EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
    AND ur.role = 'supervisor'::app_role
  )
);

-- =========================================
-- ACTUALIZAR RLS PARA TABLA TASKS
-- =========================================

-- Nota: Las políticas de tasks ya existen pero necesitan actualizarse para sede
-- Vamos a crear nuevas políticas más específicas

-- Política para gestión de tareas por sede
CREATE POLICY "Users can manage tasks from their assigned sedes"
ON public.tasks
FOR ALL
TO authenticated
USING (
  sede_id = ANY(public.get_user_accessible_sedes())
  AND EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
    AND ur.role = ANY (ARRAY['admin'::app_role, 'manager'::app_role, 'supervisor'::app_role])
  )
)
WITH CHECK (
  sede_id = ANY(public.get_user_accessible_sedes())
  AND EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
    AND ur.role = ANY (ARRAY['admin'::app_role, 'manager'::app_role, 'supervisor'::app_role])
  )
);

-- =========================================
-- ACTUALIZAR RLS PARA INVENTORY_PRODUCTS
-- =========================================

-- Eliminar políticas existentes de inventory_products
DROP POLICY IF EXISTS "Admin y managers pueden gestionar productos" ON public.inventory_products;

-- Nueva política para inventory_products con filtro por sede
CREATE POLICY "Users can manage products from their assigned sedes"
ON public.inventory_products
FOR ALL
TO authenticated
USING (
  sede_id = ANY(public.get_user_accessible_sedes())
  AND EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
    AND ur.role = ANY (ARRAY['admin'::app_role, 'manager'::app_role])
  )
)
WITH CHECK (
  sede_id = ANY(public.get_user_accessible_sedes())
  AND EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
    AND ur.role = ANY (ARRAY['admin'::app_role, 'manager'::app_role])
  )
);

-- =========================================
-- ACTUALIZAR RLS PARA INVENTORY_STOCK
-- =========================================

-- Eliminar políticas existentes de inventory_stock
DROP POLICY IF EXISTS "Admin y managers pueden gestionar stock" ON public.inventory_stock;
DROP POLICY IF EXISTS "Supervisores pueden ver stock" ON public.inventory_stock;

-- Nueva política para inventory_stock con filtro por sede
CREATE POLICY "Users can manage stock from their assigned sedes"
ON public.inventory_stock
FOR ALL
TO authenticated
USING (
  sede_id = ANY(public.get_user_accessible_sedes())
  AND EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
    AND ur.role = ANY (ARRAY['admin'::app_role, 'manager'::app_role])
  )
)
WITH CHECK (
  sede_id = ANY(public.get_user_accessible_sedes())
  AND EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
    AND ur.role = ANY (ARRAY['admin'::app_role, 'manager'::app_role])
  )
);

-- Política para supervisores ver stock de sus sedes
CREATE POLICY "Supervisors can view stock from assigned sedes"
ON public.inventory_stock
FOR SELECT
TO authenticated
USING (
  sede_id = ANY(public.get_user_accessible_sedes())
  AND EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
    AND ur.role = 'supervisor'::app_role
  )
);

-- =========================================
-- ACTUALIZAR RLS PARA LOGISTICS_PICKLISTS
-- =========================================

-- Eliminar políticas existentes si existen
DROP POLICY IF EXISTS "Admin and managers can manage picklists" ON public.logistics_picklists;
DROP POLICY IF EXISTS "Logistics can manage picklists" ON public.logistics_picklists;
DROP POLICY IF EXISTS "Supervisors can view picklists" ON public.logistics_picklists;

-- Nueva política para logistics_picklists con filtro por sede
CREATE POLICY "Users can manage picklists from their assigned sedes"
ON public.logistics_picklists
FOR ALL
TO authenticated
USING (
  sede_id = ANY(public.get_user_accessible_sedes())
  AND (
    has_role(auth.uid(), 'admin'::app_role) OR 
    has_role(auth.uid(), 'manager'::app_role) OR 
    has_role(auth.uid(), 'logistics'::app_role)
  )
)
WITH CHECK (
  sede_id = ANY(public.get_user_accessible_sedes())
  AND (
    has_role(auth.uid(), 'admin'::app_role) OR 
    has_role(auth.uid(), 'manager'::app_role) OR 
    has_role(auth.uid(), 'logistics'::app_role)
  )
);

-- Política para supervisores ver picklists de sus sedes
CREATE POLICY "Supervisors can view picklists from assigned sedes"
ON public.logistics_picklists
FOR SELECT
TO authenticated
USING (
  sede_id = ANY(public.get_user_accessible_sedes())
  AND has_role(auth.uid(), 'supervisor'::app_role)
);

-- =========================================
-- ACTUALIZAR RLS PARA LOGISTICS_DELIVERIES
-- =========================================

-- Eliminar políticas existentes si existen
DROP POLICY IF EXISTS "Admin and managers can manage deliveries" ON public.logistics_deliveries;
DROP POLICY IF EXISTS "Logistics can manage deliveries" ON public.logistics_deliveries;
DROP POLICY IF EXISTS "Supervisors can view deliveries" ON public.logistics_deliveries;

-- Nueva política para logistics_deliveries con filtro por sede
CREATE POLICY "Users can manage deliveries from their assigned sedes"
ON public.logistics_deliveries
FOR ALL
TO authenticated
USING (
  sede_id = ANY(public.get_user_accessible_sedes())
  AND (
    has_role(auth.uid(), 'admin'::app_role) OR 
    has_role(auth.uid(), 'manager'::app_role) OR 
    has_role(auth.uid(), 'logistics'::app_role)
  )
)
WITH CHECK (
  sede_id = ANY(public.get_user_accessible_sedes())
  AND (
    has_role(auth.uid(), 'admin'::app_role) OR 
    has_role(auth.uid(), 'manager'::app_role) OR 
    has_role(auth.uid(), 'logistics'::app_role)
  )
);

-- Política para supervisores ver deliveries de sus sedes
CREATE POLICY "Supervisors can view deliveries from assigned sedes"
ON public.logistics_deliveries
FOR SELECT
TO authenticated
USING (
  sede_id = ANY(public.get_user_accessible_sedes())
  AND has_role(auth.uid(), 'supervisor'::app_role)
);

-- =========================================
-- COMENTARIOS PARA DOCUMENTACIÓN
-- =========================================

COMMENT ON FUNCTION public.user_has_sede_access(uuid, uuid) IS 'Verifica si un usuario tiene acceso a una sede específica (admins tienen acceso a todas)';
COMMENT ON FUNCTION public.get_user_accessible_sedes() IS 'Retorna array de UUIDs de sedes a las que el usuario actual tiene acceso';