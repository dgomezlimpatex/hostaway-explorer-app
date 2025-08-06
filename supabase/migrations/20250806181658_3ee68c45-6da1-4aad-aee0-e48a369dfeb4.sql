-- Añadir campos de suite a la tabla properties
ALTER TABLE public.properties 
ADD COLUMN numero_camas_suite integer NOT NULL DEFAULT 0,
ADD COLUMN numero_sabanas_suite integer NOT NULL DEFAULT 0;