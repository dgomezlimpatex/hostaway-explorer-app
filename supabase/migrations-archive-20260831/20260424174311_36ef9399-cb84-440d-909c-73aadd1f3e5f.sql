-- Forzar cierre de syncs Avantio colgados (el watchdog solo cierra los >30min;
-- bajamos el umbral puntualmente para liberar el bloqueo actual)
UPDATE public.avantio_sync_logs
SET 
  status = 'failed',
  sync_completed_at = now(),
  errors = COALESCE(errors, ARRAY[]::text[]) || ARRAY['Cerrado manualmente: sync bloqueando nuevas ejecuciones']
WHERE status = 'running';