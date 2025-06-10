
-- Modificamos la función existente para que no intente actualizar fecha_actualizacion
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Aseguramos que la tabla tasks tenga la columna updated_at
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'tasks' AND column_name = 'updated_at') THEN
        ALTER TABLE public.tasks ADD COLUMN updated_at TIMESTAMP WITH TIME ZONE DEFAULT now();
    END IF;
END $$;

-- Creamos el trigger para la tabla tasks si no existe
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.triggers 
                   WHERE trigger_name = 'update_tasks_updated_at') THEN
        CREATE TRIGGER update_tasks_updated_at
            BEFORE UPDATE ON public.tasks
            FOR EACH ROW
            EXECUTE FUNCTION update_updated_at_column();
    END IF;
END $$;
