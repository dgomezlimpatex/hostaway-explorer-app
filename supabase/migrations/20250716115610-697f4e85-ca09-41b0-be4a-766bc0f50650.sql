-- ELIMINACIÓN COMPLETA DE TODAS LAS TAREAS
-- Paso 1: Eliminar todas las asignaciones de tareas
DELETE FROM task_assignments;

-- Paso 2: Eliminar todos los reportes y medios asociados
DELETE FROM task_media;
DELETE FROM task_reports;

-- Paso 3: Limpiar todas las referencias task_id en hostaway_reservations
UPDATE hostaway_reservations SET task_id = NULL WHERE task_id IS NOT NULL;

-- Paso 4: Eliminar TODAS las tareas
DELETE FROM tasks;

-- Paso 5: Limpiar logs para empezar limpio
DELETE FROM hostaway_sync_logs;
DELETE FROM auto_assignment_logs;

-- Verificación final
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
    
    RAISE NOTICE '🧹 ELIMINACIÓN COMPLETA FINALIZADA:';
    RAISE NOTICE '   - Tareas: % (debe ser 0)', tasks_count;
    RAISE NOTICE '   - Asignaciones: % (debe ser 0)', assignments_count;
    RAISE NOTICE '   - Reportes: % (debe ser 0)', reports_count;
    RAISE NOTICE '   - Reservas con task_id: % (debe ser 0)', reservations_with_task;
    RAISE NOTICE '✅ BASE DE DATOS LIMPIA - LISTA PARA NUEVA SINCRONIZACIÓN';
END $$;