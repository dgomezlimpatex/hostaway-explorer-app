-- Asignar rol de admin al usuario creador de la aplicación
INSERT INTO public.user_roles (user_id, role)
VALUES ('4e13cf15-9e1e-4b0a-a20d-c9037f3a4bd8', 'admin')
ON CONFLICT (user_id, role) DO NOTHING;