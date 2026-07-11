# Simplificación radical de “Propuesta automática con Hermes”

Fecha de auditoría: 2026-07-11
Repositorio auditado: `hostaway-explorer-app` @ `8491a39d` (`origin/main`)
Rama aislada de misión: `feat/hermes-radical-simple`
Ruta oficial: `/planning` (`/planning?copilot=open` usa la misma página)
Alcance: capa de interacción/UI. El motor `src/utils/cleaning-planning/proposalEngine.ts` queda fuera de alcance.

## Evidencia inspeccionada

- `src/App.tsx`
- `src/components/cleaning-planning/CleaningPlanningPage.tsx`
- `DailyPlanningHeader.tsx`
- `PlanningFilters.tsx`
- `PlanningWorkflowGuide.tsx`
- `PlanningAttentionSummary.tsx`
- `PlanningCopilotPanel.tsx`
- `AssignmentProposalPanel.tsx`
- `PlanningProposalCalendar.tsx`
- `PlanningDecisionQueue.tsx`
- `PlanningTaskCard.tsx`
- `PlanningAdvancedDetails.tsx`
- `scripts/cleaningPlanningUiContractTest.mjs`

La URL productiva se abrió, pero el navegador de auditoría no comparte la sesión autenticada del perfil Edge QA y mostró `/auth`. Por ello no se inventa una cifra dependiente de las tareas productivas del día: se separan controles fijos, controles dinámicos y un happy path determinista contra la estructura del código.

# FASE 0 — Auditoría forense

## 0.1 Flujo real y contador de interacciones

### Escenario medido

Happy path operativo reproducible: usuaria ya autenticada y con sede activa correcta, entra en `/planning?copilot=open`, quiere planificar **mañana**, todas las tareas pueden cubrirse, no edita la propuesta y la aprueba.

| # | Pantalla/estado | Acción | ¿Imprescindible? | ¿Eliminable/fusionable? |
|---|---|---|---|---|
| 1 | Dashboard inicial | Pulsar “Día siguiente” para pasar de hoy a mañana | Sí para este objetivo | Puede desaparecer con default “mañana” o selector único más claro |
| 2 | Dashboard inicial | Pulsar “Planificar con Hermes” | Sí | Mantener |
| 3 | Misma ruta, propuesta generada debajo de varios bloques | Desplazarse hasta “Plan recomendado” | No | Eliminable: sustituir el dashboard por el sandbox al generar |
| 4 | Sandbox largo | Desplazarse hasta el CTA situado después de métricas, alertas, pestañas y calendario | No | Eliminable: barra de acciones sticky |
| 5 | Sandbox | Pulsar “Revisar y confirmar N limpiezas” | No como paso separado | Fusionar con aprobación final |
| 6 | Modal | Pulsar “Confirmar y guardar plan” | Sí como consentimiento final | Mantener como única aprobación, sin modal redundante |

**Total happy path actual: 6 interacciones mínimas** (4 clics + 2 desplazamientos estructuralmente necesarios).

Notas de medición:

- Si se usa el calendario nativo en vez de “Día siguiente”, elegir mañana puede requerir dos acciones (abrir + seleccionar), elevando el total a 7.
- El código no hace auto-scroll tras `setProposalState`.
- El CTA de aprobación está al final de `AssignmentProposalPanel`, después de un calendario con altura mínima de 520 px, por lo que no queda visible al entrar al sandbox.
- No se cuentan navegación lateral ni login, porque la misión empieza al entrar en el módulo.

### Flujo de aplicación real

1. `CleaningPlanningPage.handleGenerateProposal()` ejecuta `buildAssignmentProposal()` con `filteredUnassignedTasks`.
2. La propuesta se guarda localmente en `proposalState` junto con `contextKey` y snapshot de tareas.
3. `AssignmentProposalPanel` copia `proposal.proposals` a `draftProposals`.
4. `PlanningProposalCalendar` permite cambiar responsable mediante un `Select`; el cambio es local.
5. Los bloqueos de solape, duplicado y “No apta” deshabilitan la aplicación.
6. El primer CTA abre un modal.
7. El segundo CTA llama `onApply(draftProposals)`.
8. `CleaningPlanningPage.handleApplyProposal()` refresca tareas, valida firma/contexto y llama `applyProposal`.
9. Tras éxito limpia la propuesta y refresca edificios/limpiadoras. Las notificaciones dependen del flujo existente de aplicación.

### Capacidades declaradas en la misión pero no encontradas en este módulo

- `[NO ENCONTRADO]` Botón o acción semántica “Rechazar propuesta”. Solo existen “Limpiar plan” y “Restablecer propuesta”.
- `[NO ENCONTRADO]` Drag & drop dentro de `PlanningProposalCalendar`. El calendario general de producción sí tiene drag & drop, pero el sandbox solo usa selector de responsable.
- `[NO ENCONTRADO]` Semáforo explícito 🟢 titular / 🟡 suplente-backup / 🔴 sin cubrir. El sandbox usa tonos por procedencia (`existing`, `manual`, `hermes`) y conflictos separados, no por rol operativo.
- `[NO ENCONTRADO]` Pin/bloqueo de asignaciones dentro del flujo `/planning` auditado.
- `[NO ENCONTRADO]` Persistencia optimista en background desde el sandbox. El cambio es local y solo persiste al aprobar el lote, lo cual es más seguro para un sandbox.

## 0.2 Inventario de carga visual inicial

### Controles interactivos fijos visibles

La pantalla cargada y sin propuesta muestra **15 controles interactivos fijos**:

1. Planificar con Hermes.
2. Actualizar.
3. Selector de sede.
4. Día anterior.
5. Campo fecha.
6. Día siguiente.
7. Preset Hoy.
8. Preset 7 días.
9. Preset 30 días.
10. Más filtros.
11. Personalizar edificios.
12. Resumen (Hermes).
13. Explicar pendientes (Hermes).
14. Abrir conversación avanzada.
15. Ver disponibilidad, carga y diagnóstico técnico.

Controles dinámicos adicionales visibles:

- `+1` si existe el acordeón “Ver N limpiezas ya cubiertas”.
- Por cada tarea pendiente/no cubierta visible: `+2` (selector de limpiadora + botón Asignar).
- Por cada tarea ya asignada pero incluida en decisiones: `+3` (selector + Reasignar + Desasignar).

Fórmula exacta de la vista inicial:

`15 + (hay_cubiertas ? 1 : 0) + 2 × tareas_sin_asignar_visibles + 3 × tareas_asignadas_en_decisión`

El número productivo absoluto es dependiente de datos y no se pudo observar sin sesión autenticada; inventar un N único sería falso. La base estructural verificable es **15**, ya tres veces el tope objetivo de 5.

### Todos los bloques y elementos visibles

| Elemento visible | Qué aporta | Uso estimado en el 90% | Veredicto |
|---|---|---:|---|
| Badge “Plan del día” | Etiqueta de contexto | Bajo; el título ya lo dice | ELIMINAR |
| Badge sede + rango | Confirma alcance | Alto, pero puede integrarse en selector | MANTENER visible, fusionado |
| Título “Planificación diaria…” | Orientación | Alto | MANTENER visible, más compacto |
| Párrafo introductorio largo | Explica el flujo | Bajo tras primer uso | ELIMINAR |
| CTA “Planificar con Hermes” | Acción principal | 100% | MANTENER visible |
| Botón “Actualizar” | Recarga manual | Bajo | MOVER a avanzado/menú |
| KPI “Sin cubrir” | Riesgo crítico | Alto antes de aprobar, no antes de generar | MOVER al sandbox |
| KPI “Requiere decisión” | Riesgo crítico | Alto antes de aprobar, no antes de generar | MOVER al sandbox |
| KPI “Capacidad” | Diagnóstico | Bajo para happy path | MOVER a avanzado |
| Encabezado “Día, sede y horizonte” | Describe controles | Medio | ELIMINAR |
| Ayuda “Elige qué operación…” | Explica filtros | Bajo | ELIMINAR |
| Selector de sede | Alcance operativo | Alto si hay varias sedes | MANTENER, discreto; no contar si solo hay una |
| Día anterior | Navegación rápida | Medio | Fusionar en selector de fecha |
| Campo fecha | Alcance | 100% | MANTENER visible |
| Día siguiente | Navegación rápida | Medio | Fusionar en selector de fecha |
| Presets Hoy/7/30 | Horizonte | Bajo en plan diario; obliga a interpretar | MOVER a avanzado; default mañana |
| Más filtros | Acceso a búsqueda/estado/zona/persona | Bajo en happy path | MOVER a menú “Opciones” |
| Workflow “Cómo se usa…” | Tutorial permanente | Bajo; evidencia complejidad | ELIMINAR de vista diaria |
| Botón “Personalizar edificios” | Configuración maestra | Bajo en planificación diaria | MOVER a Opciones/Configuración |
| Paso 1 “Revisa la vista” + tareas/carga | Resumen de alcance | Medio | ELIMINAR; el selector ya define alcance |
| Paso 2 “Personaliza edificios” + badge | Setup | Bajo diario | MOVER a configuración |
| Paso 3 “Planifica…” + badge | Estado | Redundante con CTA/propuesta | ELIMINAR |
| Alertas de error de carga | Seguridad | Solo cuando ocurren | MANTENER condicional |
| Estado “Cargando planificación…” | Feedback | Alto durante espera | MANTENER condicional, compacto |
| Panel “Qué necesita atención” | Resumen pre-plan | Medio, pero duplica KPIs/cola | MOVER al sandbox y fusionar con rojos |
| Badge Revisar/Controlado | Estado resumido | Medio | MOVER al sandbox |
| Hasta 5 bullets de atención | Riesgos | Alto si existen, pero no antes de generar | MOVER al sandbox |
| Panel “Hermes te ayuda…” | Explicación/capacidad conversacional | Bajo diario | MOVER a avanzado |
| Badge “con confirmación” | Garantía | Bajo una vez entendido | ELIMINAR; la acción final lo deja claro |
| Caja de alcance del copilot | Repite filtros | Bajo | ELIMINAR |
| Caja “Plan recomendado” vacía | Repite ausencia de propuesta | Nulo | ELIMINAR |
| Botón “Resumen” | Consulta opcional | Bajo | MOVER a avanzado |
| Botón “Explicar pendientes” | Explicabilidad | Medio solo ante dudas | MOVER a menú contextual/on-demand |
| Conversación avanzada | Instrucción libre | Bajo | MOVER a Opciones avanzadas |
| Panel “Plan recomendado” vacío | Placeholder instructivo | Nulo | ELIMINAR hasta generar |
| Cola “Decisiones pendientes” pre-plan | Edición manual directa | Medio en excepciones; distrae del flujo automático | MOVER a avanzado antes de generar; integrar conflictos después |
| Grupos Urgente/Sin cubrir/Casas grandes/Revisión | Priorización | Alto solo si Hermes no resuelve | MOVER al sandbox como rojos/avisos |
| Tarjetas y selectores por tarea | Asignación manual | Excepción | OCULTAR hasta tap de tarea/Reasignar |
| “Ver N ya cubiertas” | Auditoría | Bajo | MOVER a avanzado |
| Acordeón técnico | Disponibilidad/carga/diagnóstico | Bajo | Mantener capacidad, pero dentro de menú secundario fuera del lienzo principal |

## 0.3 Mapa de decisiones actual

### Decisiones obligatorias del happy path

1. **Alcance temporal:** elegir/confirmar fecha y entender cómo interactúa con Hoy/7/30 días.
2. **Aprobación:** decidir que la propuesta visual es válida.
3. **Confirmación duplicada:** volver a ratificar la misma decisión en un modal.

**Decisiones obligatorias medidas: 3.** La tercera no aporta una nueva decisión de negocio y debe desaparecer.

### Decisiones aparentes impuestas por la pantalla, aunque tengan default

- ¿La sede activa es correcta?
- ¿Debo usar Hoy, 7 días o 30 días si he cambiado la fecha?
- ¿Debo tocar “Más filtros” antes de planificar?
- ¿Debo personalizar edificios antes de continuar?
- ¿Debo leer “Qué necesita atención” antes de dejar actuar a Hermes?
- ¿Debo usar “Resumen” o “Explicar pendientes”?
- ¿Debo asignar manualmente desde “Decisiones pendientes” antes o después de Hermes?
- ¿“Limpiar plan” equivale a rechazar, borrar o recalcular?
- ¿Puedo confirmar con avisos blandos?

Defaults que Hermes/UI puede asumir:

- Fecha inicial: mañana.
- Rango inicial: un día.
- Sede: sede activa persistida; mostrar selector solo si hay más de una.
- Filtros: todas las tareas planificables del día.
- Vista sandbox: por día.
- Edición móvil: tap tarea → Reasignar → candidato válido.
- Explicación: bajo demanda por tarea.

## 0.4 Métricas base

| Métrica | Actual |
|---|---:|
| Interacciones happy path “mañana” | **6 mínimas** (4 clics + 2 scrolls) |
| Clics puros happy path | **4** |
| Controles interactivos fijos visibles al entrar | **15** |
| Controles reales con tareas | **15 + fórmula dinámica** |
| Decisiones obligatorias | **3** |
| Estados/vistas atravesados | **3**: dashboard inicial → sandbox incrustado → modal |

# FASE 1 — Test del principiante

Persona: coordinadora nueva, primer día, sin formación. Solo sabe: “tengo que asignar las limpiezas de mañana con el planificador automático”.

## Recorrido simulado

1. Entra y ve título, dos badges, explicación, tres KPIs y dos botones. Duda si primero debe actualizar o planificar.
2. Ve sede, flechas, fecha y tres horizontes. Cambia a mañana, pero “Hoy” sigue visualmente seleccionado porque el preset significa un día anclado, no necesariamente hoy. Interpreta que quizá ha hecho algo mal.
3. Ve “Más filtros”. No sabe si Hermes planifica todo o solo lo filtrado ni si debe abrirlo.
4. El tutorial permanente le dice que debe “personalizar edificios” antes de automatizar. Puede abandonar el happy path y entrar en una configuración maestra que no necesita hoy.
5. “Qué necesita atención” presenta entradas tempranas, casas grandes, capacidad y edificios antes de que Hermes intente resolver nada. La usuaria siente que debe resolverlo manualmente.
6. El panel Hermes ofrece “Resumen”, “Explicar pendientes” y conversación avanzada, pero el CTA principal está arriba. Duda cuál inicia realmente el plan.
7. El panel vacío “Plan recomendado” vuelve a decirle que use el botón de arriba; debe recordar y desplazarse.
8. La cola “Decisiones pendientes” ya ofrece selectores y botones manuales. Puede empezar a asignar manualmente y disparar notificaciones fuera del sandbox.
9. Tras planificar, la propuesta aparece mucho más abajo sin cambio claro de contexto ni auto-scroll.
10. Ve métricas como “Score”, “centros divididos”, “divisiones evitables”, “backups usados” y porcentajes de confianza. No sabe qué umbral es aceptable.
11. En el sandbox ve badges “Ya asignada”, “Cambio manual”, “Hermes”, no el semáforo operativo prometido de titular/suplente/sin cubrir.
12. Para reasignar debe localizar un select incrustado en una tarjeta estrecha; en móvil la vista por columnas requiere desplazamiento horizontal.
13. “Revisar y confirmar” parece aprobar, pero solo abre otro modal.
14. El modal repite todo y obliga a confirmar de nuevo.
15. No existe “Rechazar”; “Limpiar plan” puede significar borrar, rechazar o simplemente ocultar.

## Fricciones ordenadas por gravedad

### Alta

1. **Dos flujos competidores en la misma pantalla:** automático y asignación manual directa. Riesgo de guardar/notificar antes de revisar sandbox.
2. **El resultado no sustituye a la pantalla inicial:** aparece debajo del dashboard y obliga a buscarlo mediante scroll.
3. **Horizonte ambiguo:** fecha mañana con preset visual “Hoy”. Requiere conocer el modelo interno.
4. **Configuración maestra dentro del camino diario:** “Personalizar edificios” parece obligatoria antes de planificar.
5. **No existe rechazo explícito:** no está claro cómo descartar la propuesta.
6. **Rojos no representados con semáforo operativo unificado:** conflictos, no asignadas y bloqueos aparecen en lugares distintos.

### Media

7. **Confirmación duplicada:** dos botones para una única decisión.
8. **Jerga sin criterio de acción:** score, confianza, backups, centros/divisiones.
9. **Demasiados resúmenes duplicados:** KPIs, workflow, atención, copilot, propuesta vacía y cola.
10. **Reasignación móvil poco directa:** selector dentro de columnas horizontales; no existe tap → candidatos.
11. **Explicabilidad invasiva:** razones, warnings y calidad están visibles aunque no se soliciten.
12. **“Limpiar plan” aparece en dos lugares cuando existe propuesta.**

### Baja

13. Actualizar ocupa el mismo nivel visual que la acción principal.
14. Textos instructivos permanentes consumen altura y generan más scroll.
15. La vista muestra datos de capacidad antes de que sean necesarios para aprobar.

## Términos que requieren explicación y, por tanto, son defectos de diseño

- Horizonte.
- Capacidad (% sin contexto de umbral).
- Personalizar edificios.
- Backup.
- Score global.
- Centros divididos.
- Divisiones evitables.
- Confianza porcentual.
- Sandbox visual.
- Plan desactualizado/context key (aunque el texto visible evita el término técnico, la consecuencia no ofrece acción directa).
- Limpiar plan.

## Resultado del test

**Fricciones altas: 6.**
**La coordinadora no completaría el flujo con confianza sin formación.**

# Restricciones confirmadas para la siguiente fase

- No modificar el motor de asignación ni sus reglas.
- No eliminar capacidades: filtros, configuración, explicabilidad y edición sobreviven bajo divulgación progresiva.
- No reutilizar drag & drop del calendario productivo dentro del sandbox si implica persistencia o complejidad; móvil debe priorizar tap → candidato.
- El sandbox debe seguir siendo local hasta aprobación final; “persistir en background” se interpreta como estado local optimista, no escritura productiva por cada edición.
- La aprobación debe seguir ejecutando validación fresca y batch apply existentes.
