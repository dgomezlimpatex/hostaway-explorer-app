
-- =====================================================
-- ELIMINACIÓN COMPLETA DE LAURA YANETH URIBE ARCILA
-- User ID: 951b635a-cf43-4dd8-8ae5-061ee949daf8
-- Cleaner ID: 8f67b412-3d94-4bda-ba1f-e0d60795646b
-- =====================================================

-- 1. Desasignar tareas (no borrarlas, solo quitar la asignación)
UPDATE tasks 
SET cleaner = NULL, cleaner_id = NULL 
WHERE cleaner_id = '8f67b412-3d94-4bda-ba1f-e0d60795646b';

-- 2. Eliminar task_assignments
DELETE FROM task_assignments 
WHERE cleaner_id = '8f67b412-3d94-4bda-ba1f-e0d60795646b';

-- 3. Eliminar cleaner_availability
DELETE FROM cleaner_availability 
WHERE cleaner_id = '8f67b412-3d94-4bda-ba1f-e0d60795646b';

-- 4. Eliminar cleaner_work_schedule
DELETE FROM cleaner_work_schedule 
WHERE cleaner_id = '8f67b412-3d94-4bda-ba1f-e0d60795646b';

-- 5. Eliminar invitaciones
DELETE FROM user_invitations 
WHERE email = 'laurauribe1930@gmail.com';

-- 6. Eliminar user_sede_access
DELETE FROM user_sede_access 
WHERE user_id = '951b635a-cf43-4dd8-8ae5-061ee949daf8';

-- 7. Eliminar security_audit_log
DELETE FROM security_audit_log 
WHERE user_id = '951b635a-cf43-4dd8-8ae5-061ee949daf8';

-- 8. Eliminar sede_audit_log
DELETE FROM sede_audit_log 
WHERE user_id = '951b635a-cf43-4dd8-8ae5-061ee949daf8';

-- 9. Eliminar el cleaner
DELETE FROM cleaners 
WHERE id = '8f67b412-3d94-4bda-ba1f-e0d60795646b';

-- 10. Eliminar user_roles
DELETE FROM user_roles 
WHERE user_id = '951b635a-cf43-4dd8-8ae5-061ee949daf8';

-- 11. Eliminar profile
DELETE FROM profiles 
WHERE id = '951b635a-cf43-4dd8-8ae5-061ee949daf8';
