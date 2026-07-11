# Informe final de implementación y verificación — Hermes radicalmente simple

Fecha: 2026-07-11
Worktree: `C:\Users\danig\Downloads\hostaway-hermes-radical-simple`
Rama: `feat/hermes-radical-simple`
Base: `origin/main` (`8491a39d`)

## Resultado ejecutivo

La interfaz diaria de Hermes pasa de un cockpit acumulativo a dos estados excluyentes:

1. **Preparación:** mañana por defecto, fecha, sede cuando hay varias, CTA principal y opciones avanzadas.
2. **Revisión:** propuesta editable, excepciones visibles, descarte y aprobación directa.

Happy path estructural: **2 clics** (`Planificar con Hermes` → `Aprobar y notificar`).
Con cambio de fecha: **3 clics**.
Con una reasignación: **4 clics**.
Contrato de controles iniciales: **5 como máximo en el peor estado condicional**.

## Cambios implementados

- Mañana y rango de un día como valor inicial.
- Nueva portada `PlanningStartScreen`.
- La propuesta reemplaza la portada en vez de añadirse debajo.
- Paneles heredados conservados bajo `Opciones avanzadas`.
- Una sola aprobación final, sin modal redundante.
- Guard síncrono `applyInFlightRef` contra doble tap en el mismo frame.
- Borrador local en `sessionStorage`, aislado por firma de propuesta.
- Descarte explícito sin persistencia previa.
- Aprobación parcial declarada con número cubierto y número sin cubrir.
- Indicador `Alcance parcial: X de Y` antes y después de generar cuando hay filtros efectivos.
- Sede y fecha/rango preservados como contexto.
- Agenda vertical móvil y timeline desktop.
- Reasignación en dos interacciones: tarjeta → responsable.
- Candidatas `No apta` y duplicadas en una tarea multi-persona excluidas.
- `assignmentRole` se actualiza al cambiar candidata; no conserva el rol anterior.
- Casas de 2–3 personas solo cuentan como cubiertas al completar todos los puestos.
- Semáforo textual y por color: titular, suplente/backup, revisado y sin cubrir.
- Asignaciones existentes permanecen neutrales y no editables.
- Explicaciones, avisos y calidad global disponibles bajo detalles.

## Archivos de producto

- `src/components/cleaning-planning/CleaningPlanningPage.tsx`
- `src/components/cleaning-planning/PlanningStartScreen.tsx` (nuevo)
- `src/components/cleaning-planning/AssignmentProposalPanel.tsx`
- `src/components/cleaning-planning/PlanningProposalCalendar.tsx`
- `package.json`

## Contratos y documentación

- `scripts/cleaningPlanningRadicalSimpleContractTest.mjs` (nuevo)
- `scripts/cleaningPlanningUiContractTest.mjs`
- `.hermes/plans/2026-07-11-hermes-radical-simple-audit.md`
- `.hermes/plans/2026-07-11-hermes-radical-simple-decisions-spec.md`
- `.hermes/plans/hermes-radical-simple-engine-baseline.sha256`

## Verificación final ejecutada

### Contratos

Todos terminaron con código 0:

- `cleaningPlanningRadicalSimpleContractTest.mjs` — OK, 5 controles iniciales.
- `cleaningPlanningUiContractTest.mjs` — OK.
- `cleaningPlanningProposalEngineTest.mjs` — OK.
- `cleaningPlanningOperationalFixturesTest.mjs` — OK.
- `cleaningPlanningDomainSafetyTest.mjs` — OK.
- `cleaningPlanningApplyCompatibilityTest.mjs` — OK.

### Calidad estática

- `npm run typecheck` — código 0.
- ESLint focalizado en los cuatro componentes y dos contratos modificados — código 0.
- `git diff --check` — código 0, sin errores.

El lint global no se usa como puerta porque la base ya contiene aproximadamente 738 incidencias fuera de alcance.

### Build

- `npm run build` — código 0.
- 4.338 módulos transformados.
- Build terminado en 15,09 s.

Advertencias preexistentes observadas:

- `caniuse-lite` desactualizado.
- Una advertencia de sintaxis CSS durante minificación (`-: \\s;`).

No bloquearon el build y no proceden de la lógica de planificación modificada.

## Certificación de motor inmutable

`sha256sum -c .hermes/plans/hermes-radical-simple-engine-baseline.sha256`:

- `proposalEngine.ts: OK`
- `proposalBatchApply.ts: OK`
- `proposalBatchExecution.ts: OK`

No existe diff en esos archivos. Se mantienen firma, detección de cambios concurrentes, aplicación secuencial y rollback existentes. La capa UI añade además un veto explícito si el refetch fresco falla.

## Adenda: contraste de la auditoría asíncrona tardía

El lote de onboarding y abogado del diablo terminó después de la primera verificación. Se contrastó contra el árbol final —no contra sus referencias a la interfaz antigua— y se resolvió así:

- **Refetch fresco:** un resultado `isError` o sin `data` aborta antes de `applyProposal`; nunca se usa caché como dato fresco.
- **Tareas multi-persona:** la aprobación parcial filtra por tareas completas (`requiredCleaners`) y excluye del payload a todas las personas de una tarea incompleta.
- **Borradores restaurados/editados:** guardar permanece bloqueado hasta recalcular exclusiones, duplicados y solapes con los datos actuales.
- **Errores de aplicación:** el borrador se conserva y se muestra un estado de error; solo se borra tras una aplicación resuelta.
- **Pendientes visibles:** se eliminó el límite silencioso de nueve limpiezas sin cubrir.
- **Copy veraz:** “Preparar reparto” y “Guardar reparto”; el éxito afirma “avisos iniciados”, no que todos hayan sido entregados.
- **Accesibilidad/onboarding:** etiquetas “Cambiar responsable de …” y fechas completas en español.

No se aplicaron recomendaciones que exigían backend o ampliaban alcance: exclusión global entre coordinadoras, atomicidad transaccional y confirmación individual de entrega de avisos siguen siendo límites explícitos.

## Límites y riesgos restantes

1. **QA autenticada:** el navegador automatizado redirige a login y no comparte la sesión del perfil Edge `Hermes QA Limpatex`. No se afirma validación visual con datos reales.
2. **Concurrencia entre coordinadoras:** el guard evita doble envío local. La exclusión fuerte entre dos pestañas/usuarios requeriría una transacción o compare-and-swap en backend; no se modificó el motor.
3. **Disponibilidad en cambios manuales:** el selector conserva las defensas existentes de `No apta`, duplicados y solapes, y la validación batch sigue siendo autoridad final. No se añadió un nuevo motor de disponibilidad al picker para evitar duplicar reglas.
4. **Autosave:** `sessionStorage` dura la sesión/pestaña, no sincroniza dispositivos y se invalida cuando cambia la firma de origen.
5. **Sin despliegue:** no se hizo commit, push ni despliegue; el resultado permanece en la rama/worktree aislados para revisión.

## Estado de entrega

Código, auditoría, deliberación, especificación y verificación quedan reunidos en el worktree aislado. La única evidencia no disponible es la QA visual autenticada contra datos productivos.
