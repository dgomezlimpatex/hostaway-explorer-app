## Diagnóstico

He reproducido el error insertando como `anon` en `tasks` con la propiedad y cliente de María Montserrat:

```
{"code":"42501","message":"new row violates row-level security policy for table \"tasks\""}
```

**Causa raíz**: la migración del 25 de mayo (`20260525103048_…sql`) eliminó la política `Anonymous can verify portal token` sobre `public.client_portal_access` y la sustituyó por funciones RPC `SECURITY DEFINER`. A partir de ese momento `anon` ya **no puede leer ninguna fila de `client_portal_access`**.

El problema es que muchas RLS de otras tablas (tasks, properties, client_reservations, client_reservation_logs, cleaning_incidents…) siguen evaluando:

```sql
EXISTS (SELECT 1 FROM client_portal_access cpa
        WHERE cpa.client_id = X AND cpa.is_active = true)
```

Como esa lectura se hace bajo el rol del usuario (anon), RLS filtra todas las filas y el `EXISTS` devuelve `false`. Resultado: cualquier `INSERT`/`UPDATE`/`SELECT` desde el portal de cliente que dependa de esa comprobación es rechazado. Por eso fallan las reservas de junio (y, en general, cualquier creación desde el portal a partir del 25 de mayo: los últimos `created` por `client` son de ese día).

Tablas/políticas afectadas (todas las que mencionan `client_portal_access` en su expresión):

- `public.tasks` — view / insert / update / delete del portal
- `public.client_reservations` — view / insert / update del portal
- `public.client_reservation_logs` — insert del portal
- `public.properties` — view del portal
- `public.cleaning_incidents`, `cleaning_incident_media`, `cleaning_incident_events` — view del portal
- `public.client_extraordinary_requests` — view del portal

## Solución

Crear una función `SECURITY DEFINER` que evalúe la comprobación sin pasar por RLS y reescribir las políticas para usarla.

### 1. Nueva migración

```sql
CREATE OR REPLACE FUNCTION public.has_active_portal_access(_client_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.client_portal_access
    WHERE client_id = _client_id AND is_active = true
  );
$$;

GRANT EXECUTE ON FUNCTION public.has_active_portal_access(uuid) TO anon, authenticated;
```

Luego, para cada política listada arriba, hacer `DROP POLICY … ; CREATE POLICY …` reemplazando el `EXISTS (...)` por `public.has_active_portal_access(<columna_cliente>)`. El comportamiento es idéntico, pero la función corre como owner y ve la fila aunque `anon` no tenga `SELECT` sobre `client_portal_access`.

### 2. Verificación

Tras aplicar la migración, repetir el `curl` anónimo contra `/rest/v1/tasks` con el payload del portal y confirmar `201 Created`. Después probar el flujo real desde el portal de María Montserrat creando la reserva 30 may → 5 jun.

## Fuera de alcance

- No se toca el flujo de PIN/short-code ni las funciones RPC añadidas el 25 de mayo (siguen siendo el camino oficial para autenticar al cliente).
- No se vuelve a dar `SELECT` directo sobre `client_portal_access` a `anon` (la decisión de quitarlo se mantiene).
- No se modifica nada del frontend; el bug es 100% de RLS.
