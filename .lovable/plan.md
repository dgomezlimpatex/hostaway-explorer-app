

# Plan: corregir fechas de entrada/salida en el calendario del portal del cliente para reservas de Avantio/Hostaway

## Problema

En el calendario del portal del cliente, las reservas que provienen de Avantio (Turquoise) y Hostaway aparecen siempre como una "estancia de 1 noche" con entrada el día anterior a la limpieza y salida el mismo día de la limpieza. Esto es incorrecto: las fechas reales (`arrival_date` y `departure_date`) ya están en la base de datos en `avantio_reservations` y `hostaway_reservations`, pero el portal no las usa.

**Ejemplos confirmados en la BD:**
- **MR16.1** (reserva Avantio 31488920): real 22-abr → 25-abr. Portal muestra: 24-abr → 25-abr. ❌
- **CMD18.5A**: real ~22-abr → 23-abr (la tarea de limpieza es del 23). Portal muestra: 22-abr → 23-abr. ❌

**Causa raíz:** en `useClientPortalBookings` (`src/hooks/useClientPortal.ts`), las "tareas externas" se mapean con `checkInDate: null` y `checkOutDate: null`. Después, en `bookingToReservation` (`ReservationsCalendar.tsx`), al detectar `source === 'external'` se inventa una estancia ficticia `[día_limpieza − 1, día_limpieza]`.

## Solución

Enriquecer cada tarea externa con las fechas reales de la reserva original (Avantio o Hostaway) cuando exista vinculación por `task_id`. Como las RLS actuales no permiten al `anon` leer esas tablas, exponer una RPC `SECURITY DEFINER` que devuelva sólo lo estrictamente necesario para el calendario (sin datos personales).

## Cambios

### 1. Base de datos (migración)
Crear función RPC pública para que el portal anónimo obtenga las fechas reales:

```sql
CREATE OR REPLACE FUNCTION public.get_portal_reservation_dates_by_task_ids(_task_ids uuid[])
RETURNS TABLE (
  task_id uuid,
  arrival_date date,
  departure_date date,
  adults int,
  children int,
  source text
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT task_id, arrival_date, departure_date, adults, children, 'avantio'
  FROM avantio_reservations
  WHERE task_id = ANY(_task_ids) AND status NOT IN ('cancelled','CANCELLED')
  UNION ALL
  SELECT task_id, arrival_date, departure_date, adults, children, 'hostaway'
  FROM hostaway_reservations
  WHERE task_id = ANY(_task_ids) AND status <> 'cancelled';
$$;
GRANT EXECUTE ON FUNCTION public.get_portal_reservation_dates_by_task_ids(uuid[]) TO anon, authenticated;
```

No se exponen nombre del huésped, email, importes ni notas — sólo fechas y nº de huéspedes (que ya se muestra en el portal para reservas manuales).

### 2. Frontend: `src/hooks/useClientPortal.ts`
En `useClientPortalBookings`, después de construir `externalBookings`:

1. Recolectar los `task_id` de todas las tareas externas.
2. Llamar `supabase.rpc('get_portal_reservation_dates_by_task_ids', { _task_ids })`.
3. Construir un `Map<taskId, {arrival_date, departure_date, adults, children}>`.
4. Sustituir `checkInDate`/`checkOutDate`/`guestCount` de cada `externalBooking` por los valores reales cuando estén disponibles. Si no hay match (tarea manual no vinculada a Avantio/Hostaway), se mantiene el comportamiento actual.

### 3. Frontend: `src/components/client-portal/ReservationsCalendar.tsx`
Modificar `bookingToReservation` para que el "fallback de 1 noche" solo se active cuando `checkInDate`/`checkOutDate` siguen siendo `null` (tarea externa sin reserva vinculada, ej. recurrentes o tareas manuales). Si tiene fechas reales, se usan tal cual.

## Sección técnica

- **Tablas tocadas:** ninguna estructura nueva. Solo una nueva función RPC `SECURITY DEFINER`.
- **Seguridad:** la RPC sólo devuelve fechas y número de adultos/niños indexados por `task_id`. No filtra por cliente, pero los `task_id` ya están filtrados aguas arriba a las tareas del cliente autenticado en el portal.
- **Performance:** una sola llamada RPC adicional por carga del portal (batch con todos los task_ids).
- **Cancelaciones:** se filtran reservas canceladas en la propia RPC para evitar mostrar fechas obsoletas.
- **Compatibilidad:** las reservas manuales del portal (`source: 'manual'`) no se ven afectadas; siguen usando `check_in_date`/`check_out_date` de `client_reservations`.

## Verificación tras el cambio

Comprobar en el calendario que:
- MR16.1 muestra estancia 22-abr → 25-abr (3 noches) en lugar de 1 noche.
- CMD18.5A muestra la estancia real completa.
- Las tareas recurrentes/manuales sin reserva vinculada siguen apareciendo como bloque de 1 día (comportamiento actual).

