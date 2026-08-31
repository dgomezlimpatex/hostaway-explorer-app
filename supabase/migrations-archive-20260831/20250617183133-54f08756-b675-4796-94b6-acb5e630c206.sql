
-- Actualizar el constraint de tipo_servicio para incluir todos los valores permitidos
ALTER TABLE public.clients DROP CONSTRAINT IF EXISTS clients_tipo_servicio_check;

ALTER TABLE public.clients ADD CONSTRAINT clients_tipo_servicio_check 
CHECK (tipo_servicio IN (
    'limpieza-mantenimiento',
    'mantenimiento-cristaleria', 
    'mantenimiento-airbnb',
    'limpieza-puesta-punto',
    'limpieza-final-obra',
    'check-in',
    'desplazamiento',
    'limpieza-especial',
    'trabajo-extraordinario'
));
