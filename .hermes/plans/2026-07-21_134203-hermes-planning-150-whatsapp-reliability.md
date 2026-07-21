# Planificación Hermes 150 + WhatsApp Reliability Implementation Plan

> **For Hermes:** Use `subagent-implementation-workflows` to implement this plan by verified waves, with isolated worktrees and cross-seam contract tests.

**Goal:** Aplicar de forma atómica, idempotente y auditable hasta 150 tareas desde Planificación Hermes y entregar todos los avisos WhatsApp correctos sin pérdidas, cruces, avisos parciales ni duplicados.

**Architecture:** Mantener `planning_runs`/`planning_run_items` como propuesta y crear `planning_apply_batches`/`planning_apply_batch_items` como ledger inmutable de aplicación. Una única RPC `apply_planning_batch` bloquea, revalida y aplica recurrencias, horarios, asignaciones y outbox dentro de una sola transacción lógica; un bloque PL/pgSQL interno revierte todas las mutaciones ante error y conserva un resultado de batch auditable cuando sea posible. Después del commit, un dispatcher batch-aware reclama trabajo con leases y `SKIP LOCKED`, procesa con concurrencia acotada y serialización por destinatario, y concilia cada cambio neto con su delivery/callback.

**Tech Stack:** React/Vite/TypeScript, Supabase/PostgreSQL, PL/pgSQL, Edge Functions Deno, `pg_cron`/`pg_net`, WhatsApp Cloud API, scripts Node con `node:assert/strict`.

---

## 0. Decisiones no negociables

- [ ] La aplicación de 150 tareas debe ser **todo o nada**.
- [ ] Ninguna llamada a Meta o Resend se realiza dentro de la transacción de planificación.
- [ ] Los eventos del outbox solo son visibles después del commit.
- [ ] Un retry con la misma clave idempotente devuelve el resultado anterior; no repite escrituras.
- [ ] Se preservan asignaciones multioperaria y el orden final de trabajadores.
- [ ] Las recurrencias se materializan dentro de la misma transacción del batch.
- [ ] El backend revalida sede, estado, versión, responsables esperados y teléfono; no confía únicamente en el frontend.
- [ ] Si la política es `require_all_recipients`, un solo trabajador sin móvil válido bloquea el batch completo antes de escribir.
- [ ] `cleaners.telefono` sigue siendo la fuente prioritaria de teléfono.
- [ ] `tasks.cleaner` y `tasks.cleaner_id` quedan como proyección legacy; `task_assignments` es la fuente canónica.
- [ ] Toda cancelación guarda un snapshot inmutable antes de que la tarea pueda desaparecer.
- [ ] Los estados intermedios producidos dentro del batch no generan avisos visibles; solo se publica el diff neto final.
- [ ] Ante resultados inciertos de Meta se conserva la política de máximo dos POST, sin tercer intento ni fallback concurrente.
- [ ] No se activa el nuevo writer en producción hasta completar pruebas 30/70/150 y rollback.
- [ ] Desarrollo, CI, shadow mode y cargas 30/70/150 utilizan provider sink/fake: cero WhatsApps y correos reales.
- [ ] Los E2E reales requieren simultáneamente flag global, modo `live`, número allowlisted de pruebas y credenciales válidas.
- [ ] Existen kill switches independientes para WhatsApp, correo/Resend, recordatorios, worker nuevo y aplicación transaccional de Hermes.
- [ ] La allowlist es exclusivamente de pruebas/canary; la operativa real avisa a todo trabajador con móvil válido, sin opt-in individual.

## 1. Arquitectura objetivo

```text
Propuesta Hermes
  └─ planning_runs / planning_run_items
       ├─ propuesta aprobada por humano
       └─ estado/versiones esperadas

Confirmar reparto
  └─ apply_planning_batch(batch_id, idempotency_key, source_run_id, items)
       ├─ planning_apply_batches: applying
       ├─ advisory locks por sede y trabajador/fecha
       ├─ SELECT tareas FOR UPDATE en orden estable
       ├─ revalidación prospectiva de las 150 tareas
       ├─ materialización de recurrencias
       ├─ UPDATE set-based de horarios
       ├─ diff set-based de task_assignments
       ├─ cálculo neto before/after
       ├─ notification_events con snapshot + batch_id
       ├─ planning_notification_batches/dispatches
       ├─ planning_apply_batches: applied
       ├─ planning_runs.applied_batch_id
       └─ COMMIT único

Tras commit
  └─ process-pending-whatsapp-notifications
       ├─ claim RPC + FOR UPDATE SKIP LOCKED
       ├─ concurrencia global acotada
       ├─ serialización/pacing por destinatario
       ├─ timeout por llamada
       ├─ Meta
       ├─ webhook durable
       └─ conciliación batch: expected = terminal
```

## 2. Contrato backend propuesto

### 2.1 Separar propuesta, aplicación y entrega

Reutilizar el dominio existente donde representa correctamente la propuesta, y añadir un ledger de aplicación independiente:

- `planning_runs` / `planning_run_items`: propuesta generada, revisión humana y versión de origen.
- `planning_apply_batches`: intento idempotente de aplicar una propuesta.
- `planning_apply_batch_items`: estado esperado, resultado y snapshots por tarea/ocurrencia.
- `planning_assignment_audit`: auditoría inmutable de before/after.
- `planning_conflicts`: conflictos de propuesta o aplicación.
- `notification_events`: eventos de dominio granulares por cambio neto.
- notificación lógica/dispatch: lo que todavía tiene sentido comunicar tras supersesión/consolidación.
- `notification_deliveries`: cada efecto externo concreto.
- callback inbox: recepción durable, deduplicada y monotónica de Meta.

### 2.2 Campos y tablas aditivos previstos

#### `tasks`

- [ ] `planning_version bigint NOT NULL DEFAULT 0`.
- [ ] Incrementar versión ante cualquier cambio operativo relevante mediante trigger central.
- [ ] Usar `planning_version`, no solo `updated_at`, para control optimista.

#### `planning_runs`

- [ ] Mantener estados de propuesta.
- [ ] Añadir `version bigint NOT NULL DEFAULT 0`.
- [ ] Añadir `applied_batch_id uuid null`.

#### `planning_apply_batches`

- [ ] `id uuid` proporcionado por cliente para retry tras timeout.
- [ ] `sede_id`, `source_run_id`, `source_run_version`.
- [ ] Permitir `source_run_id = null` durante la transición del planificador conectado actual; hacerlo obligatorio cuando ambos motores queden unificados.
- [ ] `idempotency_key`, `request_hash`, actor y timestamps.
- [ ] Estados `applying`, `applied`, `validation_failed`, `technical_failed`.
- [ ] `expected_task_count`, `expected_assignment_count` y `notification_policy`.
- [ ] `result_summary`, `failure_code`, `failure_summary` sin PII.
- [ ] Índices únicos por `batch_id` y ámbito de `idempotency_key`.

#### `planning_apply_batch_items`

- [ ] Tarea existente o clave de ocurrencia recurrente.
- [ ] `expected_planning_version`.
- [ ] Estado/horario/asignaciones esperadas.
- [ ] Horario/asignaciones propuestos.
- [ ] `before_snapshot`, `after_snapshot`, `apply_status`, `conflict_code`.
- [ ] Unique determinista por batch + tarea/ocurrencia.

#### `notification_events`

- [ ] `batch_id uuid null` y generación lógica tarea/asignación.
- [ ] `snapshot jsonb` suficiente para enviar después de hard-delete.
- [ ] `recipient_worker_id`, teléfono resuelto/routing version auditables sin exponer PII en UI.
- [ ] Si el teléfono canónico cambia antes de iniciar el POST, rerouting explícito y auditado al mismo trabajador; nunca sustitución silenciosa por otro destinatario.
- [ ] `superseded_by`, `dispatch_id`, `recipient_sequence`, `not_before`.
- [ ] `notification_mode`: `shadow`, `test`, `live`.
- [ ] Estados terminales `superseded` y `dead_letter`.

#### `planning_notification_batches` o dispatch equivalente

- [ ] Channel-aware: `channel`, `event_type`, `chunk_index`, `recipient_key`.
- [ ] `notification_event_ids uuid[]` para trazabilidad granular.
- [ ] Lease: `claim_token`, `claimed_at`, `lease_expires_at`.
- [ ] `provider_post_count` durable por efecto lógico/generación.
- [ ] Estados `collecting`, `pending`, `processing`, `sent`, `failed`, `dead_letter`, `superseded`.
- [ ] `notification_key` única e idempotente.

### 2.3 RPC única — aplicación atómica

```sql
apply_planning_batch(
  _batch_id uuid,
  _idempotency_key text,
  _sede_id uuid,
  _source_run_id uuid,
  _source_run_version bigint,
  _request_hash text,
  _notification_policy text,
  _items jsonb
) returns jsonb
```

Checklist de contrato y seguridad:

- [ ] Autorizar solo `admin`/`manager` y pertenencia a sede mediante comprobación interna.
- [ ] Revocar ejecución a `PUBLIC` y `anon`; fijar `search_path` seguro.
- [ ] Validar con rol `authenticated`, no solo service role.
- [ ] Rechazar 0 items o más de 500; SLO certificado para 150.
- [ ] Validar schema JSON, duplicados y representación canónica.
- [ ] Calcular/verificar `request_hash` en servidor.
- [ ] Misma key + mismo hash devuelve el resultado anterior con `idempotent_replay=true`.
- [ ] Misma key + hash distinto devuelve `IDEMPOTENCY_CONFLICT` sin escribir negocio.
- [ ] Un bloque PL/pgSQL interno revierte todas las mutaciones de negocio ante error y permite registrar el batch fallido cuando la transacción exterior siga viva.

Checklist transaccional:

- [ ] Bloquear/idempotentizar el batch.
- [ ] Tomar advisory locks en orden estable: sede, trabajador/fecha y tareas.
- [ ] Todos los writers canónicos manuales deben respetar los mismos locks relevantes.
- [ ] Cargar tareas con `FOR UPDATE` y verificar exactamente el conjunto esperado.
- [ ] Construir primero el estado final prospectivo completo.
- [ ] Revalidar `planning_version`, sede, estado, tareas bloqueadas/iniciadas/completadas/canceladas.
- [ ] Revalidar trabajadores activos, sede, `No apta`, disponibilidad y ausencias.
- [ ] Revalidar solapes internos y contra tareas fuera del lote.
- [ ] Revalidar capacidad, duración multioperaria y ventana checkout→check-in.
- [ ] Revalidar teléfono con el resolver canónico (`telefono` y fallback técnico permitido por contrato).
- [ ] Ante cualquier conflicto, devolver todos los conflictos y aplicar 0 tareas.
- [ ] Materializar recurrencias con unique `(recurring_task_id, execution_date)`.
- [ ] Aplicar horarios y `task_assignments` set-based.
- [ ] Sincronizar columnas legacy solo como proyección.
- [ ] Calcular diff neto `assigned`, `cancelled`, `modified`, `unchanged`.
- [ ] Eliminar/superseder eventos intermedios del batch antes del commit.
- [ ] Insertar eventos granulares, notificaciones lógicas y dispatches en modo configurado.
- [ ] Encolar también el correo backend; retirar el envío de correo iniciado desde el navegador.
- [ ] Marcar batch e items, enlazar `planning_runs.applied_batch_id` y devolver contadores exactos.
- [ ] Enlazar `planning_runs.applied_batch_id` solo cuando exista `source_run_id`; el batch conserva siempre su payload/auditoría propios.
- [ ] Objetivo inicial de rendimiento: p95 de aplicación DB <5 segundos para 150 tareas con dataset representativo.

### 2.5 Contexto de trigger durante el batch

- [ ] Añadir un contexto transaccional `planning_batch_id` utilizado solo para etiquetar eventos del batch.
- [ ] Los triggers existentes deben incluir `planning_batch_id` en los eventos temporales.
- [ ] Antes del commit, la RPC sustituye los eventos intermedios por el diff neto final.
- [ ] Ningún evento intermedio es visible fuera de la transacción.
- [ ] Añadir prueba de seguridad para impedir que un cliente pueda usar el contexto para silenciar avisos fuera de la RPC.

## 3. Checklist por fases

## Fase 0 — Baseline, flags y contratos

**Objetivo:** preparar una migración reversible sin alterar producción.

- [ ] Crear rama de integración `feature/hermes-planning-150-integration` desde `origin/main` limpio.
- [ ] Capturar baseline: typecheck, build y suites de planificación/WhatsApp.
- [ ] Corregir primero el contrato obsoleto de `test:cleaning-planning-domain-safety`.
- [ ] Añadir flags separados, por defecto `false`:
  - [ ] `VITE_PLANNING_BATCH_V2_READ_ENABLED`
  - [ ] `VITE_PLANNING_BATCH_V2_WRITE_ENABLED`
  - [ ] `WHATSAPP_BATCH_DISPATCH_ENABLED`
  - [ ] `PLANNING_TRANSACTIONAL_APPLY_SHADOW`
  - [ ] `PLANNING_NOTIFICATIONS_LIVE`
- [ ] Añadir kill switches independientes para WhatsApp, Resend/correo, recordatorios y worker v2.
- [ ] Añadir adaptadores provider `shadow`, `test` y `live`; `shadow/test` nunca leen credenciales productivas.
- [ ] Definir en un test cross-seam los nombres exactos de RPC, argumentos, estados y claves de retorno.
- [ ] Confirmar que, con flags apagados, el comportamiento legacy no cambia.

**Archivos probables:**

- `package.json`
- `scripts/cleaningPlanningDomainSafetyTest.entry.ts`
- `src/services/whatsapp/whatsappConfig.ts`
- nuevo `scripts/planningBatchContractTest.mjs`
- nueva migración `supabase/migrations/<timestamp>_prepare_planning_batch_v2.sql`

**Gate:** baseline verde y flags apagados.

## Fase 1 — Reparar cancelación hard-delete y poison events

**Objetivo:** ninguna tarea eliminada deja una asignación vigente en WhatsApp.

- [ ] Escribir test RED: borrar tarea con 1, 3 y 30 asignaciones conserva snapshot de cada cancelación.
- [ ] Añadir snapshot a eventos `task_cancelled` antes de perder la FK.
- [ ] Cambiar sender para construir cancelaciones desde snapshot cuando `task_id` sea null.
- [ ] Cambiar el `catch` global para finalizar fallos pre-delivery de forma bounded, no dejarlos eternamente en `processing`.
- [ ] Añadir `max_attempts`/dead-letter para errores deterministas.
- [ ] Detectar y mostrar eventos `processing` sin delivery.
- [ ] Tras desplegar y verificar, conciliar los dos poison events existentes sin reenvío indiscriminado.

**Archivos probables:**

- `supabase/migrations/20260718193000_enqueue_task_assignment_notifications.sql` mediante nueva migración correctora.
- `supabase/functions/send-whatsapp-notification/index.ts`
- `supabase/functions/process-pending-whatsapp-notifications/index.ts`
- nuevo `scripts/whatsappDeletedTaskCancellationTest.mjs`

**Gate:** una cancelación hard-delete termina `sent/delivered` o `failed/dead_letter` explicable; nunca queda en loop.

## Fase 2 — Canonicalizar todos los writers

**Objetivo:** ninguna asignación puede existir fuera de `task_assignments`.

- [ ] Inventariar nuevamente todos los `.update({ cleaner_id`, `.insert({ cleaner_id` y escrituras de `cleaner`.
- [ ] Migrar `apply-ai-actions` a RPC canónica.
- [ ] Migrar `auto-assign-tasks` y `databaseService` a RPC canónica.
- [ ] Migrar `batch-create-tasks` a una RPC transaccional `create_tasks_with_assignments`.
- [ ] Migrar el segundo motor `operationalPlanningService.approveRun` al batch v2 o desactivar su escritura legacy.
- [ ] Backfill controlado de tareas futuras legacy sin `task_assignments`.
- [ ] Añadir test estático que falle si reaparece una escritura directa a `tasks.cleaner_id/cleaner` en rutas de negocio.
- [ ] Restringir columnas legacy para que sean proyección, no API de escritura.

**Archivos probables:**

- `supabase/functions/apply-ai-actions/index.ts`
- `supabase/functions/auto-assign-tasks/index.ts`
- `supabase/functions/batch-create-tasks/index.ts`
- `src/services/autoAssignment/databaseService.ts`
- `src/services/planning/operationalPlanningService.ts`
- `src/services/storage/multipleTaskAssignmentService.ts`
- nueva migración de backfill/guard.

**Gate:** toda asignación de prueba crea exactamente una fila canónica y un evento; cero future legacy-only.

## Fase 3 — Backend transaccional de Planificación Hermes

**Objetivo:** 150 tareas se aplican en una sola transacción.

- [ ] Crear migración aditiva de `planning_version`, `planning_apply_batches`, `planning_apply_batch_items`, auditoría y vínculos de outbox.
- [ ] Implementar `apply_planning_batch` con idempotencia, subtransacción, locks y revalidación prospectiva.
- [ ] Incluir materialización recurrente en la RPC.
- [ ] Implementar diff neto before/after.
- [ ] Insertar outbox dentro de la misma transacción.
- [ ] Probar fault injection en item 1, 75 y 150.
- [ ] Probar dos commits concurrentes sobre tareas solapadas.
- [ ] Probar retry tras respuesta HTTP desconocida usando la misma idempotency key.
- [ ] Verificar RLS/roles con `SET LOCAL ROLE authenticated` dentro de `BEGIN/ROLLBACK`.

**Gate crítico 150:** fallo inyectado en la tarea 75 produce 0 cambios de tareas, 0 asignaciones nuevas, 0 ejecuciones recurrentes y 0 eventos visibles.

## Fase 4 — Cliente Planificación Hermes sobre batch v2

**Objetivo:** el navegador inicia y observa el batch; no orquesta 150 escrituras.

- [ ] Crear servicio TypeScript con el contrato exacto de `apply_planning_batch` y consulta de estado por `batch_id`.
- [ ] Reemplazar el bucle `executeProposalBatch` cuando el write flag esté activo.
- [ ] Tras la confirmación humana, generar `batch_id`/idempotency key y realizar una única llamada de aplicación.
- [ ] Si la conexión se pierde, consultar estado del `batch_id`; no generar otra clave ni otro batch.
- [ ] Mostrar estados: validando, aplicando, aplicado, conflicto, fallo técnico.
- [ ] Mostrar todos los conflictos antes de cualquier escritura.
- [ ] Bloquear apply cuando `require_all_recipients` detecte móviles ausentes/incorrectos.
- [ ] Mostrar resumen verificable: 150 tareas, N altas, N bajas, N modificaciones, N avisos.
- [ ] Retirar el rollback compensatorio cliente para el flujo v2.
- [ ] Mantener fallback legacy solo detrás del read/write flag durante el canary.

**Archivos probables:**

- nuevo `src/services/planning/planningBatchService.ts`
- `src/hooks/useCleaningPlanningActions.ts`
- `src/utils/cleaning-planning/proposalBatchExecution.ts` (deprecación/fallback)
- `src/components/cleaning-planning/CleaningPlanningPage.tsx`
- componentes de confirmación/progreso del planificador.

**Gate:** cerrar la pestaña tras enviar la RPC no puede dejar un estado parcial; al reabrir se recupera el estado por `batch_id`.

## Fase 5 — Estrategia de mensajes y supersesión

**Objetivo:** evitar spam y mensajes obsoletos sin perder aprobación por tarea.

### Decisión funcional obligatoria

- [ ] Confirmar si la aprobación/rechazo individual de cada tarea por botón WhatsApp sigue siendo obligatoria.

### Modelo recomendado compatible

- [ ] Mantener siempre eventos ledger por tarea-trabajador.
- [ ] Soportar dos estrategias de dispatch:
  - [ ] `individual_actionable`: una plantilla por tarea cuando necesita botones individuales.
  - [ ] `batch_summary`: resumen por trabajador/fecha cuando el aviso es informativo.
- [ ] Si se quiere consolidar también aprobaciones, diseñar primero una vista autenticada o una acción batch con desglose de excepciones; no eliminar botones individuales sin sustituto operativo.
- [ ] Para resumen, chunk por máximo 10 tareas o límite de caracteres validado con Meta.
- [ ] Mantener cancelaciones y alertas urgentes como mensajes individuales; consolidar solo eventos compatibles y no urgentes.
- [ ] Usar señal `planning_batch_committed` para cerrar la colección del lote; no depender de una espera arbitraria para la publicación inicial.
- [ ] Para cambios interactivos fuera del batch, usar una ventana breve y explícita de supersesión/consolidación.
- [ ] Añadir `superseded_by` para A→B→A antes de enviar.
- [ ] No enviar `task_modified` intermedio si el mismo run termina cancelando esa asignación.
- [ ] Ordenar por trabajador, fecha, hora y tipo de transición.
- [ ] Guardar snapshot por cada miembro del resumen.

**Gate:** el conjunto de mensajes representa exactamente el diff final del batch y cada tarea conserva trazabilidad individual.

## Fase 6 — Worker escalable y bounded concurrency

**Objetivo:** drenar 150 tareas y su amplificación sin head-of-line blocking.

- [ ] Crear RPC de claim con `FOR UPDATE SKIP LOCKED`.
- [ ] Reclamar dispatches, no ejecutar una selección no bloqueante seguida de claims individuales.
- [ ] Mantener lease token/fencing por dispatch.
- [ ] Procesar con concurrencia global inicial 8, configurable.
- [ ] Serializar mensajes del mismo destinatario.
- [ ] Asignar `recipient_sequence` y usar `not_before` para preservar orden sin mantener una transacción abierta durante el POST.
- [ ] Añadir pacing y backoff para error Meta `131056`.
- [ ] Añadir `AbortSignal.timeout` a processor→sender y sender→Meta.
- [ ] Clasificar timeouts de efecto incierto sin superar dos POST.
- [ ] Separar presupuesto de acciones manuales, callbacks y mensajes nuevos para que ningún backlog inanice a los demás.
- [ ] Reprogramar trabajo restante sin esperar a que un único cron procese todo.
- [ ] Aumentar claim limit solo después de medir; objetivo inicial 200 dispatches con tiempo límite interno.
- [ ] Aplicar presupuesto interno de 40–45 segundos y devolver/reprogramar claims no iniciados antes de agotar la función.
- [ ] Probar doble invocación concurrente del processor.

**Archivos probables:**

- `supabase/functions/process-pending-whatsapp-notifications/index.ts`
- `supabase/functions/send-whatsapp-notification/index.ts`
- `supabase/functions/_shared/whatsappClient.ts`
- nueva migración de claim/lease/dispatch.

**Gate:** dos processors concurrentes drenan la cola sin enviar dos veces el mismo dispatch.

## Fase 7 — Teléfonos y preflight operativo

**Objetivo:** no confirmar una planificación que no puede avisarse por completo.

- [ ] Corregir operativamente el móvil inválido actual.
- [ ] Completar los teléfonos faltantes desde `/workers`.
- [ ] Añadir validación visible al guardar la ficha.
- [ ] Añadir informe de “trabajadores del lote sin WhatsApp” antes del commit.
- [ ] Con política `require_all_recipients`, bloquear el lote completo si falta uno.
- [ ] Actualizar panel para contar `cleaners.telefono`, no solo `whatsapp_phone_e164`.
- [ ] Mantener fallback técnico solo para registros legacy y hacerlo visible como deuda.
- [ ] Añadir métrica de tareas futuras asignadas a trabajadores no alcanzables.

**Gate:** un lote de 150 no puede pasar a `applied` con un destinatario requerido inválido.

## Fase 8 — Observabilidad y conciliación

**Objetivo:** ninguna pérdida puede permanecer silenciosa.

- [ ] Añadir salud de `notification_events`, no solo deliveries.
- [ ] Contar pending, processing por edad, sin delivery, dead-letter y superseded.
- [ ] Persistir métricas de cada ejecución del processor: claimed, sent, skipped, failed, duration.
- [ ] Crear vista de batch: expected events, dispatches, sent, delivered, read, failed y missing.
- [ ] Alertar cuando `expected != terminal + pending explicable`.
- [ ] Alertar por evento processing >5 minutos y lease repetido.
- [ ] Alertar por cola >200 o oldest pending >5 minutos.
- [ ] Mostrar teléfonos inválidos usando la fuente `/workers`.
- [ ] Añadir búsqueda por `batch_id`, `source_run_id`, tarea y trabajador.
- [ ] No mostrar números completos ni payloads sensibles.

**Archivos probables:**

- `src/hooks/useWhatsAppDeliveryHealth.ts`
- `src/pages/WhatsAppNotifications.tsx`
- `src/components/notifications/WhatsAppStatusPanel.tsx`
- nuevas RPC/vistas administrativas de monitor.

**SLO inicial:**

- 100% de batches aplicados con reconciliación exacta de eventos.
- 0 eventos processing sin explicación >10 minutos.
- Provider accepted p95 <5 minutos para un batch de 150.
- Terminal Meta callback p95 <10 minutos, excluyendo destinatarios/provider explícitamente fallidos.
- 0 duplicados de provider ID y 0 destinatarios cruzados.

## Fase 9 — Matriz de pruebas 1/30/70/150/500

### Transacción

- [ ] 1 tarea normal.
- [ ] 30 tareas, múltiples trabajadores.
- [ ] 70 tareas con recurrencias.
- [ ] 150 tareas con horarios y reasignaciones.
- [ ] 500 items como límite de rechazo/soporte técnico, sin prometer SLO productivo.
- [ ] Fallo en item 1, 75 y 150: rollback total.
- [ ] Pestaña cerrada/conexión cortada durante commit.
- [ ] Retry mismo run/hash.
- [ ] Retry misma key/hash distinto.
- [ ] Dos managers aplicando planes solapados.

### Semántica

- [ ] A→B.
- [ ] A→B→A antes de dispatch.
- [ ] schedule change + reassignment.
- [ ] 1 tarea con 3 operarias.
- [ ] hard-delete con 30 destinatarios.
- [ ] recurrencia materializada y ejecución única.
- [ ] trabajador desactivado entre stage y commit.
- [ ] teléfono eliminado entre stage y commit.

### Cola/Meta

- [ ] 30, 70 y 150 eventos/dispatches.
- [ ] 450 eventos para simular amplificación 3x.
- [ ] 150 tareas de un solo trabajador.
- [ ] 150 tareas distribuidas entre 30 trabajadores.
- [ ] Meta 429, 500, timeout y `131056`.
- [ ] callback antes de persistir provider ID.
- [ ] callbacks duplicados y fuera de orden.
- [ ] processor invocado dos veces en paralelo.
- [ ] un sender lento no bloquea todos los destinatarios.
- [ ] máximo dos POST en efecto incierto.

### E2E

- [ ] Dry-run 30.
- [ ] Dry-run 70.
- [ ] Dry-run 150.
- [ ] Mock provider 150 con callbacks sintéticos firmados/validados en entorno de prueba.
- [ ] E2E real reversible con 1–5 tareas y números internos autorizados.
- [ ] Canary operativo real 30 después de completar teléfonos.
- [ ] Observar delivery/read y conciliación, no solo HTTP 200.

**Scripts propuestos:**

- `scripts/planningBatchContractTest.mjs`
- `scripts/planningBatchTransactionTest.sql`
- `scripts/planningBatchConcurrencyTest.mjs`
- `scripts/whatsappDeletedTaskCancellationTest.mjs`
- `scripts/whatsappBurst150Test.mjs`
- `scripts/whatsappBatchReconciliationTest.mjs`
- `scripts/legacyAssignmentWriterGuardTest.mjs`

## Fase 10 — Rollout expansion/contraction

### Expansion

- [ ] Desplegar tablas/columnas/RPC nuevas con flags apagados.
- [ ] Verificar migración local/remota y permisos reales.
- [ ] Ejecutar `apply_planning_batch` en modo shadow/rollback sobre propuestas reales, sin efectos externos ni mutaciones persistentes de negocio.
- [ ] Comparar diff v2 contra el resultado legacy.
- [ ] Activar lectura v2 para administradores internos.
- [ ] Canary write de 5 tareas en sede controlada.
- [ ] Canary 30.
- [ ] Dry-run 70/150 y E2E controlado.

### Activación

- [ ] Activar writer v2 solo cuando gates 30/70/150 estén verdes.
- [ ] Mantener rollback de flag inmediato.
- [ ] Observar dos ciclos operativos completos.
- [ ] Confirmar reconciliación por `batch_id` y vínculo con `source_run_id`.

### Contraction

- [ ] Retirar bucle cliente y rollback compensatorio.
- [ ] Retirar writers directos legacy.
- [ ] Convertir `tasks.cleaner/cleaner_id` en proyección no escribible.
- [ ] Retirar flags temporales cuando el canary sea estable.
- [ ] Actualizar documentación operativa y runbook de incidencias.

## 4. Reparto entre subagentes

## Wave 1 — Contratos y backend base

### Agente A — Schema/RPC batch

- Worktree: `feature/hermes-150-db`
- Dueño exclusivo de migraciones `planning_*`, RPC `apply_planning_batch` y tests SQL.
- No toca Edge Functions ni UI.

### Agente B — Cancelación/snapshots

- Worktree: `feature/hermes-150-cancellation`
- Sender, snapshot de cancelación, bounded failure y tests.
- Migración separada, posterior/anterior documentada respecto a Agente A.

### Agente C — Writers canónicos

- Worktree: `feature/hermes-150-canonical-writers`
- IA, autoassign, batch-create y guard estático.
- Consume el contrato RPC aprobado; no inventa firmas.

### Agente D — Harness de carga

- Worktree: `feature/hermes-150-load-tests`
- Fixtures, provider mock, tests 30/70/150 y fault injection.
- No cambia producción.

**Integración:** A → cross-contract → B → C → D.

## Wave 2 — Consumidores

### Agente E — Frontend Planificación Hermes

- Adopta `apply_planning_batch`, recuperación por `batch_id` y UI de progreso/conflictos.
- No modifica migraciones.

### Agente F — Processor/dispatcher

- Claim `SKIP LOCKED`, concurrencia, pacing, timeout y retry.
- Usa exactamente los estados/columnas integrados de Wave 1.

### Agente G — Teléfonos/monitor

- Preflight `/workers`, health de eventos y batch reconciliation.
- No altera routing del sender salvo contrato acordado.

**Integración:** schema integrado → F → E → G → cross-seam tests.

## Wave 3 — Revisión y producción

- [ ] Revisor de cumplimiento funcional.
- [ ] Revisor de concurrencia/idempotencia.
- [ ] Revisor de seguridad RLS/PII.
- [ ] Revisor de UX operativa.
- [ ] Verificación final del padre en checkout integrado.
- [ ] Despliegue expansion con flags off.
- [ ] Canary y rollback documentado.

## 5. Gates obligatorios por wave

```bash
npm run typecheck
npm run build
npm run test:cleaning-planning-domain-safety
npm run test:cleaning-planning-apply-compatibility
npm run test:whatsapp-delivery-pipeline
npm run test:whatsapp-delivery-monitor
npm run test:whatsapp-admin-fallback
npm run test:planning-batch-contract
npm run test:planning-batch-concurrency
npm run test:whatsapp-burst-150
npx eslint <touched-files>
git diff --check
```

- [ ] Ejecutar tests en cada worktree.
- [ ] Repetir todos los gates en la rama integrada.
- [ ] Ejecutar cross-contract después de cada cambio de RPC/estado.
- [ ] No confiar únicamente en el resumen del subagente.
- [ ] No desplegar una wave con una suite fallida o no ejecutada.

## 6. Definition of Done

Planificación Hermes se considerará preparada para 150 tareas únicamente cuando:

- [ ] 150 tareas se aplican mediante una única transacción backend.
- [ ] Fault injection 1/75/150 deja cero cambios parciales.
- [ ] Repetir commit no duplica tareas, asignaciones ni eventos.
- [ ] Recurrencias forman parte del mismo commit.
- [ ] No quedan writers activos fuera de `task_assignments`.
- [ ] Cada cambio neto produce exactamente un ledger event.
- [ ] Los eventos intermedios del batch no se envían.
- [ ] Hard-delete conserva cancelación enviable.
- [ ] Todos los destinatarios requeridos tienen teléfono válido o el batch se bloquea.
- [ ] La cola drena 150 y 450 eventos simulados sin duplicados ni starvation.
- [ ] Meta `131056`, 429, timeouts y callbacks fuera de orden tienen resultado bounded y observable.
- [ ] El monitor muestra eventos sin delivery y batches incompletos.
- [ ] Pruebas 30/70/150 verdes en checkout integrado.
- [ ] E2E real controlado alcanza `delivered`/`read`.
- [ ] Rollback por flags ha sido probado.
- [ ] Dos ciclos operativos reales no muestran omisiones, cruces o duplicados.

## 7. Riesgos y decisiones pendientes

- **Aprobación por tarea vs resumen:** no consolidar mensajes accionables hasta decidir cómo se conserva la aprobación/rechazo individual.
- **Tiempo de transacción:** medir 150 y 500; si 150 excede el SLO, optimizar SQL set-based antes de aumentar timeouts.
- **Locks por sede:** serializan commits de planificación intencionadamente; no deben bloquear operaciones no relacionadas.
- **Templates Meta:** cualquier resumen nuevo requiere aprobación y E2E independiente.
- **Datos telefónicos:** la arquitectura no puede sustituir números ausentes; es un gate operativo obligatorio.
- **Legacy:** mantener compatibilidad solo durante expansion; no dejar indefinidamente dos fuentes de asignación.

## 8. Orden recomendado de ejecución

1. Fase 0 — contratos y flags.
2. Fase 1 — hard-delete/poison events.
3. En paralelo: Fase 2 writers canónicos + Fase 3 backend batch + harness de tests.
4. Integrar y cerrar contrato.
5. En paralelo: Fase 4 frontend + Fase 6 worker + Fase 7/8 monitor y teléfonos.
6. Fase 5 estrategia de mensajes, preservando aprobación individual.
7. Fase 9 pruebas 30/70/150/450.
8. Fase 10 rollout expansion/canary/contraction.
