# Paso 6 — Endurecimiento de formularios de trabajador

Objetivo: cuando un trabajador tenga `external_id` (vinculado a REGISTRO), proteger los campos que gestiona REGISTRO para que no se puedan editar ni borrar accidentalmente desde GESTIÓN. El resto sigue editable.

## Reglas

**Campos solo lectura** (cuando `externalId` existe):
- `name`, `first_name`, `last_name`
- `dni`, `pin`
- `category`
- `delegation_name`, `office_name`
- `start_date`
- `is_active` (se gestiona desde REGISTRO; ver excepción abajo)

**Campos editables en GESTIÓN** (siempre):
- `email`, `telefono`
- `sede_id`, `avatar`, `sortOrder`
- `contractHoursPerWeek`, `hourlyRate`, `contractType`
- Contacto de emergencia
- Asignaciones, disponibilidad, ausencias, vacaciones

**Botón Eliminar**: deshabilitado con tooltip "Gestionado desde REGISTRO. Si quieres ocultarlo, usa Desactivar".

**Excepción `is_active`**: lo dejamos solo lectura en el formulario, pero el botón "Desactivar/Reactivar" de la lista sigue funcionando. Razón: si REGISTRO marca `is_active=true` y tú desactivas en GESTIÓN, en la próxima sync REGISTRO sobreescribirá. Lo aceptamos como comportamiento correcto (REGISTRO manda) y mostramos un aviso al desactivar trabajadores vinculados.

## Cambios por archivo

1. **`src/components/workers/EditWorkerModal.tsx`**
   - Detectar `worker.externalId`.
   - Si existe: marcar inputs de campos REGISTRO como `disabled` + añadir tooltip "Sincronizado desde REGISTRO".
   - Mostrar banner informativo arriba (ya existe el bloque verde — añadir texto explicando que esos campos son solo lectura).

2. **`src/components/workers/WorkerBasicInfo.tsx`**
   - Si recibe un worker con `externalId`, marcar los mismos campos como readonly visualmente (icono 🔒 al lado del label).

3. **`src/components/workers/WorkersList.tsx`** (mobile + desktop)
   - Botón Eliminar: si `worker.externalId`, renderizar deshabilitado con tooltip "Gestionado desde REGISTRO".
   - Botón Desactivar: añadir aviso en `DeactivateWorkerDialog` cuando el trabajador esté vinculado ("La próxima sincronización con REGISTRO podría reactivarlo si allí sigue activo").

4. **`src/components/workers/DeactivateWorkerDialog.tsx`**
   - Añadir aviso condicional cuando `worker.externalId` exista.

## Lo que NO se toca

- Edge function `sync-employees-from-registro`: ya respeta los campos correctos, no necesita cambios.
- Base de datos: cero migraciones.
- `tasks`: nada cambia.

## Verificación

- Abrir un trabajador vinculado (badge 🔗 REGISTRO): comprobar que name/DNI/PIN/categoría/delegación/oficina están grises y no editables.
- Abrir un trabajador NO vinculado: todo editable como antes.
- Botón Eliminar deshabilitado solo en vinculados.
- Editar email/teléfono/sede en un vinculado: debe guardar correctamente.

¿Procedo a implementar?
