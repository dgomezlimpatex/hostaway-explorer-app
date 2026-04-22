

## Problema detectado

Cuando un admin abre el modal "Editar Tareas del Enlace" desde móvil y desmarca propiedades para excluirlas del reparto, los cambios se guardan correctamente en `snapshot_task_ids`. **Sin embargo, las propiedades vuelven a aparecer al poco tiempo** (al refrescarse el listado o al entrar otro usuario).

## Causa raíz

Hay dos mecanismos que están deshaciendo la exclusión manual:

1. **El "auto-merge" silencioso de tareas nuevas** (en `LaundryShareManagement.tsx` → `LinkCard`):
   - Cuando detecta que existe alguna reserva nueva en el rango de fechas (cualquiera, no necesariamente recién creada), dispara `applyTaskChanges` en modo `merge`.
   - El modo `merge` (en `useLaundryShareLinks.ts`) hace la **unión completa** de `existingSnapshotIds + currentTaskIds`. Esto **vuelve a meter en el snapshot todas las tareas excluidas manualmente**, porque `currentTaskIds` contiene también las que el admin acababa de quitar.
   - Además, el merge sobrescribe `original_task_ids = currentTaskIds`, perdiendo el baseline real.

2. **El modal de edición no actualiza `original_task_ids`** al guardar (`LaundryShareEditModal.tsx` línea 131):
   - Solo modifica `snapshot_task_ids`.
   - Como `original_task_ids` sigue conteniendo todas las tareas originales, el sistema no marca a las tareas excluidas como "ya conocidas". En el siguiente ciclo, al unirse con `currentTaskIds`, vuelven al snapshot.

Resultado: cualquier exclusión manual queda revertida en segundos por el auto-merge.

## Solución propuesta

### Cambio 1 — `useLaundryShareLinks.ts` (modo `merge` correcto)

El merge debe añadir **únicamente las tareas verdaderamente nuevas** (las que no estaban en `originalTaskIds`), no la totalidad de `currentTaskIds`. La firma de la mutación pasará a aceptar también `originalTaskIds`:

```text
nextSnapshot = existingSnapshotIds ∪ (currentTaskIds \ originalTaskIds)
```

Así se preservan las exclusiones manuales y solo se incorporan las reservas que aparecieron después de la última edición.

### Cambio 2 — `LaundryShareManagement.tsx` (auto-merge bien parametrizado)

`handleAutoMergeNewTasks` y la llamada desde `LinkCard` pasarán `link.originalTaskIds` para que el merge sepa qué es "nuevo" de verdad.

### Cambio 3 — `LaundryShareEditModal.tsx` (guardar baseline al editar)

Al guardar la edición manual, además de actualizar `snapshot_task_ids` se actualizará `original_task_ids` con el listado actual completo de tareas del rango. Esto reinicia el baseline: a partir de ese momento, las tareas excluidas dejan de considerarse "nuevas" y el auto-merge no las re-añade.

### Cambio 4 — Invalidación de caché

Tras guardar, invalidar también `share-link-changes` para que el badge de "Cambios pendientes" y el auto-merge usen el nuevo baseline inmediatamente.

## Archivos que se modificarán

- `src/hooks/useLaundryShareLinks.ts` — corregir lógica del modo `merge` y aceptar `originalTaskIds` como parámetro.
- `src/pages/LaundryShareManagement.tsx` — propagar `originalTaskIds` al `applyTaskChanges` desde `handleAutoMergeNewTasks` / `LinkCard`.
- `src/components/laundry-share/LaundryShareEditModal.tsx` — actualizar `original_task_ids` además de `snapshot_task_ids` al guardar, e invalidar la query `share-link-changes`.

## Resultado esperado

- Cuando el admin desmarca propiedades en el modal y guarda, esas propiedades **dejan de aparecer permanentemente** en la vista pública del repartidor.
- Las reservas verdaderamente nuevas (creadas después de la edición) se siguen añadiendo automáticamente al enlace, sin tocar las exclusiones manuales.
- No se requiere ningún cambio en base de datos ni en las edge functions.

