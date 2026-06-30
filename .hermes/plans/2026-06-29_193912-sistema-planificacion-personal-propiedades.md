# Sistema de Planificación Personal-Propiedades Implementation Plan

> **For Hermes:** Use subagent-driven-development skill to implement this plan task-by-task.

**Goal:** Rehacer la planificación de limpiezas como un sistema simple y visual donde cada propiedad sea un centro de trabajo, los códigos con prefijo común formen edificios/grupos operativos, cada edificio/apartamento tenga personal asignado, se vea la carga prevista a corto/medio/largo plazo y se asignen automáticamente tareas ya creadas respetando sede, días libres, contrato, carga, buffer check-out/check-in y necesidades de 2–3 personas en casas grandes.

**Architecture:** Sustituir el panel reactivo actual por un modelo basado en **sede → propiedad/centro de trabajo → edificio por prefijo de código → equipo asignado → tareas ya creadas → capacidad de limpiadoras**. El motor no crea tareas: solo propone/asigna responsables a tareas existentes. UI principal: matriz visual por edificios/apartamentos y horizonte temporal, con modo simulación/validación/publicación de asignaciones.

**Tech Stack:** Vite 5, React 18, TypeScript, Supabase/Postgres, React Query, shadcn/Tailwind, date-fns. Timezone Europe/Madrid. Reutilizar `tasks`, `properties`, `cleaners`, `cleaner_availability`, `worker_contracts`, `property_groups`, `property_group_assignments`, `cleaner_group_assignments`, `hostaway_reservations`/`avantio_reservations` cuando proceda.

---

## 0. Corrección de rumbo

La implementación actual (`/cleaning-planning`) no resuelve el problema real. Es principalmente un listado de tareas sin asignar y carga por persona. Dani necesita un **sistema de planificación por asignación estructural de personal a edificios/apartamentos**, con capacidad prospectiva y automatización.

Por tanto, el plan incluye:

1. **Retirar o esconder la pantalla actual** mientras no aporte valor.
2. Diseñar un modelo nuevo centrado en:
   - edificios/apartamentos con personal titular,
   - centros de trabajo compartidos,
   - disponibilidad real,
   - ventanas check-out/check-in,
   - planificación anticipada,
   - sustituciones por bajas,
   - motor automático explicable.

---

## 1. Principios de producto

### Debe ser simple

La pantalla debe responder de un vistazo:

- ¿Qué edificios/apartamentos tengo cubiertos?
- ¿Quién es la persona/equipo titular?
- ¿Qué carga tendrá cada persona esta semana/mes?
- ¿Dónde faltan personas?
- ¿Qué tareas no caben dentro de la ventana check-out/check-in?
- ¿Qué pasa si una persona está de baja?
- ¿Qué asignaciones propongo automáticamente y por qué?

### No debe ser un listado infinito

La UI principal no será una lista de 90 tareas. Será una vista por:

1. **Centro/zona**: A Coruña, Sanxenxo, Ourense, Benidorm, hoteles, etc.
2. **Grupo/edificio**: edificio o conjunto de apartamentos.
3. **Equipo titular/asignado**.
4. **Carga prevista** por día/semana/mes.
5. **Alertas accionables**.

### Motor explicable, no caja negra

Cada asignación automática debe poder mostrar motivo:

- “Asignada a Ana porque es titular de este edificio, trabaja ese día y no supera contrato”.
- “No asignada porque check-out 11:00 / check-in 15:00 y no hay hueco disponible”.
- “Sugerida sustituta: Claudia, misma zona, 4h libres esta semana”.

---

## 2. Conceptos de dominio

### Centro de trabajo

En Limpatex, **cada propiedad es un centro de trabajo**. Se identifica por código. Las propiedades cuyo código comparte el mismo prefijo operativo forman parte del mismo edificio/grupo. Ejemplo: `MD18.1` y `MD18.1B` pertenecen al edificio/grupo `MD18`.

Los apartamentos individuales se tratan como su propio centro de trabajo/grupo si no comparten prefijo con otros.

Las limpiadoras **no se intercambian entre sedes**: A Coruña, Ourense y Benidorm funcionan como bolsas separadas de personal. Dentro de una sede sí puede haber varios edificios/apartamentos que compartan limpiadoras.

### Grupo operativo / edificio

Conjunto de propiedades que comparten prefijo de código o que operativamente deben planificarse como bloque. Ya existen tablas `property_groups` y `property_group_assignments`; hay que reutilizarlas o extenderlas.

Ejemplos:

- `MD18` → propiedades `MD18.1`, `MD18.1B`, etc.
- `AS` o `AS.5` según regla real del código
- apartamento individual sin prefijo compartido
- casa grande que requiere 2–3 personas

### Equipo titular

Relación estable entre grupo/propiedad y una o varias limpiadoras:

- principal,
- secundaria,
- sustituta preferente,
- excluida/no apta.

Puede existir a nivel grupo y sobrescribirse a nivel propiedad.

### Ventana de limpieza

Para una limpieza turística, la tarea solo se puede hacer entre:

```text
check_out anterior → check_in siguiente
```

Regla Limpatex confirmada: usar **30 minutos de buffer no productivo** dentro de esta ventana para englobar tiempos perdidos/desplazamiento/preparación. En general las limpiezas caben dentro de la ventana; las excepciones son casas grandes, que deben planificarse con **2–3 personas** en paralelo.

### Capacidad

Por limpiadora y periodo:

- horas contrato semanal,
- horas ya planificadas,
- días libres/fijos,
- disponibilidad diaria,
- ausencias/bajas/vacaciones,
- centros en los que puede trabajar,
- desplazamiento/zona.

---

## 3. Modelo de datos propuesto

### 3.1 Reutilizar tablas existentes

Inspección inicial confirma que ya existen o hay indicios de:

- `properties`
- `property_groups`
- `property_group_assignments`
- `cleaner_group_assignments`
- `cleaner_availability`
- `cleaners.contract_hours_per_week`
- `worker_contracts`
- `tasks`
- auto-assignment services existentes en `src/services/autoAssignment/*`

### 3.2 Nuevas/extendidas tablas necesarias

#### `property_staffing_centers` o reutilización de `property_groups`

No crear centros tipo “A Coruña Turismo” como unidad principal. La unidad principal es la **propiedad** y el agrupador práctico es el **edificio derivado del código**.

Preferencia técnica: reutilizar `property_groups` y `property_group_assignments` si encaja. Si no, crear una tabla ligera de agrupación derivada/cacheada.

Campos mínimos si se crea tabla nueva:

```sql
id uuid primary key default gen_random_uuid(),
sede_id uuid references public.sedes(id) on delete set null,
building_code text not null,
display_name text not null,
derived_from_property_codes boolean not null default true,
is_individual boolean not null default false,
is_active boolean not null default true,
created_at timestamptz default now(),
updated_at timestamptz default now(),
unique(sede_id, building_code)
```

#### `property_center_cleaners`

Limpiadoras asignadas a una propiedad/edificio dentro de la misma sede.

```sql
id uuid primary key default gen_random_uuid(),
property_group_id uuid references public.property_groups(id) on delete cascade,
property_id uuid references public.properties(id) on delete cascade,
cleaner_id uuid references public.cleaners(id) on delete cascade,
role text not null check (role in ('primary','secondary','backup','excluded')),
priority integer not null default 100,
is_active boolean not null default true
```

#### `property_group_staffing_rules`

Reglas por edificio/grupo.

```sql
id uuid primary key default gen_random_uuid(),
property_group_id uuid references public.property_groups(id) on delete cascade,
property_group_id uuid references public.property_groups(id) on delete set null,
required_cleaners integer not null default 1,
default_duration_minutes integer,
turnover_buffer_minutes integer not null default 30,
planning_horizon_days integer not null default 30,
is_active boolean not null default true
```

#### `property_staffing_assignments`

Asignación titular/sustituta por grupo o propiedad.

```sql
id uuid primary key default gen_random_uuid(),
property_group_id uuid references public.property_groups(id) on delete cascade,
property_id uuid references public.properties(id) on delete cascade,
cleaner_id uuid references public.cleaners(id) on delete cascade,
role text not null check (role in ('primary','secondary','backup','excluded')),
priority integer not null default 100,
valid_from date,
valid_to date,
notes text,
is_active boolean not null default true,
created_at timestamptz default now(),
updated_at timestamptz default now()
```

Regla: debe existir `property_group_id` o `property_id`. Si ambos existen, propiedad sobrescribe grupo.

#### `planning_runs`

Simulaciones/publicaciones de planificación.

```sql
id uuid primary key default gen_random_uuid(),
sede_id uuid references public.sedes(id) on delete set null,
property_group_id uuid references public.property_groups(id) on delete set null,
start_date date not null,
end_date date not null,
status text not null check (status in ('draft','validated','published','cancelled')) default 'draft',
created_by uuid references auth.users(id),
created_at timestamptz default now(),
published_at timestamptz
```

#### `planning_assignments`

Resultado propuesto/publicado por tarea/reserva.

```sql
id uuid primary key default gen_random_uuid(),
planning_run_id uuid references public.planning_runs(id) on delete cascade,
task_id uuid references public.tasks(id) on delete set null,
reservation_source text,
reservation_id text,
property_id uuid references public.properties(id) on delete set null,
cleaner_id uuid references public.cleaners(id) on delete set null,
assignment_status text not null check (assignment_status in ('proposed','manual','published','blocked','unassigned')),
score numeric,
reason jsonb not null default '{}'::jsonb,
window_start timestamptz,
window_end timestamptz,
planned_start timestamptz,
planned_end timestamptz,
created_at timestamptz default now()
```

---

## 4. Motor de planificación

### 4.1 Entradas

El motor recibe:

- rango de fechas,
- sede,
- propiedad/centro de trabajo y edificio derivado del prefijo de código,
- tareas ya creadas,
- propiedades y grupos,
- reglas de staffing,
- personas titulares/sustitutas,
- contratos/horas,
- disponibilidad/días libres,
- ausencias,
- tareas ya asignadas,
- ventanas check-out/check-in.

### 4.2 Salidas

Devuelve:

- asignaciones propuestas,
- tareas bloqueadas/no asignables,
- carga por limpiadora/día/semana/mes,
- alertas por propiedad/grupo,
- explicación de cada decisión.

### 4.3 Reglas de scoring inicial

Puntuación base por candidata:

| Factor | Peso inicial |
|---|---:|
| Es titular del grupo/propiedad | +100 |
| Es secundaria | +70 |
| Es backup | +50 |
| Pertenece al centro de trabajo | +40 |
| Misma zona/ciudad | +30 |
| Tiene horas disponibles en contrato | +30 |
| No trabaja ese día pero está disponible | +10 |
| Ya tiene tarea solapada | -9999 bloqueo |
| Está de baja/ausente | -9999 bloqueo |
| Excede horas contrato semanal | -80 |
| No cabe en ventana check-out/check-in | -9999 bloqueo |
| Está marcada como excluded | -9999 bloqueo |

### 4.4 Restricciones duras

Nunca asignar si:

- persona no activa,
- persona ausente/baja ese día,
- persona excluida para propiedad/grupo,
- limpieza no cabe en ventana real,
- solape con tarea ya asignada,
- no pertenece a ningún propiedad/edificio compatible dentro de la misma sede salvo permiso manual.

### 4.5 Restricciones blandas

Penalizar pero permitir si manager confirma:

- supera contrato levemente,
- fuera de grupo titular pero misma zona,
- reparto desigual de carga.

---

## 5. UI propuesta

### 5.1 Ruta nueva

Reemplazar `/cleaning-planning` por una pantalla nueva, manteniendo ruta:

```text
/cleaning-planning
```

Pero internamente rehacer componentes.

### 5.2 Layout principal

```
Planificación
┌────────────────────────────────────────────────────────┐
│ Horizonte: Hoy | 7 días | 30 días | Temporada           │
│ Centro: [A Coruña Turismo ▼]  Estado: [Todos ▼]        │
└────────────────────────────────────────────────────────┘

Resumen
┌────────────┬──────────────┬─────────────┬──────────────┐
│ Cobertura  │ Sin cubrir   │ Sobrecarga  │ Fuera ventana│
│ 92%        │ 8 tareas     │ 3 personas  │ 2 tareas     │
└────────────┴──────────────┴─────────────┴──────────────┘

Vista por edificios / grupos
┌────────────────────────────────────────────────────────┐
│ Edificio Marina  Equipo: Ana + Claudia  Cobertura 100% │
│ Lun ███  Mar ██  Mié █████  Jue █  Vie ███            │
│ Alertas: ninguna                                       │
└────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────┐
│ Sanxenxo Centro  Equipo: Rhaquel + backup pendiente    │
│ Lun ██  Mar █████  Mié █████  Jue ███  Vie █████      │
│ Alertas: 6 sin cubrir, 2 no caben por check-in         │
└────────────────────────────────────────────────────────┘
```

### 5.3 Vistas necesarias

#### Vista A — Por edificios/apartamentos

Objetivo: ver personal fijo y carga.

Columnas:

- Grupo/edificio,
- propiedades,
- equipo titular,
- backups,
- carga 7/30 días,
- tareas sin cubrir,
- conflictos ventana,
- botón configurar equipo.

#### Vista B — Por limpiadoras

Objetivo: ver carga individual.

Columnas:

- Limpiadora,
- sedes/edificios donde trabaja,
- contrato semanal,
- horas planificadas 7 días,
- horas planificadas 30 días,
- días libres/ausencias,
- sobrecarga,
- botón ver detalle.

#### Vista C — Calendario de capacidad

Heatmap simple:

- filas = limpiadoras,
- columnas = días,
- color = carga vs contrato/disponibilidad,
- iconos = baja/día libre/conflicto.

#### Vista D — Sustituciones

Flujo para baja:

1. Seleccionar persona y rango de baja.
2. Sistema muestra tareas afectadas.
3. Sistema propone sustitutas por orden.
4. Manager aplica todas o selecciona manualmente.

#### Vista E — Simulación/Publicación

1. Generar propuesta.
2. Revisar bloqueadas.
3. Ajustar manualmente.
4. Publicar.
5. Crear/actualizar `tasks` o `task_assignments`.

---

## 6. Fases de implementación

## Fase 0 — Retirar la UI actual que no sirve

### Task 0.1: Ocultar temporalmente la pantalla actual

**Objective:** evitar que se use una herramienta que Dani considera no útil.

**Files:**
- Modify: `src/components/dashboard/DashboardSidebar.tsx`
- Modify: `src/App.tsx`

**Steps:**
1. Quitar o marcar como experimental la entrada “Planificación limpiezas”.
2. Opcional: ruta `/cleaning-planning` muestra aviso “Nueva versión en construcción”.
3. No borrar código hasta tener replacement, para facilitar reutilización de piezas.

**Verification:**
```bash
npm run typecheck
npm run build
```

---

## Fase 1 — Modelo de centros/propiedades y asignaciones titulares

### Task 1.0: Definir derivación de edificio desde código de propiedad

**Objective:** agrupar automáticamente propiedades por edificio usando el prefijo del código.

**Rule v1:**
- `MD18.1` → grupo `MD18`
- `MD18.1B` → grupo `MD18`
- si no hay patrón compartido, la propiedad queda como grupo individual.

**Files:**
- Create: `src/services/planning/propertyCodeGrouping.ts`

**Functions:**
- `deriveBuildingCode(propertyCode: string): string`
- `groupPropertiesByBuildingCode(properties): PropertyBuildingGroup[]`

**Verification examples:**
```ts
deriveBuildingCode('MD18.1') === 'MD18'
deriveBuildingCode('MD18.1B') === 'MD18'
deriveBuildingCode('AS.5') === 'AS' // revisar si AS debe agrupar o ser individual según datos reales
```

### Task 1.1: Crear migración `work_centers`

**Objective:** representar centros de trabajo compartidos.

**Files:**
- Create: `supabase/migrations/YYYYMMDDHHMMSS_work_centers.sql`

**Includes:**
- `work_centers`
- `work_center_cleaners`
- RLS explícito para authenticated/admin/manager según patrones existentes.
- Índices por `sede_id`, `work_center_id`, `cleaner_id`.

**Verification:** aplicar en Supabase local/remoto según flujo del proyecto; si no hay Supabase local, validar SQL sintácticamente y revisar con diff.

### Task 1.2: Crear migración `property_staffing_assignments`

**Objective:** permitir equipo titular/backup/excluido por grupo o propiedad.

**Files:**
- Create: `supabase/migrations/YYYYMMDDHHMMSS_property_staffing_assignments.sql`

**Includes:**
- `property_group_staffing_rules`
- `property_staffing_assignments`
- constraints para `role`.
- constraints para property/group.
- RLS.

### Task 1.3: Añadir tipos manuales temporales

**Objective:** consumir tablas nuevas sin editar `src/integrations/supabase/types.ts` manualmente.

**Files:**
- Create: `src/types/planning.ts`

**Types:**
- `PropertyStaffingCenter` o `PropertyBuildingGroup`
- `PropertyCenterCleaner`
- `PropertyStaffingAssignment`
- `PropertyStaffingRule`
- `PlanningWindow`
- `PlanningCandidate`
- `PlanningAssignmentProposal`

### Task 1.4: Crear servicios de lectura/escritura

**Files:**
- Create: `src/services/planning/workCentersStorage.ts`
- Create: `src/services/planning/propertyStaffingStorage.ts`

**Functions:**
- `getPropertyBuildingGroups()`
- `getPropertyCenterCleaners(propertyGroupIdOrPropertyId)`
- `upsertPropertyCenterCleaner(...)`
- `getPropertyStaffingAssignments(filters)`
- `upsertPropertyStaffingAssignment(...)`
- `deletePropertyStaffingAssignment(id)`

---

## Fase 2 — Configuración simple: edificios/apartamentos → equipo

### Task 2.1: Crear página de configuración de equipos

**Objective:** permitir que Dani configure quién lleva cada edificio/apartamento.

**Files:**
- Create: `src/pages/PlanningStaffingConfig.tsx`
- Create: `src/components/planning-config/PlanningStaffingConfigPage.tsx`
- Modify: `src/App.tsx`
- Modify: `src/components/dashboard/DashboardSidebar.tsx`

**Route:**
```text
/planning/staffing
```

**UI:**
- filtro por propiedad/edificio,
- lista de grupos/propiedades,
- selector principal/secundario/backup/excluido,
- guardar cambios.

### Task 2.2: Reutilizar `property_groups`

**Objective:** no obligar a asignar propiedad por propiedad si hay edificios/grupos.

**Behavior:**
- si grupo tiene equipo, las propiedades heredan equipo.
- si propiedad tiene override, se usa override.

### Task 2.3: Añadir importador/semilla inicial asistida

**Objective:** configurar rápido los equipos iniciales.

**UI:**
- botón “Copiar limpiadoras preferidas actuales” si existen datos en `property_preferred_cleaners`.
- botón “Asignar equipo a todo el grupo”.

---

## Fase 3 — Motor de ventanas check-out/check-in

### Task 3.1: Crear utilidades puras de ventanas

**Files:**
- Create: `src/services/planning/planningWindows.ts`

**Functions:**
- `buildCleaningWindow({ checkoutDateTime, checkinDateTime, bufferMinutes })`
- `taskFitsWindow({ durationMinutes, windowStart, windowEnd })`
- `findEarliestSlot({ durationMinutes, window, existingAssignments })`

**Tests:**
- Create: `src/services/planning/planningWindows.test.ts` si hay runner; si no, añadir script temporal o validar con typecheck + future test setup.

**Cases:**
- limpieza cabe 11:00–16:00 con 3h.
- limpieza no cabe si duración+buffer supera ventana.
- check-in inexistente usa ventana por defecto configurable.

### Task 3.2: Obtener reservas/tareas previstas

**Files:**
- Create: `src/services/planning/planningDemandService.ts`

**Sources:**
- `tasks` ya creadas,
- `hostaway_reservations`,
- `avantio_reservations`,
- Little Hotelier si aplica.

**Output:** `PlanningDemandItem[]` con propiedad, fecha, duración estimada, ventana.

---

## Fase 4 — Capacidad real de limpiadoras

### Task 4.1: Crear servicio de capacidad

**Files:**
- Create: `src/services/planning/cleanerCapacityService.ts`

**Uses:**
- `cleaners.contract_hours_per_week`
- `worker_contracts`
- `cleaner_availability`
- ausencias/bajas si existen (`worker_absences`, hooks actuales)
- tareas ya asignadas.

**Output:**
```ts
CleanerCapacityProfile {
  cleanerId,
  workCenterIds,
  weeklyContractMinutes,
  availableMinutesByDate,
  assignedMinutesByDate,
  absencesByDate,
  fixedDaysOff,
}
```

### Task 4.2: Incluir centros compartidos

Una limpiadora puede estar en varios centros. El motor debe:

- permitir asignarla a ambos,
- respetar límite global de contrato,
- penalizar cambios de zona/centro el mismo día,
- priorizar edificio/propiedad principal.

---

## Fase 5 — Motor automático de asignación

### Task 5.1: Crear scorer puro

**Files:**
- Create: `src/services/planning/assignmentScoring.ts`

**Function:**
```ts
scoreCandidate(demandItem, cleanerProfile, staffingRules, currentPlan): PlanningCandidateScore
```

**Must return:**
- `score`,
- `blocked: boolean`,
- `blockingReasons[]`,
- `positiveReasons[]`,
- `warnings[]`.

### Task 5.2: Crear asignador

**Files:**
- Create: `src/services/planning/planningAssignmentEngine.ts`

**Algorithm v1:**
1. Ordenar limpiezas por fecha, hora límite check-in y duración.
2. Para cada limpieza:
   - candidatos = titulares + backups + propiedad/edificio compatible dentro de la misma sede.
   - filtrar bloqueos duros.
   - puntuar.
   - elegir mayor score.
   - reservar slot.
3. Devolver propuestas y bloqueadas.

### Task 5.3: Sustituciones por baja

**Function:**
```ts
planReplacement({ cleanerId, startDate, endDate, scope }): ReplacementPlan
```

**Behavior:**
- buscar tareas afectadas,
- intentar backups del mismo edificio,
- si no, propiedad/edificio compatible dentro de la misma sede,
- si no, marcar sin cubrir.

---

## Fase 6 — Nueva UI principal simple

### Task 6.1: Crear `PlanningDashboardPage`

**Files:**
- Replace/Create: `src/pages/CleaningPlanning.tsx`
- Create: `src/components/planning/PlanningDashboardPage.tsx`

**Sections:**
1. Filtros: horizonte, propiedad/edificio, sede, estado.
2. Resumen: cobertura, sin cubrir, sobrecarga, fuera ventana.
3. Cards por grupo/edificio.
4. Heatmap por limpiadora.
5. Panel lateral de alertas.

### Task 6.2: Cards por edificio

**Files:**
- Create: `src/components/planning/PropertyGroupPlanningCard.tsx`

**Card displays:**
- nombre grupo,
- propiedades incluidas,
- equipo titular,
- backups,
- mini calendario 7/30 días,
- tareas previstas,
- sin cubrir,
- botón configurar.

### Task 6.3: Heatmap de capacidad

**Files:**
- Create: `src/components/planning/CleanerCapacityHeatmap.tsx`

**Rows:** limpiadoras.

**Columns:** días.

**Colors:**
- verde < 80%,
- amarillo 80–100%,
- rojo > 100%,
- gris día libre/baja.

### Task 6.4: Panel de bloqueos

**Files:**
- Create: `src/components/planning/PlanningAlertsPanel.tsx`

**Alerts:**
- sin equipo asignado,
- sin sustituta,
- fuera de ventana,
- sobrecontrato,
- solape,
- propiedad/edificio sin personal suficiente.

---

## Fase 7 — Flujo generar/revisar/publicar

### Task 7.1: Botón “Generar propuesta”

**Behavior:**
- no modifica tareas todavía.
- crea `planning_run` en `draft`.
- guarda `planning_assignments` como `proposed` o `blocked`.

### Task 7.2: Edición manual de propuesta

Permitir:
- cambiar persona,
- ajustar slot dentro de ventana,
- marcar como aceptado aunque tenga warning,
- dejar sin cubrir con motivo.

### Task 7.3: Publicar planificación

Al publicar:
- **no crear tareas nuevas**, porque ya vendrán creadas,
- crear/actualizar únicamente asignaciones (`task_assignments` o campos equivalentes),
- registrar `planning_run.status = published`,
- opcional: disparar notificaciones existentes.

---

## Fase 8 — Sustituciones rápidas

### Task 8.1: Modal de baja/sustitución

**Files:**
- Create: `src/components/planning/ReplacementPlannerModal.tsx`

**Flow:**
1. Seleccionar limpiadora.
2. Seleccionar fechas.
3. Ver tareas afectadas.
4. Generar sustitutas propuestas.
5. Aplicar cambios.

### Task 8.2: Botón desde heatmap/persona

Desde una persona sobrecargada o ausente: “Replanificar”.

---

## Fase 9 — Limpieza de implementación actual

Cuando la nueva UI esté funcional:

**Remove/replace:**
- `src/components/cleaning-planning/*` antiguo si no se reutiliza.
- `src/hooks/useCleaningPlanning.ts` antiguo si se reemplaza por `usePlanningDashboard`.
- `src/utils/cleaningPlanning.ts` antiguo si se reemplaza por servicios nuevos.

Mantener solo piezas útiles como formato de horas si encajan.

---

## 10. Plan de validación

### Unit/pure logic

Aunque el proyecto no tenga test runner claro, el objetivo debe ser añadir o usar uno para lógica crítica. Si no se instala runner en esta iteración, como mínimo aislar funciones puras para test futuro.

Tests clave:

- ventana check-out/check-in,
- no asignar fuera de ventana,
- no asignar día libre,
- no asignar baja,
- priorizar titular,
- backup si titular no disponible,
- respetar contrato semanal,
- centros compartidos consumen capacidad global,
- sustitución genera propuestas válidas.

### App checks

```bash
npm run typecheck
npx eslint src/services/planning src/components/planning src/pages/CleaningPlanning.tsx src/types/planning.ts
npm run build
```

### Manual QA

1. Configurar un grupo con titular + backup.
2. Crear/usar reservas futuras.
3. Generar propuesta 7 días.
4. Confirmar que usa titular si disponible.
5. Marcar titular de baja.
6. Confirmar que propone backup.
7. Confirmar que no asigna fuera de check-in/check-out.
8. Confirmar que persona compartida entre centros no supera contrato global.
9. Publicar y verificar tareas/asignaciones reales.

---

## 11. Decisiones confirmadas por Dani

Estas decisiones sustituyen las preguntas abiertas anteriores:

1. **Centro de trabajo = propiedad.** Cada propiedad se identifica por código.
2. **Edificio/grupo = prefijo común de código.** Ejemplo: `MD18.1` y `MD18.1B` pertenecen al grupo/edificio `MD18`.
3. **Apartamentos individuales = centro/grupo propio.** Si no comparten prefijo con otros apartamentos, se tratan como unidad independiente.
4. **No intercambiar limpiadoras entre sedes.** A Coruña, Ourense y Benidorm deben tener bolsas de personal separadas.
5. **Buffer fijo de 30 minutos** entre check-out/check-in para tiempo no productivo.
6. **No crear tareas.** Las tareas ya vendrán creadas; el sistema solo debe asignarlas/reasignarlas.
7. **Casi todas las limpiezas caben en ventana.** Las excepciones son casas grandes.
8. **Casas grandes requieren 2–3 personas.** El motor debe permitir asignaciones múltiples y repartir duración/carga por persona.

---

## 12. Orden recomendado de ejecución

1. Ocultar pantalla actual o marcarla como experimental.
2. Crear modelo de centros/equipos titulares.
3. Crear configuración visual de equipos por edificio.
4. Crear cálculo de ventanas check-out/check-in.
5. Crear capacidad real por persona.
6. Crear motor automático simple.
7. Crear dashboard visual por edificios + heatmap.
8. Añadir sustituciones.
9. Añadir publicación.
10. Eliminar código antiguo.

---

## 13. Definición de éxito

La nueva planificación estará lista cuando Dani pueda hacer esto sin ayuda técnica:

1. Entrar en Planificación.
2. Ver cada edificio/apartamento con su equipo titular.
3. Ver carga de trabajo para 7/30 días.
4. Detectar sin cubrir y sobrecargas de un vistazo.
5. Generar propuesta automática.
6. Simular una baja y aplicar sustituciones.
7. Publicar asignaciones con antelación.
8. Entender por qué cada tarea fue asignada a cada persona.

Si no cumple esos 8 puntos, no debe considerarse terminado.
