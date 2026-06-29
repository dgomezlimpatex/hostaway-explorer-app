# Sistema de Planificación de Limpiezas Implementation Plan

> **Para Hermes:** implementar paso a paso, actualizando este checklist en cada hito. Usar TDD/validación incremental: test o typecheck/build después de cada cambio relevante.

**Goal:** construir una pantalla operativa para planificar limpiezas por día/semana, detectar carga/capacidad, asignar limpiadoras y dejar trazabilidad clara sin romper el calendario actual.

**Architecture:** primera iteración frontend-first sobre datos existentes (`tasks`, `cleaners`, contratos/ausencias/mantenimientos y recurrencias ya usadas por workload), sin nueva tabla hasta validar flujo. Se añade una ruta protegida `/cleaning-planning`, hook agregador de planificación, componentes de tablero y acciones que reutilizan `taskAssignmentService`/`taskStorageService`. Si después hace falta persistir escenarios/borradores, se añade fase 2 con migración.

**Tech Stack:** Vite 5, React 18, TypeScript, React Query, Supabase, Tailwind/shadcn, date-fns. Timezone funcional: Europe/Madrid siguiendo `formatMadridDate`.

---

## Checklist maestro

### Fase 0 — Seguridad y contexto
- [x] Identificar repo activo: `C:/Users/danig/Downloads/hostaway-explorer-app-git`.
- [x] Confirmar stack y reglas en `AGENTS.md`.
- [x] Revisar rutas actuales (`src/App.tsx`).
- [x] Revisar modelo actual de tareas (`src/types/calendar.ts`).
- [x] Revisar hooks relevantes (`useTasks`, `useWorkloadCalculation`).
- [x] Crear rama de trabajo segura desde el estado actual.
- [x] Comprobar baseline: `npm run typecheck` y `npm run build`.

### Fase 1 — Núcleo de planificación calculada
- [x] Crear tipos puros de planificación en `src/types/cleaningPlanning.ts`.
- [x] Crear utilidades puras en `src/utils/cleaningPlanning.ts` para slots, duración, conflictos y métricas.
- [x] Añadir validación TypeScript para esas utilidades con `tsc`.
- [x] Crear hook `src/hooks/useCleaningPlanning.ts` que agregue tareas + limpiadoras + capacidad.

### Fase 2 — UI de tablero operativo
- [x] Crear página `src/pages/CleaningPlanning.tsx`.
- [x] Crear contenedor `src/components/cleaning-planning/CleaningPlanningPage.tsx`.
- [x] Crear resumen superior: pendientes, asignadas, sin asignar, conflictos, horas previstas/capacidad.
- [x] Crear filtros por fecha y rango día/mañana/semana.
- [x] Crear vista por limpiadora con carga diaria y tarjetas de tareas.
- [x] Crear columna “Sin asignar / por planificar”.
- [x] Crear badges de riesgo: solape, exceso de capacidad, sin limpiadora, horario incompleto.

### Fase 3 — Acciones paso a paso
- [x] Reutilizar asignación existente para asignar una tarea a una limpiadora desde planificación.
- [x] Permitir desasignar/reasignar desde tarjeta.
- [ ] Permitir ajustar horario/duración desde la tarjeta o modal existente.
- [x] Invalidar queries correctas (`tasks`, `cleaning-planning-tasks`) tras cada acción.
- [x] Mostrar toasts de éxito/error claros en español.

### Fase 4 — Integración navegación/permisos
- [x] Añadir lazy import en `src/App.tsx`.
- [x] Añadir ruta `/cleaning-planning` con `RoleProtectedRoute requiredModule="tasks"`.
- [x] Añadir entrada de menú en el sidebar/layout existente.
- [x] Asegurar permisos mediante la misma regla `tasks` del sidebar y de la ruta.

### Fase 5 — Validación real
- [x] Ejecutar `npm run typecheck`.
- [x] Ejecutar `npm run build`.
- [x] Levantar `npm run dev` en puerto 8080.
- [x] Probar `/cleaning-planning` con navegador hasta pantalla de login/protección.
- [x] Verificar consola sin errores críticos en la carga pública.
- [ ] Probar acción de asignar/reasignar con sesión autenticada.

### Fase 6 — Cierre
- [x] Actualizar este checklist con completado real.
- [x] Revisar `git diff`.
- [ ] Commit atómico en rama de feature.
- [ ] Push/PR si procede y si el remoto lo permite.

---

## Supuestos funcionales de la primera versión

1. **Planificar = ordenar y asignar tareas existentes**, no crear reservas nuevas.
2. Las limpiezas salen de `tasks`; las tareas recurrentes ya se contemplan en workload como previsión, pero la asignación operativa se hará sobre tareas materializadas.
3. Una tarea sin `cleanerId` es “sin asignar”.
4. Conflicto básico = dos tareas de la misma limpiadora con intervalos horarios solapados el mismo día.
5. Sobrecarga = minutos planificados del día > capacidad diaria estimada. En v1, si no hay contrato diario exacto, se usa heurística: horas semanales / 5.
6. Se mantiene todo dentro del módulo `tasks` para permisos.

---

## Plan paso a paso detallado

### Task 1: Crear rama y baseline

**Objective:** trabajar seguro y saber si el repo ya venía verde o rojo antes de tocar código.

**Files:** ninguno.

**Steps:**
1. Ejecutar:
   ```bash
   git switch -c feature/cleaning-planning
   npm run typecheck
   npm run build
   ```
2. Registrar resultado en este plan.

**Expected:** rama creada; typecheck/build conocidos.

---

### Task 2: Añadir tipos de planificación

**Objective:** definir contrato interno estable para UI y hook.

**Files:**
- Create: `src/types/cleaningPlanning.ts`

**Contenido previsto:**
- `PlanningTaskRisk = 'unassigned' | 'overlap' | 'overcapacity' | 'missing-time'`
- `CleaningPlanningTask` extendiendo campos operativos mínimos de `Task`.
- `CleanerPlanningDay` con `cleanerId`, `cleanerName`, `tasks`, `plannedMinutes`, `capacityMinutes`, `risks`.
- `CleaningPlanningSummary` con contadores.

**Verification:** `npm run typecheck`.

---

### Task 3: Crear utilidades puras de cálculo

**Objective:** separar lógica testeable de la UI.

**Files:**
- Create: `src/utils/cleaningPlanning.ts`

**Funciones:**
- `timeToMinutes(time?: string): number | null`
- `getTaskDurationMinutes(task): number`
- `tasksOverlap(a, b): boolean`
- `buildCleanerPlanningDays(tasks, cleaners, capacityByCleaner): CleanerPlanningDay[]`
- `buildPlanningSummary(days, unassigned): CleaningPlanningSummary`

**Edge cases:**
- Horario vacío.
- Hora fin menor/igual que inicio.
- Tarea con `duration` pero sin `endTime`.
- Limpiadora inactiva no debe usarse como capacidad principal.

**Verification:** `npm run typecheck`.

---

### Task 4: Crear hook agregador `useCleaningPlanning`

**Objective:** cargar datos de un rango y devolver modelo listo para render.

**Files:**
- Create: `src/hooks/useCleaningPlanning.ts`

**Data sources:**
- `tasks`: fechas entre `startDate` y `endDate`, no canceladas si existe ese estado en DB.
- `useCleaners()` para limpiadoras activas.
- `useWorkerContracts()` para capacidad.
- Opcional: ausencias / no disponibilidad si encaja con hooks existentes.

**Query key:** `['cleaning-planning', startDate, endDate, activeSede?.id]`.

**Verification:** `npm run typecheck`.

---

### Task 5: Crear UI base de página

**Objective:** renderizar sin acciones destructivas.

**Files:**
- Create: `src/pages/CleaningPlanning.tsx`
- Create: `src/components/cleaning-planning/CleaningPlanningPage.tsx`
- Create: `src/components/cleaning-planning/PlanningSummaryCards.tsx`
- Create: `src/components/cleaning-planning/PlanningFilters.tsx`

**UI inicial:**
- Título: “Planificación de limpiezas”.
- Selector rápido: hoy, mañana, semana.
- Cards: tareas totales, sin asignar, conflictos, horas/capacidad.
- Loading/error states.

**Verification:** `npm run typecheck && npm run build`.

---

### Task 6: Vista operativa por limpiadora

**Objective:** que el responsable vea qué lleva cada persona y qué queda sin asignar.

**Files:**
- Create: `src/components/cleaning-planning/CleanerPlanningColumn.tsx`
- Create: `src/components/cleaning-planning/PlanningTaskCard.tsx`
- Create: `src/components/cleaning-planning/UnassignedTasksPanel.tsx`

**UI:**
- Columna por limpiadora con barra de carga.
- Tarjetas con propiedad, dirección, hora, duración, cliente, estado.
- Badges de riesgo.
- Panel sin asignar ordenado por fecha/hora.

**Verification:** `npm run typecheck && npm run build`.

---

### Task 7: Acciones de asignación/reasignación

**Objective:** operar desde la pantalla sin ir al calendario.

**Files:**
- Modify: `src/components/cleaning-planning/PlanningTaskCard.tsx`
- Modify/Create: hook auxiliar `src/hooks/useCleaningPlanningActions.ts`

**Actions:**
- Select de limpiadora.
- Botón “Asignar/Reasignar”.
- Confirmación si ya tenía limpiadora.
- Toast éxito/error.
- Invalidate `tasks` y `cleaning-planning`.

**Verification:**
- `npm run typecheck && npm run build`.
- Manual: asignar una tarea sin asignar, comprobar que cambia de columna.

---

### Task 8: Integrar ruta y menú

**Objective:** hacer accesible la función.

**Files:**
- Modify: `src/App.tsx`
- Modify: archivo de sidebar/layout detectado durante implementación (`src/components/layout/*`)

**Route:** `/cleaning-planning` protegido con módulo `tasks`.

**Menu label:** “Planificación limpiezas”.

**Verification:** abrir ruta en navegador; menú visible para usuario con tareas.

---

### Task 9: Validación final y commit

**Objective:** entregar cambio verificable.

**Commands:**
```bash
npm run typecheck
npm run build
git diff --stat
git status --short
git add src .hermes/plans/2026-06-29_082544-planificacion-limpiezas.md
git commit -m "feat: add cleaning planning dashboard"
```

**Acceptance criteria:**
- Pantalla carga sin errores.
- Se ven tareas por limpiadora y sin asignar.
- Se detectan solapes y exceso de capacidad.
- Se puede asignar/reasignar o queda bloqueado documentado si falta sesión/API.
- Build y typecheck final completados o fallos preexistentes documentados.

---

## Riesgos / decisiones pendientes

- **Persistencia de planes/borradores:** no se incluye en v1 para evitar migración prematura. Si Dani quiere escenarios “propuestos vs publicados”, crear tabla `cleaning_plans` + `cleaning_plan_items` en fase 2.
- **Optimización automática:** v1 no autoasigna; da visibilidad y acciones manuales. Autoasignación puede venir después con reglas (zona, preferidas, horas, ausencias, tiempos de desplazamiento).
- **Capacidad diaria exacta:** depende de contratos/turnos. Si el modelo actual no tiene jornada diaria, usar heurística visible y ajustable después.
- **Reservas sin tarea:** si existen reservas Hostaway/Avantio sin tarea, se pueden mostrar como alerta posterior, pero no mezclar en primera entrega si no está claro el flujo de creación.

---

## Registro de ejecución

- 2026-06-29 08:25 — Plan creado tras inspección inicial. Repo activo en `hostaway-explorer-app-git`; `main` está 1 commit ahead de `origin/main`, sin diff local en este momento.
