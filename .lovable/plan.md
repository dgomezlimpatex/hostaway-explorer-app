
# Bug "incógnita" en el calendario de las limpiadoras — corrección de zona horaria

## Diagnóstico

Las limpiadoras ven "incógnita" / día siguiente vacío (sin tareas, sin info correcta) por un **bug de zona horaria en la app**, no en sus móviles.

En todo el flujo de calendario de la limpiadora se está usando `date.toISOString().split('T')[0]` para convertir una fecha JS a `YYYY-MM-DD`. El problema:

- `toISOString()` siempre devuelve la fecha en **UTC**.
- En España, una fecha como **martes 29/04 a las 00:30 hora de Madrid** equivale a **lunes 28/04 a las 22:30 UTC**.
- Por tanto `toISOString().split('T')[0]` devuelve **"2026-04-28"** en vez de **"2026-04-29"**.
- Resultado: cuando la limpiadora navega al "día siguiente", la app filtra tareas con la fecha equivocada → no encuentra nada → la vista queda en blanco / con datos extraños ("incógnita").

Esto es exactamente la regla que ya tenemos documentada (Core memory: usar siempre `formatMadridDate` para fechas, nunca `toISOString`). Hay sitios donde se aplicó pero el flujo de la limpiadora se dejó atrás.

## Sitios afectados (a corregir)

Reemplazar `date.toISOString().split('T')[0]` por `formatMadridDate(date)` en los puntos del flujo de la limpiadora:

1. **`src/components/calendar/cleaner/CleanerWeeklyView.tsx`** (línea 35) — el filtro de tareas por día en la franja semanal. Este es el bug principal: hace que el día seleccionado/los puntos por día se calculen en UTC.
2. **`src/components/CleaningCalendar.tsx`** (líneas 146 y 151) — cálculo de `currentDateStr` y `tomorrowDateStr` para `todayTasks` / `tomorrowTasks` que se pasan al móvil de la limpiadora. Aquí está la causa de que "Mañana: X tareas" salga mal y de que al pulsar otro día no se vean las tareas reales.
3. **`src/components/CleaningCalendar.tsx`** (líneas 259, 264, 321, 394) — los mismos cálculos en otra rama del render (vista mobile manager / filtros generales).
4. **`src/components/dashboard/CleanerDashboard.tsx`** (línea 30) — `todayStr` para las "Tareas de Hoy" en el panel inicial; con el bug, en horario nocturno o en el cambio de día puede mostrar el día incorrecto.

En todos los casos: importar `formatMadridDate` desde `@/utils/date` y sustituir.

No se modifica nada más fuera de este flujo (ni vista admin ni reports), para mantener el cambio acotado a lo que las limpiadoras están viendo mal.

## Por qué se manifiesta especialmente "el día siguiente de trabajo"

Cuando la limpiadora abre la app a primera hora o por la noche, JS construye fechas locales (Europe/Madrid). Al pulsar "siguiente día" se hace `setDate(+1)` y luego `toISOString()` → al pasar a UTC se resta 1-2 horas, y en muchos momentos del día eso "tira" la fecha al día anterior. Por eso para el día actual a veces se ve bien, pero el día siguiente falla con frecuencia.

## Lo que NO cambia

- Ningún flujo de creación, asignación ni reporte de tareas.
- Ninguna vista de administrador.
- No se tocan los botones del calendario (las correcciones previas de `type="button"` se mantienen).

## Resultado esperado

- Al seleccionar cualquier día (hoy o futuro) en la franja semanal, las tareas asignadas para ese día aparecen correctamente.
- El contador "Mañana: X tareas" coincide con la realidad.
- Desaparece la confusión visual que las limpiadoras describen como "incógnita".

¿Procedo con el fix?
