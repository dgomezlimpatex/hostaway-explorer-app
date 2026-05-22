# Problema

El modal "Generar Enlace de Reparto" (`LaundryScheduledLinkModal`) tras los últimos cambios solo coge las tareas del propio día de reparto. Ignora la configuración de recogida (p. ej., el reparto de hoy viernes debía incluir las tareas de ayer jueves).

Causa: el modal llama a `fetchTasksForDates([deliveryDate], …)` y guarda `dateStart = dateEnd = deliveryDate`, sin consultar la configuración de `laundry_delivery_schedule` (que sí define los `collectionDays` previos).

# Solución

En `src/components/laundry-share/LaundryScheduledLinkModal.tsx`:

1. Usar el hook `useLaundryDeliverySchedule` para obtener la configuración del día de reparto seleccionado (matching por `dayOfWeek` del `parsedDate`).
2. Calcular las fechas reales de recogida con `calculateCollectionDates(parsedDate, schedule)` (ya existente en `useLaundrySchedule.ts`). Si no hay schedule configurado para ese día, fallback al propio `deliveryDate`.
3. Construir la lista completa de fechas = `[...collectionDates, deliveryDate]` (sin duplicados, formato `yyyy-MM-dd`).
4. Pasar esa lista a `fetchTasksForDates(...)` tanto en el preview como al generar el enlace.
5. Al crear el enlace, guardar:
   - `dateStart` = mínima fecha de la lista (la más antigua de recogida).
   - `dateEnd` = `deliveryDate`.
   - `filters.collectionDates` = lista completa (igual que ahora pero con todas las fechas).
6. Mostrar en el preview las fechas de recogida (texto pequeño tipo "Incluye servicios de: jue 22 + vie 23") para que el admin vea exactamente qué días se incluirán.
7. Mantener la validación de "un enlace por día" usando `deliveryDate` (no cambia).

Con esto `PublicLaundryScheduledView` (que filtra por `dateStart..dateEnd` + `snapshotTaskIds`) ya recibe el rango correcto y todas las tareas del jueves entrarán.

# Verificación

- Hoy viernes: abrir modal → debe mostrar contador con jueves+viernes, generar enlace y verificar que la vista pública lista las tareas del jueves.
- Día sin configuración previa: debe seguir funcionando con solo el día de reparto.
- Editar/desactivar: sin cambios.

# Archivos a modificar

- `src/components/laundry-share/LaundryScheduledLinkModal.tsx` (única edición).
