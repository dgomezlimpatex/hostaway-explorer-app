-- Corregir el registro de Katerine completando el proceso de invitación

-- 1. Marcar la invitación como aceptada
UPDATE user_invitations 
SET status = 'accepted', 
    accepted_at = now()
WHERE email = 'katerine.12samboni@gmail.com' 
  AND status = 'pending';

-- 2. Asignar el rol de cleaner
INSERT INTO user_roles (user_id, role)
VALUES ('e42288f5-9407-4be2-a093-7709dd699075', 'cleaner')
ON CONFLICT (user_id, role) DO NOTHING;

-- 3. Crear el registro en cleaners
INSERT INTO cleaners (user_id, name, email, is_active)
VALUES (
    'e42288f5-9407-4be2-a093-7709dd699075', 
    '259803kjk.A', 
    'katerine.12samboni@gmail.com', 
    true
)
ON CONFLICT (user_id) DO UPDATE SET
    name = EXCLUDED.name,
    email = EXCLUDED.email,
    is_active = true,
    updated_at = now();

-- Verificar que todo está correcto
SELECT 
    'Katerine registrada correctamente como limpiadora' as resultado;