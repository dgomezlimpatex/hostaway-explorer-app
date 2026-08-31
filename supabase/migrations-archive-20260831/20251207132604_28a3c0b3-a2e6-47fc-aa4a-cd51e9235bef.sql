-- Desactivar todas las sincronizaciones automáticas de Hostaway
UPDATE public.hostaway_sync_schedules 
SET is_active = false, updated_at = now() 
WHERE is_active = true;