## Separar visualmente pasadas y próximas dentro de cada propiedad

En el portal de clientes (pestaña **Reservas**), dentro de cada propiedad las reservas aparecen mezcladas en una sola lista cronológica. La distinción actual (fondo verde-pálido para pasadas, barra lateral de color para próximas) es sutil. Vamos a crear dos secciones claramente separadas.

### Cambios en `src/components/client-portal/ReservationsList.tsx`

Dentro del `AccordionContent` de cada propiedad, en lugar de un único listado, renderizar **dos sub-secciones**:

```text
┌─ PESPA6.9 · PLAZA DE ESPAÑA ANTON ────────────────┐
│                                                    │
│  ▸ PRÓXIMAS (5)                                    │
│  ───────────────────────────                       │
│  • 2 may → 9 may   [En 1d]                         │
│  • 13 may → 18 may                                 │
│  • 20 may → 24 may                                 │
│  • 24 may → 31 may                                 │
│  • 31 may → 7 jun                                  │
│                                                    │
│  ▾ PASADAS (1)              [colapsable]           │
│  ───────────────────────────                       │
│  • vie 1 may  [Completada]                         │
└────────────────────────────────────────────────────┘
```

### Detalles de implementación

1. **Particionar `group.bookings`** en dos arrays:
   - `upcoming`: `cleaningDate >= hoy`, ordenado ascendente (más cercana primero).
   - `past`: `cleaningDate < hoy`, ordenado descendente (la más reciente arriba).

2. **Render con cabeceras de sección** (no nuevos accordions anidados, para mantener simpleza):
   - Cabecera sticky-style: fondo `bg-muted/40`, texto pequeño en mayúsculas, badge con el contador.
     - Próximas → punto verde + "PRÓXIMAS · N"
     - Pasadas → punto gris + "PASADAS · N"
   - Mostrar primero **Próximas**, luego **Pasadas**.

3. **Pasadas colapsadas por defecto**: usar un `<details>` o un toggle local con `useState` por grupo (`Set<string>` de propertyIds expandidos). Por defecto cerrado para reducir ruido visual; el usuario lo abre con un click. Esto encaja con el feedback "más sencillo de diferenciar".

4. **Si una sección está vacía**, no renderizarla (ej. propiedad sin pasadas no muestra la cabecera "Pasadas").

5. **Mantener sin cambios** el render de cada tarjeta de booking (la barra lateral de color y badges actuales se conservan, ahora redundantes pero refuerzan la identidad de cada item).

6. **Quitar el fondo verde de las pasadas** (`bg-emerald-50…`) ya que ahora la separación es por sección — volver a `hover:bg-accent/50` para todas las filas y dejar solo el texto en `text-muted-foreground` para las pasadas.

### Alcance

- Solo `ReservationsList.tsx`. Sin cambios en datos, hooks, ni en `ClientPortalDashboard.tsx`.
- No afecta a la pestaña "Calendario" ni al contador del header.

### Pregunta

¿Prefieres que las **pasadas** estén:
- (a) **Colapsadas por defecto** dentro de cada propiedad (mi recomendación, máximo foco en lo próximo), o
- (b) **Expandidas siempre**, simplemente separadas por la cabecera de sección?
