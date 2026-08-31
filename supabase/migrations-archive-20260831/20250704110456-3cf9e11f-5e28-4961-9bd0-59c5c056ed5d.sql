-- Eliminar completamente al usuario grupolimpatex@gmail.com
-- 1. Eliminar de user_roles si existe
DELETE FROM public.user_roles WHERE user_id = '8050a127-c9fd-4b22-9eb6-76001cdbca79';

-- 2. Eliminar de cleaners si existe  
DELETE FROM public.cleaners WHERE user_id = '8050a127-c9fd-4b22-9eb6-76001cdbca79';

-- 3. Eliminar de profiles (se debe hacer antes de auth.users)
DELETE FROM public.profiles WHERE id = '8050a127-c9fd-4b22-9eb6-76001cdbca79';

-- 4. Eliminar de auth.users (esto requiere privilegios especiales)
DELETE FROM auth.users WHERE id = '8050a127-c9fd-4b22-9eb6-76001cdbca79';