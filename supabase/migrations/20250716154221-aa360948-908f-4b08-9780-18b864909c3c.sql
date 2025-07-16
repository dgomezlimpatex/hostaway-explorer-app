-- ELIMINAR TAREAS INCORRECTAS DE RESERVAS CANCELADAS
-- Problema: Se están creando tareas para reservas con status 'cancelled' o cancellation_date

-- Primero, identificar todas las tareas asociadas a reservas canceladas
DO $$
DECLARE
    task_count INTEGER;
BEGIN
    -- Contar tareas de reservas canceladas
    SELECT COUNT(*) INTO task_count
    FROM tasks t
    JOIN hostaway_reservations hr ON t.id = hr.task_id
    WHERE hr.status = 'cancelled' OR hr.cancellation_date IS NOT NULL;
    
    RAISE NOTICE '🔍 TAREAS INCORRECTAS ENCONTRADAS: % tareas asociadas a reservas canceladas', task_count;
END $$;

-- Eliminar tareas asociadas a reservas canceladas
DELETE FROM tasks 
WHERE id IN (
    SELECT t.id
    FROM tasks t
    JOIN hostaway_reservations hr ON t.id = hr.task_id
    WHERE hr.status = 'cancelled' OR hr.cancellation_date IS NOT NULL
);

-- Limpiar el task_id de las reservas canceladas
UPDATE hostaway_reservations 
SET task_id = NULL 
WHERE status = 'cancelled' OR cancellation_date IS NOT NULL;

-- Verificación final
DO $$
DECLARE
    remaining_tasks INTEGER;
    cancelled_reservations_with_tasks INTEGER;
BEGIN
    -- Verificar que no quedan tareas de reservas canceladas
    SELECT COUNT(*) INTO remaining_tasks
    FROM tasks t
    JOIN hostaway_reservations hr ON t.id = hr.task_id
    WHERE hr.status = 'cancelled' OR hr.cancellation_date IS NOT NULL;
    
    -- Verificar reservas canceladas con task_id
    SELECT COUNT(*) INTO cancelled_reservations_with_tasks
    FROM hostaway_reservations
    WHERE (status = 'cancelled' OR cancellation_date IS NOT NULL) 
    AND task_id IS NOT NULL;
    
    RAISE NOTICE '✅ LIMPIEZA COMPLETADA:';
    RAISE NOTICE '   - Tareas restantes de reservas canceladas: % (debe ser 0)', remaining_tasks;
    RAISE NOTICE '   - Reservas canceladas con task_id: % (debe ser 0)', cancelled_reservations_with_tasks;
    
    IF remaining_tasks > 0 OR cancelled_reservations_with_tasks > 0 THEN
        RAISE EXCEPTION 'ERROR: Aún quedan tareas o referencias incorrectas';
    END IF;
END $$;