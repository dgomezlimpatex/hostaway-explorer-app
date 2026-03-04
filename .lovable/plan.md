

## Plan: Simplificar el sistema de checklist para administradores

### Problema identificado

El flujo actual para administradores requiere **3 pasos separados** en diferentes páginas:
1. Ir a la página de "Plantillas de Checklist" y crear una plantilla con categorías, items, flags de requerido/foto
2. Ir a la lista de Propiedades
3. Abrir un modal para asignar la plantilla a la propiedad

Esto es demasiado complejo. Además, no se puede copiar fácilmente una checklist de una propiedad a otra.

### Nuevo diseño propuesto

**Principio: la checklist se gestiona directamente desde la propiedad.**

#### 1. Eliminar la página separada de plantillas

- La página `/checklist-templates` deja de ser el punto principal de gestión
- Las plantillas siguen existiendo en la base de datos (se reutilizan las tablas existentes), pero se gestionan **inline** desde la propiedad

#### 2. Nuevo flujo integrado en PropertyList

Cada propiedad mostrará:
- Si tiene checklist: un resumen compacto (nombre + N tareas) con botones "Editar" y "Copiar a otra propiedad"
- Si no tiene checklist: un botón "Crear Checklist" o "Copiar de otra propiedad"

#### 3. Editor de checklist simplificado (modal)

Reemplazar el formulario actual (`ChecklistTemplateForm`) con un editor más directo:
- **Sin selector de "tipo de propiedad"** (ya está asociada a la propiedad directamente)
- **Lista plana de tareas** con opción de agrupar por categoría (pero no obligatorio)
- Cada tarea: nombre + toggle "Foto requerida" + toggle "Obligatorio"
- Drag-to-reorder (o flechas arriba/abajo para simplicidad)
- Botón "Añadir tarea" siempre visible al final

#### 4. "Copiar checklist de otra propiedad"

Nuevo flujo donde el admin:
1. Selecciona una propiedad origen (de un dropdown que muestra solo propiedades con checklist)
2. Se copia la plantilla como una nueva plantilla asociada a la propiedad destino
3. Puede editar la copia inmediatamente

### Cambios técnicos

**Archivos a modificar:**
- `src/components/properties/AssignChecklistModal.tsx` -- Reescribir como modal completo con editor inline + opción "copiar de propiedad"
- `src/components/properties/PropertyChecklistInfo.tsx` -- Añadir botón "Editar" inline
- `src/components/properties/PropertyList.tsx` -- Simplificar botón de checklist, eliminar modal separado de asignar

**Archivos a crear:**
- `src/components/properties/PropertyChecklistEditor.tsx` -- Editor simplificado de checklist integrado en modal
- `src/components/properties/CopyChecklistFromProperty.tsx` -- Componente para seleccionar propiedad origen y copiar su checklist

**Archivos existentes que se reutilizan sin cambios:**
- `src/services/storage/checklistTemplatesStorage.ts` -- CRUD de plantillas (se reutiliza)
- `src/services/storage/propertyChecklistStorage.ts` -- Asignaciones (se reutiliza)
- `src/hooks/useChecklistTemplates.ts` -- Hooks de React Query (se reutilizan)
- `src/hooks/usePropertyChecklists.ts` -- Hooks de asignación (se reutilizan)
- `src/types/taskReports.ts` -- Tipos (se reutilizan)

**Base de datos:** Sin cambios. Se reutilizan `task_checklists_templates` y `property_checklist_assignments`.

**Flujo de datos:**
1. Admin abre checklist de propiedad X
2. Si no existe: se crea una nueva plantilla con `template_name = property.nombre` y se asigna automáticamente via `property_checklist_assignments`
3. Si existe: se carga la plantilla asignada y se edita directamente
4. Al "copiar de propiedad": se duplica la plantilla y se asigna a la propiedad destino

### Lo que NO cambia

- La experiencia del limpiador (ChecklistSection, SequentialTaskReport, etc.)
- Las tablas de la base de datos
- El sistema de reportes de tareas
- La lógica de validación y autoguardado

