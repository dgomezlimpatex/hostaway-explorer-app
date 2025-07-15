-- Limpiar todas las tareas y referencias para prueba de sincronización
-- PASO 1: Limpiar referencias en hostaway_reservations
UPDATE hostaway_reservations 
SET task_id = NULL 
WHERE task_id IS NOT NULL;

-- PASO 2: Limpiar task_assignments
DELETE FROM task_assignments;

-- PASO 3: Limpiar task_reports y su media asociada
DELETE FROM task_media;
DELETE FROM task_reports;

-- PASO 4: Limpiar todas las tareas
DELETE FROM tasks;

-- PASO 5: Limpiar logs de sincronización para empezar limpio
DELETE FROM hostaway_sync_logs;

-- PASO 6: Limpiar logs de auto-asignación
DELETE FROM auto_assignment_logs;

-- Mostrar resumen de limpieza
DO $$
DECLARE
    reservations_count INTEGER;
    tasks_count INTEGER;
    assignments_count INTEGER;
    reports_count INTEGER;
BEGIN
    -- Contar lo que queda
    SELECT COUNT(*) INTO reservations_count FROM hostaway_reservations WHERE task_id IS NOT NULL;
    SELECT COUNT(*) INTO tasks_count FROM tasks;
    SELECT COUNT(*) INTO assignments_count FROM task_assignments;
    SELECT COUNT(*) INTO reports_count FROM task_reports;
    
    RAISE NOTICE '🧹 LIMPIEZA COMPLETADA:';
    RAISE NOTICE '   - Reservas con task_id: %', reservations_count;
    RAISE NOTICE '   - Tareas restantes: %', tasks_count;
    RAISE NOTICE '   - Asignaciones restantes: %', assignments_count;
    RAISE NOTICE '   - Reportes restantes: %', reports_count;
    RAISE NOTICE '✅ Sistema listo para nueva sincronización';
END $$;