-- Limpiar referencias de reservas canceladas específicas
UPDATE hostaway_reservations 
SET task_id = NULL 
WHERE hostaway_reservation_id IN (258492, 309662)
  AND task_id IS NOT NULL;

-- Eliminar tareas creadas para estas reservas canceladas
DELETE FROM tasks 
WHERE id IN (
  SELECT t.id 
  FROM tasks t
  LEFT JOIN hostaway_reservations hr ON hr.task_id = t.id
  WHERE hr.task_id IS NULL
    AND t.date = '2025-07-09'
    AND t.property IN ('Blue Ocean Apartment', 'Central Hideaway Penthouse')
);

-- Limpiar todas las demás tareas de reservas con status inválidos
UPDATE hostaway_reservations 
SET task_id = NULL 
WHERE status IN ('cancelled', 'inquiry', 'declined', 'expired')
  AND task_id IS NOT NULL;

-- Eliminar tareas huérfanas de reservas con status inválidos
DELETE FROM tasks 
WHERE id IN (
  SELECT t.id 
  FROM tasks t
  LEFT JOIN hostaway_reservations hr ON hr.task_id = t.id
  WHERE hr.task_id IS NULL
    AND t.date >= CURRENT_DATE
);