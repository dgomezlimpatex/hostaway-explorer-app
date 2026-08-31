-- Crear función para ejecutar SQL dinámico desde edge functions
CREATE OR REPLACE FUNCTION public.exec_sql(query text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
    result jsonb;
BEGIN
    -- Validar que solo se permitan operaciones SELECT en cron
    IF query !~* '^\s*select\s+cron\.schedule.*' THEN
        RAISE EXCEPTION 'Solo se permiten operaciones de cron.schedule';
    END IF;
    
    -- Ejecutar la consulta
    EXECUTE query;
    
    -- Retornar éxito
    result := jsonb_build_object('success', true);
    RETURN result;
EXCEPTION
    WHEN OTHERS THEN
        -- Retornar error
        result := jsonb_build_object(
            'success', false,
            'error', SQLERRM
        );
        RETURN result;
END;
$$;