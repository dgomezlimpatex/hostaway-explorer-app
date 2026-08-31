-- Backfill registros antiguos sin actor: marcarlos como histórico previo a la auditoría
UPDATE public.client_reservation_logs
SET 
  actor_type = 'system',
  actor_name = 'Registro histórico (previo a auditoría)'
WHERE actor_type IS NULL
  AND actor_name IS NULL;