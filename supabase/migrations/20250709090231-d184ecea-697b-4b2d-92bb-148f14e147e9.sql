-- Eliminar tareas creadas para reservas con status inválidos
DELETE FROM tasks 
WHERE id IN (
  SELECT t.id 
  FROM tasks t
  JOIN hostaway_reservations hr ON hr.task_id = t.id
  WHERE hr.status IN ('cancelled', 'inquiry', 'declined', 'expired')
    AND t.date >= CURRENT_DATE
);

-- Limpiar referencias en hostaway_reservations
UPDATE hostaway_reservations 
SET task_id = NULL 
WHERE status IN ('cancelled', 'inquiry', 'declined', 'expired')
  AND task_id IS NOT NULL;