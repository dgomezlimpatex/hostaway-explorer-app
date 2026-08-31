-- Asignar rol de admin al usuario actual si no existe
INSERT INTO public.user_roles (user_id, role)
SELECT '4e13cf15-9e1e-4b0a-a20d-c9037f3a4bd8', 'admin'::app_role
WHERE NOT EXISTS (
  SELECT 1 FROM public.user_roles 
  WHERE user_id = '4e13cf15-9e1e-4b0a-a20d-c9037f3a4bd8'
  AND role = 'admin'
);

-- Verificar que el perfil existe
INSERT INTO public.profiles (id, email, full_name)
SELECT '4e13cf15-9e1e-4b0a-a20d-c9037f3a4bd8', 
       (SELECT email FROM auth.users WHERE id = '4e13cf15-9e1e-4b0a-a20d-c9037f3a4bd8'),
       'Administrador Principal'
WHERE NOT EXISTS (
  SELECT 1 FROM public.profiles WHERE id = '4e13cf15-9e1e-4b0a-a20d-c9037f3a4bd8'
);