

## Objetivo
En la vista calendario admin (desktop), ocultar de la cuadrícula principal a las trabajadoras NO disponibles en el día visualizado (baja, vacaciones, día libre, festivo, personal, día fijo libre semanal) y agruparlas en un panel desplegable colapsable en la zona superior, mostrando nombre + motivo.

## Comportamiento

**Detección de no disponibilidad** (para el día/rango visible):
- Ausencia de día completo del tipo: `vacation`, `sick`, `day_off`, `holiday`, `personal` (de `worker_absences` con `start_time = null`).
- Día fijo libre semanal (de `worker_fixed_days_off` que coincida con el día de la semana visualizado).
- NO se ocultan: `external_work` (trabajo externo, sigue disponible para tareas internas si procede) ni ausencias parciales por horas (esas siguen visibles en la grid con su bloqueo horario actual).

**Vistas afectadas**: solo vista `day` del calendario admin desktop. En vistas `three-day` y `week`, se considera "no disponible" si lo está los 3/7 días completos; si solo lo está parcialmente, permanece en la grid (su fila ya muestra el tintado actual).

**UI del panel**:
- Ubicación: justo debajo de `CalendarHeader`, encima del `CalendarContainer`.
- Estado por defecto: **colapsado**.
- Cabecera siempre visible (clicable):
  - Icono `UserX` + texto: "Trabajadoras no disponibles · [N]"
  - Chip con desglose por motivo: 🏖️ 2 · 🤒 1 · 📅 3
  - Chevron (▼/▲) que rota al expandir.
  - Si N=0: panel oculto completamente (no se renderiza).
- Contenido expandido:
  - Lista en grid responsive (2-4 columnas según ancho).
  - Cada item: avatar/inicial + nombre + badge coloreado con icono y etiqueta del motivo (usando `ABSENCE_TYPE_CONFIG`) + rango horario si aplica + nota si existe.
  - Animación suave de expand/collapse.
- Persistencia del estado abierto/cerrado en `localStorage` (`calendar.unavailableWorkersExpanded`).

## Arquitectura técnica

**Nuevo componente**: `src/components/calendar/UnavailableWorkersPanel.tsx`
- Props: `cleaners: Cleaner[]`, `currentDate: Date`, `currentView: ViewType`.
- Internamente usa `useWorkersAbsenceStatus` (ya existente en `CalendarContainer`) y consulta `worker_fixed_days_off` vía nuevo hook `useWorkersFixedDaysOff` (o se añade al hook de absence status existente si ya lo trae).
- Calcula `unavailableCleaners: { cleaner, reason, absenceType, timeRange?, notes? }[]` con `useMemo`.
- Usa `Collapsible` de shadcn (`@/components/ui/collapsible`) para el desplegable.

**Filtrado en la grid**:
- En `CalendarContainer.tsx`, derivar `visibleCleaners = cleaners.filter(c => !unavailableIds.has(c.id))` y pasarlo a `CalendarLayout` en lugar de `cleaners`.
- Las tareas que estuvieran asignadas a una trabajadora oculta siguen mostrándose en `UnassignedTasksWithSuspense` si quedan sin asignar, o se mantienen pero con aviso (en este caso simplemente se ocultan junto a su fila — si tiene tareas asignadas la mostramos igualmente con badge de aviso, ver siguiente punto).

**Caso especial — trabajadora oculta con tareas asignadas ese día**:
- Si una trabajadora marcada como no disponible tiene tareas asignadas ese día (ej: olvido de reasignación), NO se oculta. Permanece visible en la grid con su tintado actual + se muestra también en el panel con badge "⚠️ Tiene tareas asignadas". Esto evita "perder" tareas visualmente.

## Diagrama

```text
┌─────────────────────────────────────────────────┐
│  CalendarHeader (fecha, vista, botones)         │
├─────────────────────────────────────────────────┤
│ ▼ Trabajadoras no disponibles · 4   🏖️2 🤒1 📅1 │ ← colapsable
│   ┌─────────┐ ┌─────────┐ ┌─────────┐           │
│   │ María   │ │ Ana     │ │ Lucía   │           │
│   │ 🏖️ Vac. │ │ 🤒 Baja │ │ 📅 Libre│           │
│   └─────────┘ └─────────┘ └─────────┘           │
├─────────────────────────────────────────────────┤
│  CalendarContainer (grid sin esas trabajadoras) │
└─────────────────────────────────────────────────┘
```

## Archivos a modificar
1. **Crear** `src/components/calendar/UnavailableWorkersPanel.tsx`
2. **Modificar** `src/components/CleaningCalendar.tsx` — montar el panel entre header y container (solo desktop manager/admin).
3. **Modificar** `src/components/calendar/CalendarContainer.tsx` — filtrar `cleaners` antes de pasar a `CalendarLayout`, exponer un set de IDs a ocultar (calculado a partir del mismo hook de absences + fixed days off).
4. **Posible refactor menor**: extraer el cálculo de "no disponibilidad de día completo" a un hook reutilizable `useUnavailableCleaners(cleaners, currentDate, currentView)` para compartir entre el panel y el container y evitar doble fetch.

## Notas
- No afecta a vista mobile ni a vista cleaner.
- No afecta a la lógica de drag & drop ni de validación al asignar (esas siguen funcionando contra los datos reales).
- Festivos (`holiday`) que aplican a todas las trabajadoras agruparían a todas — comportamiento correcto.

