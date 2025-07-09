-- Primero limpiar referencias en hostaway_reservations
UPDATE hostaway_reservations 
SET task_id = NULL 
WHERE status IN ('cancelled', 'inquiry', 'declined', 'expired')
  AND task_id IS NOT NULL;

-- Luego eliminar las tareas huérfanas creadas para reservas con status inválidos
DELETE FROM tasks 
WHERE id IN (
  SELECT t.id 
  FROM tasks t
  LEFT JOIN hostaway_reservations hr ON hr.task_id = t.id
  WHERE hr.task_id IS NULL
    AND t.date >= CURRENT_DATE
    AND t.created_at >= '2025-07-09 08:47:00'  -- Solo las creadas en la última sincronización
    AND t.property IN ('Ocean View Penthouse')  -- La propiedad específica que vimos
);