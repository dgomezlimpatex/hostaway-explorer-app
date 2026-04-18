-- Limpiar log de seguridad referenciando al usuario huérfano
DELETE FROM public.security_audit_log 
WHERE user_id = '760ed9ce-2f09-465d-a88e-4f3f44d0af22';

-- Quitar referencia user_id del cleaner (mantener registro para histórico)
UPDATE public.cleaners 
SET user_id = NULL 
WHERE user_id = '760ed9ce-2f09-465d-a88e-4f3f44d0af22';

-- Borrar rol
DELETE FROM public.user_roles 
WHERE user_id = '760ed9ce-2f09-465d-a88e-4f3f44d0af22';

-- Borrar acceso a sedes
DELETE FROM public.user_sede_access 
WHERE user_id = '760ed9ce-2f09-465d-a88e-4f3f44d0af22';

-- Borrar profile
DELETE FROM public.profiles 
WHERE id = '760ed9ce-2f09-465d-a88e-4f3f44d0af22';

-- Borrar usuario auth (libera el email)
DELETE FROM auth.users 
WHERE id = '760ed9ce-2f09-465d-a88e-4f3f44d0af22';