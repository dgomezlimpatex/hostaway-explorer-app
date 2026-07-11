# Registro de decisiones y especificación — Hermes radicalmente simple

Fecha: 2026-07-11
Fuente: auditoría verificable en `2026-07-11-hermes-radical-simple-audit.md` y contratos del repo.
Estado: convergencia técnica previa a implementación; sujeta a incorporar vetos P0/P1 de la ronda crítica.

## Fase 2 — Registro de deliberación multi-agente

### DECISIÓN #1: pantalla inicial
- **Posturas:**
  - **UX-Minimal:** solo fecha, CTA y disclosure; todo panel explicativo es deuda de diseño.
  - **OPS:** conservar sede activa y acceso a ajustes, sin obligar a leerlos.
  - **Frontend:** composición condicional; no apilar propuesta bajo el cockpit.
  - **Onboarding:** título directo y una sola frase; no mostrar KPIs ni “decisiones pendientes”.
  - **Abogado del Diablo:** error y ausencia de tareas deben tener salida clara; no esconder la sede equivocada.
- **Resolución:** título no interactivo + fecha + `Planificar con Hermes` + `Opciones avanzadas`; selector de sede solo si existe más de una sede. En error aparece `Reintentar` y el total sigue siendo ≤5.
- **Justificación:** cubre la acción diaria y conserva cambios de sede/ajustes bajo interacción explícita.
- **Coste en clicks/elementos:** 3 controles habituales; 4 con selector de sede; 5 en error.

### DECISIÓN #2: fecha y rango
- **Posturas:**
  - **UX-Minimal:** mañana preseleccionado; nada más.
  - **OPS:** un día es el uso diario; varios días debe seguir disponible.
  - **Frontend:** `preset='today'` ya significa un día anclado en la fecha, no hace falta cambiar hooks.
  - **Onboarding:** “1 día” es comprensible; “today” no debe aparecer.
  - **Abogado del Diablo:** respetar fecha de URL si existe y evitar desfases UTC/Madrid.
- **Resolución:** mañana en Madrid por defecto; input de fecha visible; rango 1/7/30 días dentro de avanzado. `formatMadridDate` para el input.
- **Justificación:** el caso “limpiezas de mañana” pasa a cero decisiones previas; conserva planificación multidiaria.
- **Coste en clicks/elementos:** -1 interacción respecto al actual para mañana; el rango no compite visualmente.

### DECISIÓN #3: estructura del sandbox
- **Posturas:**
  - **UX-Minimal:** un único calendario por día, sin pestañas.
  - **OPS:** ver inmueble, horario, responsable y rojo de un vistazo; no perder equipos grandes.
  - **Frontend:** agenda vertical en móvil; timeline por persona en escritorio reutilizando el calendario actual.
  - **Onboarding:** la tarjeta debe decir qué limpieza, cuándo, quién y estado, nada más.
  - **Abogado del Diablo:** conservar asignaciones ya confirmadas como contexto neutral y no editarlas accidentalmente.
- **Resolución:** vista diaria única. Móvil: agenda de tarjetas; escritorio: timeline por persona. Tarjeta principal: inmueble, horario, responsable(s), estado. Asignaciones existentes en gris y no editables.
- **Justificación:** reduce modos sin perder contexto operativo ni soporte multi-persona.
- **Coste en clicks/elementos:** elimina tres tabs y una decisión de modo.

### DECISIÓN #4: edición
- **Posturas:**
  - **UX-Minimal:** tocar tarjeta y tocar candidata; dos interacciones exactas.
  - **OPS:** necesita reasignar rápido, también desde móvil; lista ordenada por equipo del edificio.
  - **Frontend:** tap/click es más fiable y accesible que drag & drop; DnD móvil añade complejidad y errores.
  - **Onboarding:** “Elegir responsable” y nombres; no exponer validadores técnicos.
  - **Abogado del Diablo:** excluir “No apta”, evitar duplicar responsable en tareas multi-persona y bloquear edición durante aprobación.
- **Resolución:** tarjeta editable → diálogo `Elegir responsable` → candidata válida. Titulares/suplentes/backups primero; “No apta” y duplicados no se ofrecen. Sin DnD en esta iteración.
- **Justificación:** cumple ≤2 interacciones en todas las plataformas. Drag & drop era `[NO ENCONTRADO]`, por lo que no se elimina capacidad existente.
- **Coste en clicks/elementos:** de Select embebido por tarjeta a 0 controles permanentes; reasignar sigue en 2 interacciones.

### DECISIÓN #5: semáforo
- **Posturas:**
  - **UX-Minimal:** tres estados, color + texto corto.
  - **OPS:** diferenciar titular de suplente/backup; rojo debe dominar.
  - **Frontend:** usar `assignmentRole` real; no inferir por confianza.
  - **Onboarding:** no usar solo color ni emojis ambiguos.
  - **Abogado del Diablo:** el rol puede faltar; debe existir fallback honesto.
- **Resolución:** `● Titular` verde para `primary`; `● Suplente/backup` ámbar para `secondary|backup`; `● Sin cubrir` rojo. Cambio manual se marca `● Revisado` ámbar. Rol ausente: `● Propuesta` ámbar, nunca se inventa titularidad.
- **Justificación:** respeta datos reales y accesibilidad; fusiona los estados operativamente equivalentes.
- **Coste en clicks/elementos:** 0 clicks; reemplaza badges de fuente/confianza visibles.

### DECISIÓN #6: explicabilidad
- **Posturas:**
  - **UX-Minimal:** nunca por defecto.
  - **OPS:** necesaria para investigar un caso raro.
  - **Frontend:** reutilizar `reasons`, `warnings` y calidad global dentro de `<details>`.
  - **Onboarding:** etiqueta `Por qué propone esto`, no “score/confidence”.
  - **Abogado del Diablo:** avisos bloqueantes deben escapar del disclosure.
- **Resolución:** razones, confianza, score y métricas en `Ver detalles del plan`; bloqueos y rojos permanecen visibles.
- **Justificación:** mantiene explicabilidad sin convertir la revisión normal en una auditoría técnica.
- **Coste en clicks/elementos:** -4 tarjetas KPI y -1 bloque de calidad del default; +1 click solo cuando se investiga.

### DECISIÓN #7: aprobar y descartar
- **Posturas:**
  - **UX-Minimal:** botón final directo, sin confirmación redundante.
  - **OPS:** texto debe incluir notificación; descartar debe ser inequívoco.
  - **Frontend:** `await onApply`, CTA sticky y guard por ref.
  - **Onboarding:** `Aprobar y notificar` / `Descartar propuesta`.
  - **Abogado del Diablo:** single-flight inmediato y no cerrar sandbox si falla.
- **Resolución:** dos botones sticky. Aprobar ejecuta directamente; descartar elimina el borrador local y vuelve al inicio. No se guarda borrador rechazado.
- **Justificación:** la pantalla sandbox ya es la revisión; un segundo modal repite la misma decisión.
- **Coste en clicks/elementos:** -1 click y -1 vista modal.

### DECISIÓN #8: funciones actuales fuera del happy path
- **Posturas:**
  - **UX-Minimal:** fuera del default.
  - **OPS:** filtros, asignación manual, disponibilidad y edificios deben sobrevivir.
  - **Frontend:** reutilizar componentes existentes dentro de un único disclosure; mantener `/planning-settings`.
  - **Onboarding:** `Opciones avanzadas`, no una lista de conceptos en la portada.
  - **Abogado del Diablo:** no borrar archivos ni cambiar permisos/rutas.
- **Resolución:** filtros, guía, atención, Copilot avanzado, cola manual, disponibilidad, carga y diagnóstico quedan en `Opciones avanzadas`. Configuración sigue en `/planning-settings`.
- **Justificación:** progressive disclosure sin pérdida de función ni doble implementación.
- **Coste en clicks/elementos:** -12 controles fijos del default; +1 click para uso excepcional.

### DECISIÓN #9: rojos sin cubrir
- **Posturas:**
  - **UX-Minimal:** banner rojo y tarjetas rojas; no añadir modal.
  - **OPS:** no bloquear el trabajo ya cubierto; aprobar parcial es necesario.
  - **Frontend:** el lote actual ya aplica solo propuestas y deja conflictos fuera.
  - **Onboarding:** `X limpiezas sin cubrir`; no “conflictos”.
  - **Abogado del Diablo:** todo rojo debe desactivar aprobación; aprobación parcial debe decir exactamente qué guarda.
- **Resolución:** rojos no bloquean aprobación parcial. Banner sticky `X sin cubrir` y CTA `Aprobar N cubiertas y notificar`. Si N=0, aprobación deshabilitada y solo se puede corregir o descartar.
- **Justificación:** evita perder asignaciones válidas y hace imposible confundir parcial con completo.
- **Coste en clicks/elementos:** 0 confirmaciones extra; 1 indicador persistente.

### DECISIÓN #10: estado tras aprobar
- **Posturas:**
  - **UX-Minimal:** confirmación breve y salida limpia.
  - **OPS:** necesita saber cuántas se guardaron y notificaron.
  - **Frontend:** reutilizar toast de `useCleaningPlanningActions`; limpiar propuesta solo tras éxito.
  - **Onboarding:** `Plan aprobado: N limpiezas guardadas y notificadas`.
  - **Abogado del Diablo:** en error mantener el sandbox y los cambios.
- **Resolución:** toast de éxito y retorno a inicio; en fallo, toast destructivo y sandbox intacto.
- **Justificación:** no crea una tercera pantalla ni oculta errores.
- **Coste en clicks/elementos:** 0 clicks de salida.

### DECISIÓN #11: concurrencia y doble aprobación
- **Posturas:**
  - **OPS:** nunca pisar cambios manuales frescos.
  - **Frontend:** mantener firma + refetch + validación stale existente y añadir ref single-flight.
  - **Abogado del Diablo:** `isPending` puede llegar tarde para un doble clic; bloquear también edición y descarte durante apply.
- **Resolución:** `applyInFlightRef` se activa sin esperar rerender; CTA, edición y descarte quedan deshabilitados durante apply. Se mantienen firma, fresh tasks y rollback existentes.
- **Justificación:** cierra la única carrera UI sin modificar persistencia ni motor.
- **Coste en clicks/elementos:** 0; elimina doble envío accidental.

### DECISIÓN #12: autosave del sandbox
- **Posturas:**
  - **UX-Minimal:** invisible, sin botón Guardar borrador.
  - **OPS:** recuperar cambios tras refresh reduce retrabajo.
  - **Frontend:** `sessionStorage` por firma/contexto, escritura en efecto; nunca tareas productivas.
  - **Onboarding:** texto `Tus cambios se guardan en este navegador hasta aprobar o descartar` solo en detalles.
  - **Abogado del Diablo:** limpiar al aprobar/descartar y no restaurar sobre otra propuesta.
- **Resolución:** autosave optimista en `sessionStorage`, clave derivada de la propuesta original; restauración solo con misma firma; limpieza en aprobar/descartar.
- **Justificación:** cumple persistencia en background sin introducir tabla/API ni guardar asignaciones antes de aprobar.
- **Coste en clicks/elementos:** 0.

## Fase 3 — Especificación definitiva

### 3.1 Presupuestos duros

| Métrica | Base actual | Tope | Diseño objetivo |
|---|---:|---:|---:|
| Happy path mañana | 6 interacciones (4 clics + 2 scrolls) | ≤4 clics | 2 clics, 0 scrolls obligatorios |
| Happy path fecha distinta | 6+ | ≤4 clics | 3 interacciones |
| Controles visibles iniciales | 15 fijos + fórmula por tarea | ≤5 | 3 habituales; 4 multi-sede; 5 solo error |
| Decisiones obligatorias | 3 | ≤2 | 2: aceptar fecha/default y aprobar |
| Vistas atravesadas | 3 | — | 2 |

### 3.2 Pantalla inicial

#### Layout
- Contenedor centrado y corto, sin dashboard debajo.
- Eyebrow no técnico: `Planificación de limpiezas`.
- H1: `¿Qué día quieres planificar?`.
- Ayuda: `Hermes prepara el reparto. Tú lo revisas antes de guardarlo.`
- Campo fecha con mañana preseleccionado y etiqueta `Día`.
- Texto no interactivo: `1 día · [Sede activa]`.
- CTA ancho: `Planificar con Hermes`.
- Disclosure discreto: `Opciones avanzadas`.

#### Elementos visibles e inventario medible
1. Input fecha (`data-planning-initial-control`).
2. Selector sede solo si hay varias (`data-planning-initial-control`).
3. CTA Planificar (`data-planning-initial-control`).
4. Summary Opciones avanzadas (`data-planning-initial-control`).
5. `Reintentar` solo en error (`data-planning-initial-control`).

#### Oculto en avanzado
- Sede (si procede), 1/7/30 días, filtros de tareas, actualizar datos.
- Personalización de edificios.
- Asignación manual/cola de decisiones.
- Disponibilidad, carga y diagnóstico.
- Copilot/conversación y explicaciones.

#### Estados y microcopy
- Cargando: `Cargando las limpiezas…` y CTA deshabilitado.
- Preparando: `Hermes está preparando el reparto…`.
- Error tareas: `No pudimos cargar las limpiezas. Reintenta sin cambiar tu selección.` + `Reintentar`.
- Error edificios: `Faltan datos de equipos. Reintenta antes de planificar.`; CTA deshabilitado para no producir propuesta degradada silenciosa.
- Sin tareas pendientes: `No hay limpiezas sin asignar para este día.`
- Sin sede: `Elige una sede en Opciones avanzadas para continuar.`

#### Móvil
- Una columna; CTA de 48px; fecha nativa; ningún scroll necesario en viewport de 667px de alto.
- Avanzado se abre en flujo normal debajo; no drawer nuevo.

### 3.3 Sandbox diario

#### Layout
1. Cabecera compacta: fecha/rango y `Propuesta de Hermes`.
2. Estado persistente: verde si todo cubierto; rojo si hay sin cubrir; ámbar si hay avisos.
3. Calendario del día.
4. `Ver detalles del plan` plegado.
5. Barra sticky inferior con `Descartar propuesta` y `Aprobar… y notificar`.

#### Tarjeta de limpieza
- Línea 1: estado textual + color.
- Línea 2: inmueble/propiedad.
- Línea 3: hora y responsable(s).
- Toda la tarjeta propuesta es un botón accesible: `Reasignar [propiedad]`.
- Asignaciones ya confirmadas: neutras, no botón.

#### Reasignación
1. Tap/click tarjeta.
2. Tap/click candidata en `Elegir responsable`.
- Al elegir: actualización local inmediata, cierre del diálogo, autosave en `sessionStorage`, recálculo de avisos.
- Candidatas: equipo del edificio por prioridad, luego pool; excluye `No apta` y duplicados en la misma limpieza.
- Si el cambio genera solape: aviso bloqueante visible y aprobar queda deshabilitado.

#### Detalles bajo demanda
- Razones y avisos de cada propuesta.
- Métricas globales/score.
- Lista textual completa.
- `Restablecer propuesta de Hermes`.
- Texto de autosave.

#### Estados
- Todo cubierto: `Todo cubierto. Revisa el reparto y aprueba cuando esté correcto.`
- Con rojos: `X limpiezas sin cubrir. Puedes corregirlas o aprobar solo las N cubiertas.`
- Todo rojo: `Hermes no pudo cubrir ninguna limpieza. Reasigna o descarta esta propuesta.`; aprobar deshabilitado.
- Stale: `Los datos cambiaron. Vuelve a planificar para no pisar cambios recientes.`; aprobar deshabilitado.
- Aplicando: `Guardando y notificando…`; toda edición/descarte deshabilitados.
- Error apply: `No se pudo aprobar. Tus cambios siguen aquí.`

#### Móvil
- Agenda vertical por hora; no timeline horizontal obligatorio.
- Barra de aprobación sticky con safe-area padding.
- Diálogo de candidatas ocupa ancho disponible, scroll interno solo para la lista.
- Touch targets ≥44px y foco visible.

### 3.4 Antes/después

| Métrica | Antes | Después | Mejora |
|---|---:|---:|---:|
| Interacciones happy path mañana | 6 | 2 | -67% |
| Clics happy path mañana | 4 | 2 | -50% |
| Controles iniciales normales | 15 + dinámicos | 3–4 | -73% mínimo |
| Decisiones obligatorias | 3 | 2 | -33% |
| Vistas/estados atravesados | 3 | 2 | -33% |
| Reasignar | 2 (Select embebido) | 2 (tarjeta → candidata) | Igual en clics, menor carga visual |

Todas las métricas mejoran salvo el número puro de interacciones de reasignación, que se mantiene en el mínimo exigido y elimina controles repetidos de la vista.

## Plan de refactor

### Reutilizar sin cambiar lógica
- `buildAssignmentProposal` y todo `proposalEngine.ts`.
- `validateProposalBatchForApply` / `executeProposalBatch`.
- `useCleaningPlanning`, `useCleaningPlanningActions`, contexto de sede.
- Cálculo de warnings del calendario: duplicados, No apta, fuera de equipo y solapes.
- Componentes avanzados existentes, ahora dentro de disclosure.

### Crear
- `PlanningStartScreen.tsx`: portada medible de 3–5 controles.

### Reescribir/componer
- `CleaningPlanningPage.tsx`: mañana por defecto y composición mutuamente excluyente inicio/sandbox.
- `AssignmentProposalPanel.tsx`: eliminar tabs y modal; estado/CTA sticky, partial apply, single-flight y autosave.
- `PlanningProposalCalendar.tsx`: tarjetas clickables, selector de candidata on-demand, semáforo real y agenda móvil.

### Archivar sin borrar
- `DailyPlanningHeader` deja de montarse en el flujo principal.
- Guía, atención, Copilot, cola manual y paneles técnicos siguen disponibles dentro de `Opciones avanzadas`.

### Feature flag
- `[NO ENCONTRADO]` sistema de feature flags en el repo.
- No se añade infraestructura. La rama/worktree aislada y la conservación de capacidades avanzadas reducen el riesgo; rollback por Git.

## Test del principiante sobre la spec

Recorrido: abre → ve mañana → pulsa `Planificar con Hermes` → ve propuesta por día → si todo está bien pulsa `Aprobar y notificar`.

- Fricciones altas: **0**.
- Fricciones medias: **0** en happy path.
- Fricción baja: si hay rojo, debe elegir entre corregir o aprobar parcial; es una decisión operativa real, no evitable por UI.
- Jerga visible por defecto: **0** (`sandbox`, `score`, `conflict`, `stale`, `backup` técnico y nombres internos quedan fuera o traducidos).
