-- Primero, desconectar las referencias de las reservas a las tareas futuras
UPDATE hostaway_reservations 
SET task_id = NULL 
WHERE task_id IN (
  SELECT id FROM tasks WHERE date >= CURRENT_DATE
);

-- Luego, eliminar todas las tareas desde hoy en adelante
DELETE FROM tasks 
WHERE date >= CURRENT_DATE;