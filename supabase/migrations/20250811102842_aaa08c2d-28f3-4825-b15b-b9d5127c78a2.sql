-- Crear productos de inventario que faltan basados en los campos de propiedades

-- Obtener primera categoría activa para asignar a los nuevos productos
DO $$
DECLARE
    default_category_id UUID;
BEGIN
    SELECT id INTO default_category_id FROM inventory_categories WHERE is_active = true LIMIT 1;
    
    -- Si no hay categorías, crear una por defecto
    IF default_category_id IS NULL THEN
        INSERT INTO inventory_categories (name, description, is_active, sort_order)
        VALUES ('Textiles y Amenities', 'Productos textiles y amenities para propiedades', true, 1)
        RETURNING id INTO default_category_id;
    END IF;
    
    -- Insertar productos que faltan solo si no existen
    IF NOT EXISTS (SELECT 1 FROM inventory_products WHERE name = 'Sábanas Pequeñas') THEN
        INSERT INTO inventory_products (name, description, category_id, unit_of_measure, is_active, sort_order)
        VALUES ('Sábanas Pequeñas', 'Sábanas para camas pequeñas/individuales', default_category_id, 'unidades', true, 2);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM inventory_products WHERE name = 'Sábanas Suite') THEN
        INSERT INTO inventory_products (name, description, category_id, unit_of_measure, is_active, sort_order)
        VALUES ('Sábanas Suite', 'Sábanas para suite/cama principal', default_category_id, 'unidades', true, 3);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM inventory_products WHERE name = 'Papel Higiénico') THEN
        INSERT INTO inventory_products (name, description, category_id, unit_of_measure, is_active, sort_order)
        VALUES ('Papel Higiénico', 'Rollos de papel higiénico', default_category_id, 'rollos', true, 8);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM inventory_products WHERE name = 'Papel Cocina') THEN
        INSERT INTO inventory_products (name, description, category_id, unit_of_measure, is_active, sort_order)
        VALUES ('Papel Cocina', 'Rollos de papel de cocina', default_category_id, 'rollos', true, 9);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM inventory_products WHERE name = 'Kit Alimentario') THEN
        INSERT INTO inventory_products (name, description, category_id, unit_of_measure, is_active, sort_order)
        VALUES ('Kit Alimentario', 'Kit básico de alimentación (sal, azúcar, aceite, etc.)', default_category_id, 'kits', true, 10);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM inventory_products WHERE name = 'Amenities Cocina') THEN
        INSERT INTO inventory_products (name, description, category_id, unit_of_measure, is_active, sort_order)
        VALUES ('Amenities Cocina', 'Amenities para cocina (detergente, bayetas, etc.)', default_category_id, 'kits', true, 11);
    END IF;
    
    -- Crear stock inicial para los nuevos productos si no existe
    INSERT INTO inventory_stock (product_id, current_quantity, minimum_stock, maximum_stock, updated_by)
    SELECT p.id, 0, 0, 100, '00000000-0000-0000-0000-000000000000'::uuid
    FROM inventory_products p
    WHERE p.name IN ('Sábanas Pequeñas', 'Sábanas Suite', 'Papel Higiénico', 'Papel Cocina', 'Kit Alimentario', 'Amenities Cocina')
    AND NOT EXISTS (SELECT 1 FROM inventory_stock s WHERE s.product_id = p.id);
END $$;