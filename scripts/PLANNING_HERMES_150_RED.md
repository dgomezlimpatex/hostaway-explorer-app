# Harness RED — Planificación Hermes 150

Este directorio contiene contratos **deliberadamente RED** sobre la base `94ac1a6d`. No crea stubs de producción, no hace `db push` y no contacta Meta ni Resend.

## Ejecución

```bash
npm run test:planning-hermes-150:red
```

Comandos focales: `test:planning-batch-contract`, `test:planning-batch-transaction`, `test:planning-batch-load`, `test:planning-batch-idempotency`, `test:planning-batch-concurrency`, `test:whatsapp-deleted-task-cancellation`, `test:legacy-assignment-writer-guard`, `test:planning-provider-safety` y `test:whatsapp-burst-150`.

## RED observado en 2026-07-21

Las 8 suites fallan por el contrato ausente, no por errores de sintaxis:

- RPC/migración `apply_planning_batch` ausente (contrato, atomicidad, carga, idempotencia y concurrencia).
- Hard-delete sin snapshot de cancelación consumible.
- Writers IA/autoassign/batch/planning todavía sin delegación canónica.
- Modos `shadow`/`test`/`live`, flags y provider sink todavía ausentes en producción.

El sink aislado sí se autoverificó con `requests=0`; su suite de seguridad permanece RED hasta que los productores enruten explícitamente desarrollo/carga por los modos seguros.

## Condiciones para GREEN tras integrar productores

1. SQL y cliente comparten la firma de ocho argumentos y el resultado tipado de `apply_planning_batch`.
2. La RPC autoriza internamente, revoca `PUBLIC/anon`, usa `search_path` seguro, valida 1..500, bloquea en orden, revalida todo antes de mutar y no contiene efectos HTTP.
3. Los escenarios 1/30/70/150/500 usan operaciones set-based; 70/150 incluyen recurrencias y 150×3 conserva 450 destinatarios.
4. Conflictos colocados en 1/75/150 se detectan antes de la primera escritura; la subtransacción garantiza cero cambios parciales. La comprobación estática de este harness es un gate de estructura, no sustituye la prueba PostgreSQL de dos sesiones/rollback que debe ejecutar el productor de SQL.
5. Misma idempotency key+hash produce replay; key igual+hash distinto produce `IDEMPOTENCY_CONFLICT`; el hash se verifica en servidor.
6. Dos managers sobre tareas solapadas quedan serializados y el segundo revalida `planning_version`.
7. Hard-delete con 1/3/30 destinatarios conserva un snapshot por asignación y el sender funciona con `task_id = null`, con finalización bounded/dead-letter.
8. Los seis writers vigilados delegan en RPC canónica y no escriben directamente `tasks.cleaner`/`tasks.cleaner_id`.
9. `shadow` y `test` no leen credenciales live; existen kill switches separados y las cargas pasan por sink con cero requests externas.

La integración final debe complementar estos contratos estáticos con pruebas reales PostgreSQL en un entorno efímero/no productivo. Un grep verde no demuestra por sí solo atomicidad ni una carrera segura.
