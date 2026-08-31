-- Actualizar reservas específicas que deberían estar canceladas
UPDATE hostaway_reservations 
SET status = 'cancelled', task_id = NULL
WHERE hostaway_reservation_id IN (44589748, 44215713);

-- Eliminar las tareas asociadas a estas reservas canceladas
DELETE FROM tasks 
WHERE id IN (
  SELECT t.id 
  FROM tasks t
  WHERE t.id IN ('15240c92-c211-4115-a5ac-63a42a52ea49', '9f831184-72e0-44c9-90fc-4f8a10917370')
);