-- Corregir la reserva 44365218 que está cancelada pero no se refleja en BD

-- 1. Eliminar la tarea incorrecta asociada
DELETE FROM task_assignments WHERE task_id = '31427ac5-5afc-41cd-a6b8-0e479d151bb9';
DELETE FROM task_reports WHERE task_id = '31427ac5-5afc-41cd-a6b8-0e479d151bb9';
DELETE FROM tasks WHERE id = '31427ac5-5afc-41cd-a6b8-0e479d151bb9';

-- 2. Actualizar la reserva para reflejar su verdadero estado cancelado
UPDATE hostaway_reservations 
SET 
  task_id = NULL,
  cancellation_date = '2025-07-09',  -- Según los datos del usuario
  status = 'cancelled'
WHERE hostaway_reservation_id = 44365218;

-- 3. Verificar el resultado
SELECT 
  hostaway_reservation_id,
  property_id,
  arrival_date,
  departure_date,
  cancellation_date,
  status,
  task_id
FROM hostaway_reservations 
WHERE hostaway_reservation_id = 44365218;