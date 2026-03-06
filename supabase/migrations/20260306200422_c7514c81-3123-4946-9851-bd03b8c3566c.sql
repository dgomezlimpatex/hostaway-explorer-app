-- Step 1: Drop old constraint
ALTER TABLE clients DROP CONSTRAINT IF EXISTS clients_tipo_servicio_check;

-- Step 2: Update data while no constraint exists
UPDATE clients SET tipo_servicio = 'limpieza-turistica' WHERE tipo_servicio = 'mantenimiento-airbnb';

-- Step 3: Add new constraint
ALTER TABLE clients ADD CONSTRAINT clients_tipo_servicio_check CHECK (tipo_servicio = ANY (ARRAY['limpieza-mantenimiento'::text, 'mantenimiento-cristaleria'::text, 'limpieza-turistica'::text, 'limpieza-puesta-punto'::text, 'limpieza-final-obra'::text, 'check-in'::text, 'desplazamiento'::text, 'limpieza-especial'::text, 'trabajo-extraordinario'::text]));

-- Step 4: Update tasks
UPDATE tasks SET type = 'limpieza-turistica' WHERE type = 'mantenimiento-airbnb';
