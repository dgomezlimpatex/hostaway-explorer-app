-- Fase 2B: Completar mejoras de seguridad
-- Añadir search_path a las funciones restantes

-- 1. Actualizar función check_rate_limit con search_path
CREATE OR REPLACE FUNCTION public.check_rate_limit(
  check_identifier text, 
  check_action_type text, 
  max_attempts integer DEFAULT 5, 
  window_minutes integer DEFAULT 15, 
  block_minutes integer DEFAULT 15
)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = 'public'
AS $function$
DECLARE
    current_record RECORD;
    window_start TIMESTAMP WITH TIME ZONE;
    block_until TIMESTAMP WITH TIME ZONE;
BEGIN
    -- Validar parámetros de entrada
    IF check_identifier IS NULL OR trim(check_identifier) = '' THEN
        RAISE EXCEPTION 'identifier es requerido';
    END IF;
    
    IF check_action_type IS NULL OR trim(check_action_type) = '' THEN
        RAISE EXCEPTION 'action_type es requerido';
    END IF;
    
    window_start := now() - (window_minutes || ' minutes')::INTERVAL;
    
    -- Get or create rate limit record
    SELECT * INTO current_record
    FROM public.security_rate_limits
    WHERE identifier = check_identifier
    AND action_type = check_action_type;
    
    -- Check if currently blocked
    IF current_record.blocked_until IS NOT NULL AND current_record.blocked_until > now() THEN
        RETURN FALSE;
    END IF;
    
    -- Reset if outside window
    IF current_record.first_attempt_at IS NULL OR current_record.first_attempt_at < window_start THEN
        UPDATE public.security_rate_limits
        SET 
            attempt_count = 1,
            first_attempt_at = now(),
            last_attempt_at = now(),
            blocked_until = NULL,
            updated_at = now()
        WHERE identifier = check_identifier
        AND action_type = check_action_type;
        RETURN TRUE;
    END IF;
    
    -- Check if exceeded limits
    IF current_record.attempt_count >= max_attempts THEN
        block_until := now() + (block_minutes || ' minutes')::INTERVAL;
        
        UPDATE public.security_rate_limits
        SET 
            blocked_until = block_until,
            updated_at = now()
        WHERE identifier = check_identifier
        AND action_type = check_action_type;
        
        -- Log security event
        PERFORM public.log_security_event('rate_limit_exceeded', jsonb_build_object(
            'identifier', check_identifier,
            'action_type', check_action_type,
            'attempt_count', current_record.attempt_count,
            'blocked_until', block_until
        ));
        
        RETURN FALSE;
    END IF;
    
    -- Increment attempt count
    UPDATE public.security_rate_limits
    SET 
        attempt_count = attempt_count + 1,
        last_attempt_at = now(),
        updated_at = now()
    WHERE identifier = check_identifier
    AND action_type = check_action_type;
    
    -- If record doesn't exist, create it
    IF NOT FOUND THEN
        INSERT INTO public.security_rate_limits (
            identifier,
            action_type,
            attempt_count,
            first_attempt_at,
            last_attempt_at
        ) VALUES (
            check_identifier,
            check_action_type,
            1,
            now(),
            now()
        );
    END IF;
    
    RETURN TRUE;
END;
$function$;

-- 2. Actualizar función reset_rate_limit con search_path
CREATE OR REPLACE FUNCTION public.reset_rate_limit(reset_identifier text, reset_action_type text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = 'public'
AS $function$
BEGIN
    -- Validar parámetros
    IF reset_identifier IS NULL OR trim(reset_identifier) = '' THEN
        RAISE EXCEPTION 'identifier es requerido';
    END IF;
    
    IF reset_action_type IS NULL OR trim(reset_action_type) = '' THEN
        RAISE EXCEPTION 'action_type es requerido';
    END IF;

    UPDATE public.security_rate_limits
    SET 
        attempt_count = 0,
        blocked_until = NULL,
        updated_at = now()
    WHERE identifier = reset_identifier
    AND action_type = reset_action_type;
END;
$function$;

-- 3. Actualizar función log_security_event con search_path
CREATE OR REPLACE FUNCTION public.log_security_event(
  event_type text, 
  event_data jsonb DEFAULT '{}'::jsonb, 
  target_user_id uuid DEFAULT NULL::uuid
)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = 'public'
AS $function$
BEGIN
    -- Validar event_type
    IF event_type IS NULL OR trim(event_type) = '' THEN
        RAISE EXCEPTION 'event_type es requerido';
    END IF;

    INSERT INTO public.security_audit_log (
        event_type,
        user_id,
        event_data
    ) VALUES (
        event_type,
        COALESCE(target_user_id, auth.uid()),
        COALESCE(event_data, '{}'::jsonb)
    );
EXCEPTION
    WHEN OTHERS THEN
        -- No fallar si el log de seguridad tiene problemas
        RAISE WARNING 'Error logging security event: %', SQLERRM;
END;
$function$;

-- 4. Actualizar función verify_invitation con search_path
CREATE OR REPLACE FUNCTION public.verify_invitation(token text, email text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path = 'public'
AS $function$
    SELECT EXISTS (
        SELECT 1 FROM public.user_invitations
        WHERE invitation_token::text = trim($1)
        AND LOWER(TRIM(email)) = LOWER(TRIM($2))
        AND status = 'pending'
        AND expires_at > now()
    )
$function$;

-- 5. Actualizar función cleanup_expired_invitations con search_path
CREATE OR REPLACE FUNCTION public.cleanup_expired_invitations()
 RETURNS void
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path = 'public'
AS $function$
    UPDATE public.user_invitations
    SET status = 'expired'
    WHERE status = 'pending' AND expires_at < now();
$function$;

-- 6. Actualizar función handle_new_user con search_path
CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = 'public'
AS $function$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (
    new.id,
    new.email,
    COALESCE(new.raw_user_meta_data ->> 'full_name', new.email)
  );
  
  RETURN new;
EXCEPTION
  WHEN OTHERS THEN
    -- Log el error pero no fallar el registro del usuario
    RAISE WARNING 'Error creating profile for user %: %', new.id, SQLERRM;
    RETURN new;
END;
$function$;

-- 7. Actualizar función update_updated_at_column con search_path
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = 'public'
AS $function$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$function$;

-- 8. Actualizar función update_inventory_stock_timestamp con search_path
CREATE OR REPLACE FUNCTION public.update_inventory_stock_timestamp()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = 'public'
AS $function$
BEGIN
    NEW.last_updated = now();
    RETURN NEW;
END;
$function$;

-- 9. Actualizar función update_cleaners_order con search_path
CREATE OR REPLACE FUNCTION public.update_cleaners_order(cleaner_updates jsonb[])
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = 'public'
AS $function$
DECLARE
    update_item JSONB;
BEGIN
    -- Validar que el usuario esté autenticado
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Usuario no autenticado';
    END IF;

    -- Validar que el usuario tenga permisos
    IF NOT EXISTS (
        SELECT 1 FROM public.user_roles 
        WHERE user_id = auth.uid() 
        AND role IN ('admin', 'manager')
    ) THEN
        RAISE EXCEPTION 'No tienes permisos para actualizar el orden de cleaners';
    END IF;

    FOREACH update_item IN ARRAY cleaner_updates
    LOOP
        UPDATE public.cleaners 
        SET sort_order = (update_item->>'sortOrder')::INTEGER
        WHERE id = (update_item->>'id')::UUID;
    END LOOP;
END;
$function$;

-- 10. Actualizar función process_automatic_inventory_consumption con search_path
CREATE OR REPLACE FUNCTION public.process_automatic_inventory_consumption(
  task_id_param uuid, 
  property_id_param uuid, 
  user_id_param uuid
)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = 'public'
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
  
  -- Validar que el usuario esté autenticado y tenga permisos
  IF NOT EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = user_id_param 
    AND role IN ('admin', 'manager', 'supervisor', 'cleaner')
  ) THEN
    RAISE EXCEPTION 'Usuario no autorizado para procesar consumo de inventario';
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
EXCEPTION
  WHEN OTHERS THEN
    -- Log el error pero permitir que la tarea continúe
    PERFORM public.log_security_event('inventory_consumption_error', jsonb_build_object(
      'error', SQLERRM,
      'task_id', task_id_param,
      'property_id', property_id_param
    ), user_id_param);
    RAISE WARNING 'Error en consumo automático de inventario: %', SQLERRM;
END;
$function$;