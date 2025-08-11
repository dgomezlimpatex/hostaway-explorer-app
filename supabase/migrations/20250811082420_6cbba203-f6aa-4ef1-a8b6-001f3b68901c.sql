-- Agregar campo para almacenar resumen de productos por propiedad
ALTER TABLE logistics_picklist_items 
ADD COLUMN products_summary JSONB DEFAULT '[]'::jsonb;

-- Agregar campo para indicar si es una línea consolidada por propiedad
ALTER TABLE logistics_picklist_items 
ADD COLUMN is_property_package BOOLEAN DEFAULT false;

-- Crear índice para mejorar consultas
CREATE INDEX idx_logistics_picklist_items_property_package 
ON logistics_picklist_items(picklist_id, property_id, is_property_package);