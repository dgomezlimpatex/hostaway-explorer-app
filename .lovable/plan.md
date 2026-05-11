
# Importar empleados desde REGISTRO sin perder tareas (v2)

## Cambio clave respecto a la v1

Los nombres de las trabajadoras en GESTIÓN **coinciden con los de REGISTRO**, pero los emails **NO siempre coinciden** (los de GESTIÓN se han ido completando a mano para turismo y son el dato fiable de contacto).

Consecuencias para el plan:

1. **El match principal NO se hace por email.** Se hace por **nombre normalizado** (trim, lower, sin acentos, espacios colapsados) en el Paso 4 de vinculación asistida.
2. **El email de GESTIÓN nunca se sobreescribe.** Aunque REGISTRO mande un email distinto o vacío, en GESTIÓN se conserva el actual. Lo mismo aplica a `telefono`.
3. **El email de REGISTRO se ignora durante la sincronización** (no se guarda como sombra en otra columna; mantenemos una sola fuente de verdad para email = GESTIÓN).

Todo lo demás del plan v1 sigue en pie.

## Garantías que NO cambian

- Nunca se borra un cleaner. Nunca se reemplaza su `id`. Nunca se actualiza la tabla `tasks` durante la sincronización. → tus tareas asignadas no se pierden bajo ningún supuesto.
- `tasks.cleaner_id` con `ON DELETE SET NULL` ya blindado.
- Sincronización solo desactiva (`is_active=false`), nunca borra.

## Pasos (resumen)

### Paso 0 — Backup y contadores
- Export CSV de `cleaners` y `tasks` desde Supabase Dashboard.
- Apuntar: nº cleaners activos, nº tareas con `cleaner_id`, nº tareas por cleaner.

### Paso 1 — Secret
Añadir `EMPLOYEES_API_TOKEN`. Cero código.

### Paso 2 — Migración aditiva
Solo añadir columnas nullables a `cleaners` (`external_id`, `first_name`, `last_name`, `dni`, `pin`, `category`, `delegation_name`, `office_name`) y crear tabla `employee_sync_log`. **No se toca** `name`, `email`, `telefono`, `sede_id`, `id`. Reversible con `DROP COLUMN`.

### Paso 3 — Edge function en dry-run
Función `sync-employees-from-registro` desplegada con `dry_run: true` por defecto. Solo lee REGISTRO y devuelve un informe sin escribir.

### Paso 4 — Vinculación asistida (UI en `/integraciones`)
Tabla con propuestas de match. **Algoritmo de match** en este orden:

1. **Match exacto por nombre normalizado** (trim + lower + sin acentos + espacios colapsados) → propuesta verde, marcada para vincular automáticamente.
2. **Match por nombre similar** (Levenshtein ≤ 2 o coincidencia de `first_name + last_name`) → propuesta amarilla, requiere confirmación tuya.
3. **Sin match** → propuesta de crear cleaner nuevo en GESTIÓN.
4. Email de REGISTRO se muestra como referencia visual, **no se usa para matchear** ni se copia a GESTIÓN.

UI:
```text
REGISTRO                            GESTIÓN                       Match     Acción
─────────────────────────────────  ────────────────────────────  ───────   ──────────────────
KIANAY (kianay@registro.com)       KIANAY (kianay@personal.com)  ✅ nombre [Vincular] [Ignorar]
JOSE LUIS (jl@registro.com)        JOSÉ LUIS (jose@personal.com) ⚠️ ~      [Vincular] [Ignorar]
MARIA NUEVA (maria@registro.com)   —                             ➕ nuevo  [Crear]    [Ignorar]
```

Al pulsar **Vincular** → solo se rellena `external_id` en el cleaner existente. Email/teléfono/sede/avatar/horas/etc. **intactos**. Cero cambios en `tasks`.

Decisiones se registran en `employee_sync_log.errors` (con tipo `link_decision`) y son auditables.

### Paso 5 — Primera sincronización real
Botón "Sincronizar ahora" ya en modo escritura, con estas reglas en la edge function:

- **Solo procesa cleaners con `external_id` ya vinculado** (los del Paso 4).
- **Campos que SÍ se actualizan** desde REGISTRO: `name` (cuando cambia), `first_name`, `last_name`, `dni`, `pin`, `category`, `delegation_name`, `office_name`, `is_active`, `start_date` (= `hire_date`).
- **Campos que NUNCA se tocan**: `email`, `telefono`, `sede_id`, `avatar`, `sort_order`, `contract_hours_per_week`, `hourly_rate`, `contract_type`, contactos de emergencia, `id`, `user_id`.
- **Tabla `tasks`: nunca se toca.**
- Si un cleaner con `external_id` no aparece en la respuesta de REGISTRO → no se hace nada (no se desactiva por omisión).
- Si REGISTRO devuelve `is_active=false` → en GESTIÓN se hace `is_active=false`. Las tareas históricas y futuras se conservan.

Verificación post-sync:
- Repetir contadores del Paso 0 → tareas por cleaner deben ser idénticas.
- Revisión visual del calendario.
- Comprobar manualmente que **emails y teléfonos en GESTIÓN no han cambiado** (te paso una query rápida).

### Paso 6 — Endurecimiento de formularios
Si `external_id IS NOT NULL`, en el modal de cleaner:
- **Solo lectura**: `name`, `first_name`, `last_name`, `dni`, `pin`, `category`, `delegation_name`, `office_name`, `start_date`, `is_active`.
- **Editables en GESTIÓN**: `email`, `telefono`, `sede_id`, `avatar`, `sortOrder`, `contractHoursPerWeek`, `hourlyRate`, `contractType`, contacto emergencia, asignaciones, disponibilidad, ausencias.
- Botón eliminar deshabilitado con tooltip "Gestionado desde REGISTRO".

### Paso 7 — Cron diario 04:00 Madrid
Solo cuando llevemos 2-3 días de syncs manuales sin incidencias.

## Lo que empiezo ahora mismo

1. Pedirte el secret `EMPLOYEES_API_TOKEN` (con el valor `re_QPwaQ16L_MLpZRnzA9sGW7CG6Kn74hzQo`).
2. Migración aditiva (Paso 2).
3. Edge function en dry-run (Paso 3).
4. Página `/integraciones` con la tabla de vinculación (Paso 4).

Y paramos antes de la primera escritura real (Paso 5) para que tú revises los matches uno a uno.
