

## Plan: Convertir la Página de Reportes en una Hoja Editable tipo Excel

### Objetivo
Transformar la página de Reportes (`/reports`) en una tabla editable estilo hoja de cálculo donde puedas ver, editar y corregir datos de tareas (presentes y pasadas) antes de que se exporten al CSV que consume la app de tu jefe.

### Cambios principales

#### 1. Nueva tabla editable (`src/components/reports/EditableTaskTable.tsx`)
- Tabla con celdas editables al hacer clic (inline editing)
- Columnas que coinciden con lo que exporta el CSV: Fecha, Propiedad, Dirección, Horario, Tipo, Estado, Trabajador, Cliente, Supervisor, Coste, Horas, Método de Pago
- Cada celda se vuelve un input/select al hacer clic, y guarda al perder el foco o pulsar Enter
- Indicador visual de celdas modificadas (borde o fondo diferente)
- Botón "Guardar cambios" que persiste las ediciones a Supabase vía `taskStorageService.updateTask()`

#### 2. Actualizar la página Reports (`src/pages/Reports.tsx`)
- Cuando `reportType === 'tasks'`, renderizar `EditableTaskTable` en lugar de `TaskReportTable`
- Mantener los filtros existentes (fecha, cliente, trabajador, sede)
- Añadir al filtro de período la opción "Todo" para poder ver tareas pasadas
- Los demás tipos de reporte (billing, summary, laundry) se mantienen como están

#### 3. Hook de datos editables (`src/hooks/reports/useEditableReportData.ts`)
- Carga las tareas directamente desde la base de datos (no transformadas por el generator) para poder hacer el mapeo inverso al guardar
- Proporciona función `updateTaskField(taskId, field, value)` que actualiza en Supabase
- Gestiona estado local de cambios pendientes (dirty tracking)

#### 4. Funcionalidades clave de la tabla
- **Edición inline**: clic en celda para editar, Enter/Tab para confirmar, Esc para cancelar
- **Selects para campos con opciones**: Estado (pendiente/en progreso/completada), Tipo de servicio, Método de pago
- **Indicador de cambios sin guardar**: badge con contador de cambios pendientes
- **Guardado masivo**: botón para guardar todos los cambios de una vez
- **Scroll horizontal**: la tabla ocupa todo el ancho con scroll para ver todas las columnas

### Archivos a crear/modificar
1. **Crear** `src/components/reports/EditableTaskTable.tsx` - Componente principal de tabla editable
2. **Crear** `src/hooks/reports/useEditableReportData.ts` - Hook para carga y guardado de datos
3. **Modificar** `src/pages/Reports.tsx` - Usar `EditableTaskTable` para el reporte de tareas

### Detalle técnico
- Las tareas se cargan con `taskStorageService.getTasksForReports()` que ya filtra por sede/fecha
- Se enriquecen con datos de propiedades y clientes para mostrar nombres
- Al guardar, se mapean los campos de vuelta al esquema de la tabla `tasks` y se llama a `updateTask()`
- Los campos derivados (como nombre de cliente que viene de la propiedad) se resuelven buscando el cliente por nombre

