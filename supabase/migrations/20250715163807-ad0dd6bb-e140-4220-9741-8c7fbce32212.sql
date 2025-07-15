-- LIMPIEZA DEFINITIVA - Eliminar todas las tareas incorrectas
-- Primero eliminar TODAS las referencias y tareas

-- 1. Eliminar todas las asignaciones de tareas
DELETE FROM task_assignments;

-- 2. Eliminar todos los reportes y medios
DELETE FROM task_media;
DELETE FROM task_reports;

-- 3. Limpiar referencias en hostaway_reservations
UPDATE hostaway_reservations SET task_id = NULL WHERE task_id IS NOT NULL;

-- 4. Eliminar TODAS las tareas sin excepción
DELETE FROM tasks;

-- 5. Limpiar logs para empezar desde cero
DELETE FROM hostaway_sync_logs;
DELETE FROM auto_assignment_logs;

-- 6. Verificación final - no debe quedar nada
DO $$
DECLARE
    tasks_count INTEGER;
    assignments_count INTEGER;
    reports_count INTEGER;
    reservations_with_task INTEGER;
BEGIN
    SELECT COUNT(*) INTO tasks_count FROM tasks;
    SELECT COUNT(*) INTO assignments_count FROM task_assignments;
    SELECT COUNT(*) INTO reports_count FROM task_reports;
    SELECT COUNT(*) INTO reservations_with_task FROM hostaway_reservations WHERE task_id IS NOT NULL;
    
    RAISE NOTICE '🧹 LIMPIEZA DEFINITIVA COMPLETADA:';
    RAISE NOTICE '   - Tareas: % (debe ser 0)', tasks_count;
    RAISE NOTICE '   - Asignaciones: % (debe ser 0)', assignments_count;
    RAISE NOTICE '   - Reportes: % (debe ser 0)', reports_count;
    RAISE NOTICE '   - Reservas con task_id: % (debe ser 0)', reservations_with_task;
    
    IF tasks_count = 0 AND assignments_count = 0 AND reports_count = 0 AND reservations_with_task = 0 THEN
        RAISE NOTICE '✅ SISTEMA COMPLETAMENTE LIMPIO - LISTO PARA SINCRONIZACIÓN';
    ELSE
        RAISE NOTICE '❌ QUEDAN DATOS - REVISAR MANUALMENTE';
    END IF;
END $$;