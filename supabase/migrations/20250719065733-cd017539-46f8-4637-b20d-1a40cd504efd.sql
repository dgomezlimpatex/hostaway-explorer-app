-- Crear tabla para mapear amenities de propiedades a productos de inventario
CREATE TABLE public.property_amenity_inventory_mapping (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  amenity_field TEXT NOT NULL, -- e.g., 'numero_sabanas', 'numero_toallas_grandes'
  product_id UUID NOT NULL REFERENCES public.inventory_products(id),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.property_amenity_inventory_mapping ENABLE ROW LEVEL SECURITY;

-- Políticas RLS
CREATE POLICY "Admin y managers pueden gestionar mapeo de amenities" 
ON public.property_amenity_inventory_mapping 
FOR ALL 
USING (EXISTS (
  SELECT 1 FROM user_roles ur 
  WHERE ur.user_id = auth.uid() 
  AND ur.role IN ('admin', 'manager')
));

CREATE POLICY "Supervisores pueden ver mapeo de amenities" 
ON public.property_amenity_inventory_mapping 
FOR SELECT 
USING (EXISTS (
  SELECT 1 FROM user_roles ur 
  WHERE ur.user_id = auth.uid() 
  AND ur.role = 'supervisor'
));

-- Trigger para actualizar updated_at
CREATE TRIGGER update_property_amenity_inventory_mapping_updated_at
BEFORE UPDATE ON public.property_amenity_inventory_mapping
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Función para procesar consumo automático de inventario al completar tarea
CREATE OR REPLACE FUNCTION public.process_automatic_inventory_consumption(
  task_id_param UUID,
  property_id_param UUID,
  user_id_param UUID
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  property_data RECORD;
  mapping_record RECORD;
  amenity_quantity INTEGER;
  current_stock_record RECORD;
  movement_reason TEXT;
BEGIN
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
$$;