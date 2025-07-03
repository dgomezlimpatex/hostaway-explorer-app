-- Eliminar las restricciones de clave foránea existentes que referencian cleaners
ALTER TABLE auto_assignment_logs DROP CONSTRAINT IF EXISTS auto_assignment_logs_assigned_cleaner_id_fkey;
ALTER TABLE cleaner_group_assignments DROP CONSTRAINT IF EXISTS cleaner_group_assignments_cleaner_id_fkey;
ALTER TABLE cleaner_availability DROP CONSTRAINT IF EXISTS cleaner_availability_cleaner_id_fkey;
ALTER TABLE assignment_patterns DROP CONSTRAINT IF EXISTS assignment_patterns_cleaner_id_fkey;

-- Recrear las restricciones con CASCADE DELETE para permitir eliminación
ALTER TABLE auto_assignment_logs 
ADD CONSTRAINT auto_assignment_logs_assigned_cleaner_id_fkey 
FOREIGN KEY (assigned_cleaner_id) REFERENCES cleaners(id) ON DELETE CASCADE;

ALTER TABLE cleaner_group_assignments 
ADD CONSTRAINT cleaner_group_assignments_cleaner_id_fkey 
FOREIGN KEY (cleaner_id) REFERENCES cleaners(id) ON DELETE CASCADE;

ALTER TABLE cleaner_availability 
ADD CONSTRAINT cleaner_availability_cleaner_id_fkey 
FOREIGN KEY (cleaner_id) REFERENCES cleaners(id) ON DELETE CASCADE;

ALTER TABLE assignment_patterns 
ADD CONSTRAINT assignment_patterns_cleaner_id_fkey 
FOREIGN KEY (cleaner_id) REFERENCES cleaners(id) ON DELETE CASCADE;

-- Para las tablas tasks, recurring_tasks y task_reports, establecer cleaner_id a NULL en lugar de eliminar
-- Esto preserva el historial de tareas pero elimina la referencia al trabajador eliminado
ALTER TABLE tasks DROP CONSTRAINT IF EXISTS tasks_cleaner_id_fkey;
ALTER TABLE tasks 
ADD CONSTRAINT tasks_cleaner_id_fkey 
FOREIGN KEY (cleaner_id) REFERENCES cleaners(id) ON DELETE SET NULL;

ALTER TABLE recurring_tasks DROP CONSTRAINT IF EXISTS recurring_tasks_cleaner_id_fkey;
ALTER TABLE recurring_tasks 
ADD CONSTRAINT recurring_tasks_cleaner_id_fkey 
FOREIGN KEY (cleaner_id) REFERENCES cleaners(id) ON DELETE SET NULL;

ALTER TABLE task_reports DROP CONSTRAINT IF EXISTS task_reports_cleaner_id_fkey;
ALTER TABLE task_reports 
ADD CONSTRAINT task_reports_cleaner_id_fkey 
FOREIGN KEY (cleaner_id) REFERENCES cleaners(id) ON DELETE SET NULL;