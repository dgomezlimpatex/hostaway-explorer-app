-- Limpiar tareas duplicadas existentes - VERSIÓN CORREGIDA
-- Paso 1: Identificar tareas a eliminar (las de menor prioridad en duplicados)

WITH duplicated_tasks AS (
  -- Encontrar tareas que están duplicadas (misma propiedad y fecha)
  SELECT 
    t1.id as task_id,
    t1.property,
    t1.date,
    hr1.hostaway_reservation_id,
    hr1.status,
    t1.cleaner_id,
    t1.created_at,
    CASE WHEN hr1.status IN ('cancelled', 'inquiry', 'declined', 'expired') 
         THEN 1 ELSE 0 END as is_invalid_status,
    COUNT(*) OVER (PARTITION BY t1.property, t1.date) as task_count
  FROM tasks t1
  LEFT JOIN hostaway_reservations hr1 ON hr1.task_id = t1.id
  WHERE t1.date >= '2025-07-09'
),
tasks_to_remove AS (
  -- En grupos con múltiples tareas, marcar las de menor prioridad para eliminar
  SELECT 
    task_id,
    property,
    date,
    hostaway_reservation_id,
    status,
    ROW_NUMBER() OVER (
      PARTITION BY property, date 
      ORDER BY 
        is_invalid_status ASC,  -- Válidas primero (0 antes que 1)
        CASE WHEN cleaner_id IS NOT NULL THEN 0 ELSE 1 END,  -- Asignadas primero
        created_at ASC  -- Más antiguas primero
    ) as priority_rank
  FROM duplicated_tasks
  WHERE task_count > 1
)
-- Paso 2: PRIMERO limpiar las referencias en hostaway_reservations
UPDATE hostaway_reservations 
SET task_id = NULL 
WHERE task_id IN (
  SELECT task_id 
  FROM tasks_to_remove 
  WHERE priority_rank > 1
);

-- Paso 3: DESPUÉS eliminar las tareas sin referencias
WITH duplicated_tasks AS (
  SELECT 
    t1.id as task_id,
    t1.property,
    t1.date,
    hr1.hostaway_reservation_id,
    hr1.status,
    t1.cleaner_id,
    t1.created_at,
    CASE WHEN hr1.status IN ('cancelled', 'inquiry', 'declined', 'expired') 
         THEN 1 ELSE 0 END as is_invalid_status,
    COUNT(*) OVER (PARTITION BY t1.property, t1.date) as task_count
  FROM tasks t1
  LEFT JOIN hostaway_reservations hr1 ON hr1.task_id = t1.id
  WHERE t1.date >= '2025-07-09'
),
tasks_to_remove AS (
  SELECT 
    task_id,
    ROW_NUMBER() OVER (
      PARTITION BY property, date 
      ORDER BY 
        is_invalid_status ASC,
        CASE WHEN cleaner_id IS NOT NULL THEN 0 ELSE 1 END,
        created_at ASC
    ) as priority_rank
  FROM duplicated_tasks
  WHERE task_count > 1
)
DELETE FROM tasks 
WHERE id IN (
  SELECT task_id 
  FROM tasks_to_remove 
  WHERE priority_rank > 1
);