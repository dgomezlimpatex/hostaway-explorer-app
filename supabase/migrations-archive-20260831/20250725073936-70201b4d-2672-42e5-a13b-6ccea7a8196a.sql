-- CRITICAL SECURITY FIXES - Phase 2

-- 1. Add security audit logging table
CREATE TABLE IF NOT EXISTS public.security_audit_log (
    id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    event_type text NOT NULL,
    user_id uuid REFERENCES auth.users(id),
    event_data jsonb DEFAULT '{}',
    ip_address inet,
    user_agent text,
    created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS on audit log
ALTER TABLE public.security_audit_log ENABLE ROW LEVEL SECURITY;

-- Only admins can view audit logs
CREATE POLICY "Only admins can view audit logs" 
ON public.security_audit_log 
FOR SELECT 
USING (
    EXISTS (
        SELECT 1 FROM public.user_roles 
        WHERE user_id = auth.uid() AND role = 'admin'
    )
);

-- System can insert audit logs
CREATE POLICY "System can insert audit logs" 
ON public.security_audit_log 
FOR INSERT 
WITH CHECK (true);

-- 2. Add email format validation constraint
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.constraint_column_usage 
        WHERE constraint_name = 'check_email_format' 
        AND table_name = 'user_invitations'
    ) THEN
        ALTER TABLE public.user_invitations 
        ADD CONSTRAINT check_email_format 
        CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$');
    END IF;
END
$$;

-- 3. Function to log security events
CREATE OR REPLACE FUNCTION public.log_security_event(
    event_type text,
    event_data jsonb DEFAULT '{}',
    target_user_id uuid DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
BEGIN
    INSERT INTO public.security_audit_log (
        event_type,
        user_id,
        event_data
    ) VALUES (
        event_type,
        COALESCE(target_user_id, auth.uid()),
        event_data
    );
END;
$function$;

-- 4. Update cleanup function to be more secure
CREATE OR REPLACE FUNCTION public.cleanup_expired_invitations()
 RETURNS void
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path = ''
AS $function$
    UPDATE public.user_invitations
    SET status = 'expired'
    WHERE status = 'pending' AND expires_at < now();
$function$;

-- 5. Secure the process_automatic_inventory_consumption function
CREATE OR REPLACE FUNCTION public.process_automatic_inventory_consumption(task_id_param uuid, property_id_param uuid, user_id_param uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = ''
AS $function$
DECLARE
  property_data RECORD;
  mapping_record RECORD;
  amenity_quantity INTEGER;
  current_stock_record RECORD;
  movement_reason TEXT;
BEGIN
  -- Validate inputs
  IF task_id_param IS NULL OR property_id_param IS NULL OR user_id_param IS NULL THEN
    RAISE EXCEPTION 'Todos los parámetros son requeridos';
  END IF;
  
  -- Obtener datos de la propiedad
  SELECT * INTO property_data 
  FROM public.properties 
  WHERE id = property_id_param;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Propiedad no encontrada';
  END IF;
  
  movement_reason := 'Consumo automático por limpieza completada en ' || property_data.nombre;
  
  -- Procesar cada mapeo de amenity a producto
  FOR mapping_record IN 
    SELECT * FROM public.property_amenity_inventory_mapping 
    WHERE is_active = true
  LOOP
    -- Obtener la cantidad del amenity específico de la propiedad
    CASE mapping_record.amenity_field
      WHEN 'numero_sabanas' THEN amenity_quantity := property_data.numero_sabanas;
      WHEN 'numero_toallas_grandes' THEN amenity_quantity := property_data.numero_toallas_grandes;
      WHEN 'numero_toallas_pequenas' THEN amenity_quantity := property_data.numero_toallas_pequenas;
      WHEN 'numero_alfombrines' THEN amenity_quantity := property_data.numero_alfombrines;
      WHEN 'numero_fundas_almohada' THEN amenity_quantity := property_data.numero_fundas_almohada;
      WHEN 'kit_alimentario' THEN amenity_quantity := property_data.kit_alimentario;
      ELSE amenity_quantity := 0;
    END CASE;
    
    -- Solo procesar si hay cantidad a consumir
    IF amenity_quantity > 0 THEN
      -- Obtener stock actual
      SELECT * INTO current_stock_record
      FROM public.inventory_stock
      WHERE product_id = mapping_record.product_id;
      
      IF FOUND THEN
        -- Crear movimiento de salida
        INSERT INTO public.inventory_movements (
          product_id,
          movement_type,
          quantity,
          previous_quantity,
          new_quantity,
          reason,
          created_by,
          property_id,
          task_id
        ) VALUES (
          mapping_record.product_id,
          'salida',
          amenity_quantity,
          current_stock_record.current_quantity,
          current_stock_record.current_quantity - amenity_quantity,
          movement_reason,
          user_id_param,
          property_id_param,
          task_id_param
        );
        
        -- Actualizar stock
        UPDATE public.inventory_stock 
        SET 
          current_quantity = current_quantity - amenity_quantity,
          updated_by = user_id_param
        WHERE product_id = mapping_record.product_id;
        
        -- Crear alerta si el stock queda bajo
        INSERT INTO public.inventory_alerts (
          product_id,
          alert_type
        )
        SELECT 
          mapping_record.product_id,
          CASE 
            WHEN (current_stock_record.current_quantity - amenity_quantity) <= 0 THEN 'sin_stock'
            WHEN (current_stock_record.current_quantity - amenity_quantity) <= current_stock_record.minimum_stock THEN 'stock_bajo'
            ELSE NULL
          END
        WHERE 
          CASE 
            WHEN (current_stock_record.current_quantity - amenity_quantity) <= 0 THEN 'sin_stock'
            WHEN (current_stock_record.current_quantity - amenity_quantity) <= current_stock_record.minimum_stock THEN 'stock_bajo'
            ELSE NULL
          END IS NOT NULL
          AND NOT EXISTS (
            SELECT 1 FROM public.inventory_alerts 
            WHERE product_id = mapping_record.product_id 
            AND is_active = true
          );
      END IF;
    END IF;
  END LOOP;
END;
$function$;