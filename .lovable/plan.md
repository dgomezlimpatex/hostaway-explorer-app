## Cambio en filtro de reservas del portal de clientes

Modificar `src/components/client-portal/ClientPortalDashboard.tsx` (líneas ~55-67) para separar el rango de pasado y futuro:

- **Pasado**: mantener 7 días hacia atrás (actualmente no hay límite hacia atrás → añadir uno).
- **Futuro**: ampliar de 7 a **30 días** hacia adelante.

### Detalles técnicos

Reemplazar la lógica actual:

```ts
const sevenDaysAheadMs = todayMs + 7 * 24 * 60 * 60 * 1000;
const listBookings = bookings.filter(b => {
  ...
  return localMidnight < todayMs || localMidnight <= sevenDaysAheadMs;
});
```

Por:

```ts
const sevenDaysAgoMs = todayMs - 7 * 24 * 60 * 60 * 1000;
const thirtyDaysAheadMs = todayMs + 30 * 24 * 60 * 60 * 1000;
const listBookings = bookings.filter(b => {
  const raw = new Date(b.cleaningDate);
  const localMidnight = new Date(raw.getFullYear(), raw.getMonth(), raw.getDate()).getTime();
  return localMidnight >= sevenDaysAgoMs && localMidnight <= thirtyDaysAheadMs;
});
```

### Alcance

- Solo afecta a la pestaña **"Reservas"** (lista) y al contador del header (`upcomingBookings`).
- La pestaña **"Calendario"** sigue mostrando el dataset completo sin cambios.
- Sin cambios en backend, hooks ni queries.

### Pregunta de confirmación

¿Quieres que la interpretación de "tareas pasadas a 7 días" sea exactamente **7 días hacia atrás desde hoy** (lo que propongo), o prefieres mantener **todas las pasadas sin límite** y solo ampliar el futuro a 30 días?
