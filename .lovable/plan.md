

## Plan: Limpiadoras preferidas por propiedad

### Concepto
Crear una tabla `property_preferred_cleaners` que vincule directamente propiedades con sus limpiadoras habituales. Al asignar una tarea, las preferidas aparecen primero y destacadas en el selector.

### Cambios necesarios

**1. Base de datos** — Nueva tabla `property_preferred_cleaners`
- Columnas: `id`, `property_id` (uuid, FK → properties), `cleaner_id` (uuid, FK → cleaners), `priority` (int, para ordenar), `notes` (text, opcional — "conoce bien el piso", etc.), `created_at`
- RLS: admin/manager pueden gestionar; supervisores pueden leer

**2. Servicio de storage** — `propertyPreferredCleanersStorage.ts`
- CRUD: `getByPropertyId(propertyId)`, `getByPropertyName(propertyName)`, `assign(propertyId, cleanerId, priority)`, `remove(id)`, `updatePriority(id, priority)`

**3. Hook React** — `usePropertyPreferredCleaners.ts`
- `usePreferredCleaners(propertyId)` para consultar las preferidas
- `useAssignPreferredCleaner()` / `useRemovePreferredCleaner()` mutaciones

**4. UI — Gestión en la ficha de propiedad**
- Nueva sección en `EditPropertyModal` o junto al editor de checklist en `PropertiesPage`: "Limpiadoras preferidas"
- Lista de las asignadas con opción de reordenar prioridad y eliminar
- Botón "Añadir limpiadora" con selector de las disponibles

**5. UI — Modal de asignación de tarea (`AssignCleanerModal` + `AssignMultipleCleanersModal`)**
- Consultar las preferidas del `propertyId` de la tarea
- Dividir la lista en dos secciones: "⭐ Preferidas" (arriba, con badge verde) y "Otras" (abajo)
- Las preferidas aparecen ordenadas por prioridad
- Si hay notas, mostrarlas como tooltip

**6. Auto-asignación** (opcional, fase posterior)
- En `assignmentAlgorithm.ts`, antes del algoritmo de saturación, consultar preferidas de la propiedad y priorizarlas

### Flujo de uso
1. Admin abre la ficha de "Apartamento Marina 3B" → sección "Preferidas" → añade María (P1) y Ana (P2)
2. Cualquier manager crea una tarea para ese piso → al asignar, ve María y Ana destacadas arriba
3. Si ninguna está disponible, sigue viendo el resto de limpiadoras normal

### Archivos a crear
- Migración SQL para `property_preferred_cleaners`
- `src/services/storage/propertyPreferredCleanersStorage.ts`
- `src/hooks/usePropertyPreferredCleaners.ts`
- `src/components/properties/PropertyPreferredCleaners.tsx`

### Archivos a modificar
- `src/components/modals/AssignCleanerModal.tsx` — separar lista en preferidas/otras
- `src/components/modals/AssignMultipleCleanersModal.tsx` — idem
- `src/components/properties/PropertiesPage.tsx` o `EditPropertyModal.tsx` — añadir sección de gestión

