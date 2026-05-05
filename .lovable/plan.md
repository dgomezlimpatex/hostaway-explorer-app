## Buscador en el calendario (vista admin)

Añadir un campo de búsqueda en el header del calendario que filtre lo que se muestra por **empleado** y por **tarea / cliente / propiedad**.

### Comportamiento

- Input visible solo para administradores (no aparece para `cleaner`).
- Búsqueda en tiempo real (debounce 200ms), case-insensitive, sin acentos.
- Si el término coincide con el **nombre de un empleado** → la cuadrícula muestra solo la fila de ese empleado (más "Sin asignar" si tiene tareas que también matchean, opcional: ocultarla).
- Si el término coincide con **propiedad, código, dirección, cliente o tipo de tarea** → se ocultan las tareas que no coincidan; las filas de empleados sin tareas visibles se colapsan (se ocultan).
- Si matchea ambos (ej. "maria sevilla") → intersección: empleado Maria + tareas que mencionen Sevilla.
- Botón "X" para limpiar. Contador discreto: "12 tareas · 3 empleados".
- El filtro NO afecta al fetch (sigue cargando la ventana ±14/21 días); solo filtra en cliente para mantener velocidad.

### Cambios técnicos

1. **`src/components/calendar/ResponsiveCalendarHeader.tsx`**
   - Añadir props opcionales: `searchTerm`, `onSearchChange`, `showSearch` (default false).
   - Insertar un `Input` con icono `Search` en el subheader (entre navegación y selector de vista). En móvil, ocupar fila propia debajo.

2. **`src/components/CleaningCalendar.tsx`**
   - Añadir state `searchTerm` y pasar `searchTerm` / `onSearchChange` al header (solo si `userRole !== 'cleaner'`).
   - Crear `filteredTasks` y `filteredCleaners` con la lógica descrita y pasarlos a `CalendarContainer` y `CalendarFooterSummary` en lugar de `tasks` / `cleaners`.
   - También filtrar `unassignedTasks` por término de tarea/cliente/propiedad.

3. **Helper de matching** (inline o en `src/components/calendar/utils/calendarSearch.ts` nuevo):
   - `normalize(str)` → lowercase + sin diacríticos.
   - `taskMatches(task, term)`: comprueba `property`, `propertyCode`, `address`, `client`, `type`, `cleaner`.
   - `cleanerMatches(cleaner, term)`: comprueba `name`.
   - Lógica combinada: si algún cleaner matchea por nombre, restringir filas a esos cleaners; las tareas mostradas en cada fila además deben matchear (si el término también matchea propiedad/cliente).

### Out of scope

- No se toca la vista de cleaner (móvil/desktop), ni el calendario público.
- No se persiste el término entre sesiones.
- No se añaden filtros avanzados (estado, fecha) — ya existen en `/tasks`.
