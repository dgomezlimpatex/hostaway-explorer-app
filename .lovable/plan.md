# Rediseño de asignación múltiple de trabajadores

## Por qué falla hoy

Revisé `multipleTaskAssignmentService.ts` y `AssignMultipleCleanersModal.tsx`. El problema raíz no es solo un bug puntual, es que la operación "guardar asignaciones" hace 6-12 llamadas separadas sin transacción:

1. Para cada persona a quitar → `removeCleanerFromTask()` que hace SELECT cleaner + SELECT task + DELETE + SELECT remaining + UPDATE `tasks.cleaner` + INVOKE email.
2. Luego INSERT de los nuevos + INVOKE emails.
3. Finalmente otro UPDATE de `tasks.cleaner` con la lista final.

Consecuencias:
- Cada `removeCleanerFromTask` actualiza `tasks.cleaner` con el "primer asignado restante", y luego la función contenedora lo sobrescribe otra vez. Si una de esas llamadas falla a medias, queda inconsistente.
- `task.cleaner` (texto separado por comas) y `task_assignments` (tabla) pueden divergir → la próxima vez que abres el modal solo ves los de la tabla, pero el calendario sigue mostrando los del string.
- Por eso al "limpiar todo y volver a asignar" sí funciona: estás forzando un estado limpio.
- Los emails de des-asignación se disparan dentro del loop, antes de saber si toda la operación tuvo éxito → spam de "te han desasignado" aunque luego el guardado falle.

## Solución

### 1. Backend: una RPC atómica que reemplaza todo el flujo

Nueva función SQL `set_task_assignments(_task_id uuid, _cleaner_ids uuid[])` que en una sola transacción:

- Lee asignaciones actuales.
- Calcula diff: `added`, `removed`, `kept`.
- `DELETE` solo los `removed`.
- `INSERT` solo los `added` (respeta `UNIQUE(task_id, cleaner_id)`).
- Recalcula `tasks.cleaner` (nombres en el orden de `_cleaner_ids`) y `tasks.cleaner_id` (primero de la lista, o NULL).
- Devuelve `{ added: [{id,name,email}], removed: [{id,name,email}], final: [{id,name}] }` para que el frontend sepa a quién notificar.

`SECURITY DEFINER` con search_path `public`, GRANT EXECUTE a `authenticated`.

### 2. Frontend: servicio reducido + emails desacoplados

`multipleTaskAssignmentService` se simplifica a:

- `getTaskAssignments(taskId)` — igual que ahora.
- `setTaskAssignments(taskId, cleanerIds)` — llama la RPC, recibe el diff, dispara emails (asignación a los `added`, desasignación a los `removed`) en `Promise.allSettled`. Si un email falla no rompe la operación.

Se eliminan `assignMultipleCleaners`, `removeCleanerFromTask`, `clearTaskAssignments` (esta última pasa a ser `setTaskAssignments(id, [])`).

### 3. Frontend: modal rediseñado

Reemplazo de `AssignMultipleCleanersModal` con un flujo más claro:

```text
┌─ Asignar trabajadores ───────────────────────────────┐
│ Tarea: Peruleiro · 28 may · 12:00–16:00              │
│                                                       │
│ Actualmente asignados                                 │
│  [Laura ×] [Vicente ×] [Rhaquel ×]                    │
│  → 1h 20min por persona                               │
│                                                       │
│ Añadir / quitar                                       │
│  ⭐ Preferidos                                         │
│   [✓] Laura    [ ] Pedro    [✓] Vicente               │
│  Otros                                                │
│   [✓] Rhaquel  [ ] Kianay   [ ] Cristian              │
│                                                       │
│ Cambios pendientes                                    │
│  + Pedro                                              │
│  − Rhaquel                                            │
│                                                       │
│ [Cancelar]              [Guardar 2 cambios]           │
└───────────────────────────────────────────────────────┘
```

Detalles:
- Las "fichas" arriba permiten quitar a alguien con un clic (≡ desmarcar abajo). Sincronizadas con el checklist.
- Bloque "Cambios pendientes" calculado en cliente (`added`/`removed` vs estado inicial). Solo se muestra si hay cambios.
- "Guardar" deshabilitado si no hay cambios; texto dinámico ("Guardar 2 cambios" / "Vaciar asignaciones" si queda lista vacía).
- "Guardar" llama `setTaskAssignments`, invalida queries de `tasks`, muestra toast con resumen ("Añadido: Pedro · Quitado: Rhaquel") y cierra.
- Si la operación falla, ningún cambio se aplica (RPC atómica) y el modal se queda abierto con el estado original.
- Mensaje informativo de "duración por persona" recalculado al vuelo según el número de seleccionados (reutiliza la lógica que ya arreglamos para tareas que cruzan medianoche).

### 4. Limpieza

- Eliminar los métodos obsoletos del servicio.
- Donde `TaskDetailsModal` y `TasksPage` invocaban `assignMultipleCleaners` / `clearTaskAssignments`, pasan a `setTaskAssignments`.
- Mantener `task.cleaner` y `cleaner_id` actualizados solo por la RPC (única fuente de verdad: `task_assignments`).

## Detalles técnicos

**SQL — set_task_assignments (resumen):**
```sql
CREATE OR REPLACE FUNCTION public.set_task_assignments(
  _task_id uuid,
  _cleaner_ids uuid[]
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public'
AS $$
DECLARE
  v_current uuid[];
  v_added uuid[];
  v_removed uuid[];
  v_names text;
  v_primary uuid;
BEGIN
  SELECT coalesce(array_agg(cleaner_id), '{}') INTO v_current
    FROM task_assignments WHERE task_id = _task_id;

  SELECT array(SELECT unnest(_cleaner_ids) EXCEPT SELECT unnest(v_current)) INTO v_added;
  SELECT array(SELECT unnest(v_current)   EXCEPT SELECT unnest(_cleaner_ids)) INTO v_removed;

  DELETE FROM task_assignments
    WHERE task_id = _task_id AND cleaner_id = ANY(v_removed);

  INSERT INTO task_assignments (task_id, cleaner_id, cleaner_name, assigned_by)
    SELECT _task_id, c.id, c.name, auth.uid()
    FROM cleaners c WHERE c.id = ANY(v_added);

  -- Recalcular nombres en el orden recibido
  SELECT string_agg(c.name, ', ' ORDER BY arr.ord)
    INTO v_names
    FROM unnest(_cleaner_ids) WITH ORDINALITY AS arr(id, ord)
    JOIN cleaners c ON c.id = arr.id;

  v_primary := _cleaner_ids[1];

  UPDATE tasks
    SET cleaner = NULLIF(v_names,''),
        cleaner_id = v_primary,
        updated_at = now()
    WHERE id = _task_id;

  RETURN jsonb_build_object(
    'added',   (SELECT coalesce(jsonb_agg(jsonb_build_object('id',c.id,'name',c.name,'email',c.email)),'[]'::jsonb)
                FROM cleaners c WHERE c.id = ANY(v_added)),
    'removed', (SELECT coalesce(jsonb_agg(jsonb_build_object('id',c.id,'name',c.name,'email',c.email)),'[]'::jsonb)
                FROM cleaners c WHERE c.id = ANY(v_removed))
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.set_task_assignments(uuid, uuid[]) TO authenticated;
```

(Las constraints existentes `UNIQUE(task_id, cleaner_id)` y `FK ON DELETE CASCADE` ya cubren la integridad.)

**Archivos afectados:**
- Nueva migración con la RPC.
- `src/services/storage/multipleTaskAssignmentService.ts` — simplificado.
- `src/components/modals/AssignMultipleCleanersModal.tsx` — rediseñado con diff visual.
- `src/components/tasks/TasksPage.tsx` y `src/components/modals/TaskDetailsModal.tsx` — solo cambian el nombre del método llamado.
- Sin cambios en `task_assignments` (esquema ya es correcto).
- Sin cambios en las edge functions de email (se siguen usando `send-task-assignment-email` y `send-task-unassignment-email`).

## Fuera de alcance

- No se toca la lógica de cómo se reparte la duración entre N trabajadores (ya arreglada).
- No se cambia el comportamiento de los emails individuales (solo a quién se envían).
- No se toca el flujo de auto-asignación masiva (`BulkAutoAssignButton`).
