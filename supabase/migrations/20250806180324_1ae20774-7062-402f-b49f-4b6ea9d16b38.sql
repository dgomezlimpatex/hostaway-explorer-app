-- Añadir nuevos campos a la tabla properties
ALTER TABLE public.properties 
ADD COLUMN numero_camas_pequenas integer NOT NULL DEFAULT 0,
ADD COLUMN numero_sofas_cama integer NOT NULL DEFAULT 0,
ADD COLUMN numero_sabanas_pequenas integer NOT NULL DEFAULT 0,
ADD COLUMN cantidad_rollos_papel_higienico integer NOT NULL DEFAULT 0,
ADD COLUMN cantidad_rollos_papel_cocina integer NOT NULL DEFAULT 0;