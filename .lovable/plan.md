# Dividir duración también en la vista del trabajador

## Comportamiento

En la tarjeta de tarea del trabajador (móvil + desktop), si la tarea está asignada a varios limpiadores, se mostrará:
- **Hora inicio** original
- **Hora fin** ajustada a `inicio + (duración_total / N)`
- **Duración** = duración por persona (4h en el caso de Prioral 12h ÷ 3)
- Pequeña etiqueta `÷N` indicando que la tarea está compartida

Ejemplo Prioral (09:00–21:00, 3 personas): cada trabajador verá `09:00 → 13:00 · 4h · ÷3`.

## Cambios técnicos

**`src/components/calendar/cleaner/CleanerTaskCard.tsx`** (única edición):

1. Calcular `assignedCount` desde `task.cleaner` (separado por comas). Los datos llegan así porque `taskStorage.mapTaskFromDB` une los nombres con `, ` cuando hay varias asignaciones.
2. Si `assignedCount > 1`:
   - Calcular `displayEndTime = startTime + (duración_total / N)`.
   - Pasar ese valor donde se renderiza `task.endTime` y a `calculateDuration`.
3. Añadir un badge pequeño `÷N` (estilo coherente con la tarjeta) y tooltip que indique la duración total real (`Total: 09:00–21:00`).

No se tocan datos en BD, ni el flujo de inicio del checklist, ni la sección de finalización (que ya muestra la duración real trabajada según memoria `task-report-summary-minimalism`).

## Resultado esperado por escenario (Prioral 12h, 3 personas)

- **Gestor (calendario)**: ya implementado — bloque de 4h por trabajador con badge `÷3`.
- **Trabajador (móvil/desktop)**: tarjeta muestra `09:00–13:00 · 4h · ÷3`.
- **Reportes**: sin cambios — siguen dividiendo automáticamente (4h por persona, suma 12h).
