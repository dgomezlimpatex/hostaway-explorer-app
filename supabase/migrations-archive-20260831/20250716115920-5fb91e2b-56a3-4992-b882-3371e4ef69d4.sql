-- ELIMINACIÓN COMPLETA DE TODAS LAS RESERVAS DE HOSTAWAY
-- Eliminar todas las reservas
DELETE FROM hostaway_reservations;

-- Verificación final
DO $$
DECLARE
    reservations_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO reservations_count FROM hostaway_reservations;
    
    RAISE NOTICE '🧹 ELIMINACIÓN DE RESERVAS COMPLETADA:';
    RAISE NOTICE '   - Reservas de Hostaway: % (debe ser 0)', reservations_count;
    RAISE NOTICE '✅ BASE DE DATOS COMPLETAMENTE LIMPIA - EMPEZANDO DESDE CERO';
END $$;