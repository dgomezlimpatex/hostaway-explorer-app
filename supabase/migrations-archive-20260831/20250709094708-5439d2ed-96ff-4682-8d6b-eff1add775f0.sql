-- Corregir la reserva 43176599 que debería estar cancelada
-- Actualizar el estado de la reserva a cancelado
UPDATE hostaway_reservations 
SET status = 'cancelled', 
    cancellation_date = CURRENT_DATE,
    task_id = NULL
WHERE hostaway_reservation_id = 43176599;

-- Eliminar la tarea asociada
DELETE FROM tasks 
WHERE id = '278dafcc-7e96-4aba-b75d-bedee7131708';

-- Mostrar confirmación
SELECT 
    'Reserva 43176599 actualizada a cancelled y tarea eliminada' as resultado;