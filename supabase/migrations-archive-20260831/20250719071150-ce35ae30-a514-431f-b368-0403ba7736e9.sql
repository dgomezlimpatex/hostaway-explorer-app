-- Agregar campos para amenities de baño y cocina a la tabla properties
ALTER TABLE public.properties
ADD COLUMN amenities_bano INTEGER NOT NULL DEFAULT 0,
ADD COLUMN amenities_cocina INTEGER NOT NULL DEFAULT 0;