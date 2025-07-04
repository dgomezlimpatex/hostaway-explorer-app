-- Agregar constraint único en user_id para la tabla cleaners
ALTER TABLE public.cleaners ADD CONSTRAINT cleaners_user_id_unique UNIQUE (user_id);

-- Asignar manualmente el rol y crear el registro de cleaner para el usuario existente
INSERT INTO public.user_roles (user_id, role)
VALUES ('8050a127-c9fd-4b22-9eb6-76001cdbca79', 'cleaner')
ON CONFLICT (user_id, role) DO NOTHING;

-- Crear el registro en cleaners
INSERT INTO public.cleaners (user_id, name, email, is_active)
VALUES ('8050a127-c9fd-4b22-9eb6-76001cdbca79', 'Dan García', 'grupolimpatex@gmail.com', true)
ON CONFLICT (user_id) DO UPDATE SET
    name = EXCLUDED.name,
    email = EXCLUDED.email,
    is_active = true,
    updated_at = now();

-- Marcar la invitación como aceptada
UPDATE public.user_invitations
SET status = 'accepted', accepted_at = now()
WHERE invitation_token = 'f8915e24-f1bb-4798-b813-ab3c22a86096';