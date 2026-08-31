-- Fase 1: Índices de optimización para acelerar búsquedas frecuentes

-- Índice para búsquedas frecuentes del calendario (fecha + sede + estado)
CREATE INDEX IF NOT EXISTS idx_tasks_date_sede_status 
ON tasks(date, sede_id, status);

-- Índice para verificación de roles de usuario (acelera cada petición RLS)
CREATE INDEX IF NOT EXISTS idx_user_roles_user_role 
ON user_roles(user_id, role);

-- Índice para acceso a sedes (mejora filtrado multi-sede)
CREATE INDEX IF NOT EXISTS idx_user_sede_access_composite 
ON user_sede_access(user_id, sede_id, can_access);

-- Índice para fotos de tareas (columna correcta: task_report_id)
CREATE INDEX IF NOT EXISTS idx_task_media_task_report_id 
ON task_media(task_report_id);

-- Índice adicional para ordenación por fecha en tareas
CREATE INDEX IF NOT EXISTS idx_tasks_date_start_time 
ON tasks(date, start_time);