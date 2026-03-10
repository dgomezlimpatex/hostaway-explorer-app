

## Problema

Desde el calendario no se puede ver cuántas horas lleva trabajadas cada limpiadora ni cuántas tiene de contrato. Hay que salir a otra pantalla para consultarlo.

## Solución propuesta: Mini barra de progreso de horas en la columna de trabajadoras

Añadir directamente en cada fila de la columna izquierda (`WorkersColumn`) una **mini barra de progreso** que muestre visualmente las horas trabajadas vs las horas de contrato de la semana actual. Es la solución más práctica porque:

- No requiere clics extra ni modales
- Se ve de un vistazo mientras asignas tareas
- No ocupa mucho espacio (cabe debajo del nombre)
- Usa datos que ya existen (`useCurrentWeekWorkload`)

### Diseño visual por trabajadora

```text
┌─────────────────────────────────┐
│  [AB]  Ana Belén                │
│        Activo                   │
│        ▓▓▓▓▓▓▓▓▓▓░░░░  24/32h  │
└─────────────────────────────────┘
```

- Barra verde si va bien, ámbar si hay déficit, roja si supera contrato
- Texto compacto: `24/32h` (trabajadas/contrato)
- Si no tiene contrato, mostrar solo horas trabajadas sin barra

### Tooltip ampliado (hover)

Al pasar el ratón sobre la barra, mostrar desglose:
- Horas turísticas
- Horas mantenimiento
- Ajustes manuales
- Horas extra / déficit

### Implementación técnica

1. **Crear hook `useCalendarWorkload`** que llame a `useCurrentWeekWorkload()` una sola vez para todas las trabajadoras y devuelva un mapa `cleanerId → WorkloadSummary`

2. **Modificar `WorkersColumn`** para recibir los datos de workload y renderizar la mini barra de progreso debajo del estado activo/inactivo

3. **Modificar `CalendarLayout` y `CalendarContainer`** para pasar los datos de workload desde el hook hasta `WorkersColumn`

4. **Ajustar altura de fila** de `h-20` a `h-24` para acomodar la barra extra sin comprimir el contenido

### Archivos a modificar

- `src/components/calendar/WorkersColumn.tsx` — añadir barra de progreso + tooltip
- `src/components/calendar/CalendarLayout.tsx` — pasar prop de workload
- `src/components/calendar/CalendarContainer.tsx` — invocar hook y pasar datos
- `src/components/calendar/CalendarGrid.tsx` — ajustar altura de fila para sincronizar

