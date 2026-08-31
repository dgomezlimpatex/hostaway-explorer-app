-- Actualizar la configuración de días de recogida para el nuevo esquema
-- Lunes: recoge del lunes (mismo día)
UPDATE laundry_delivery_schedule 
SET collection_days = ARRAY[1], updated_at = now()
WHERE day_of_week = 1;

-- Miércoles: recoge de martes y miércoles
UPDATE laundry_delivery_schedule 
SET collection_days = ARRAY[2, 3], updated_at = now()
WHERE day_of_week = 3;

-- Viernes: recoge de jueves y viernes
UPDATE laundry_delivery_schedule 
SET collection_days = ARRAY[4, 5], updated_at = now()
WHERE day_of_week = 5;

-- Domingo: recoge de sábado y domingo
UPDATE laundry_delivery_schedule 
SET collection_days = ARRAY[6, 0], updated_at = now()
WHERE day_of_week = 0;