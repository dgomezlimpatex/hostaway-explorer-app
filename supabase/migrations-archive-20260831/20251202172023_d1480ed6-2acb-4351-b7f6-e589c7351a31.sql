-- Eliminar la restricción única del campo codigo para permitir duplicados y valores vacíos
ALTER TABLE public.properties DROP CONSTRAINT IF EXISTS properties_codigo_key;