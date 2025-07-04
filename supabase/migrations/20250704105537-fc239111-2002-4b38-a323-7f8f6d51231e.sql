-- Arreglar el usuario específico que ya existe pero no tiene rol
INSERT INTO public.user_roles (user_id, role)
VALUES ('8050a127-c9fd-4b22-9eb6-76001cdbca79', 'cleaner')
ON CONFLICT (user_id, role) DO NOTHING;

-- Crear el registro en cleaners para este usuario
INSERT INTO public.cleaners (user_id, name, email, is_active)
VALUES ('8050a127-c9fd-4b22-9eb6-76001cdbca79', 'Dan García', 'grupolimpatex@gmail.com', true)
ON CONFLICT (user_id) DO UPDATE SET
    name = EXCLUDED.name,
    email = EXCLUDED.email,
    is_active = true,
    updated_at = now();

-- Marcar la invitación pendiente como aceptada
UPDATE public.user_invitations
SET status = 'accepted', accepted_at = now()
WHERE invitation_token = '9feab412-297c-4870-b8eb-9c52f13ad817' AND status = 'pending';