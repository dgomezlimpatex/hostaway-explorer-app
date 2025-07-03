# Roadmap: Mejoras para Reportes de Cleaners Móvil

## Objetivo
Mejorar la funcionalidad de reportes para cleaners desde dispositivos móviles, asegurando restricciones adecuadas y flujo de trabajo correcto.

## Problemas Identificados a Resolver

### 1. Restricción Temporal de Tareas ✅ COMPLETADO
**Problema**: Los cleaners pueden completar tareas de días futuros
**Solución**: Solo permitir completar tareas del día actual (HOY)
- [ ] Modificar lógica en `CleanerMobileCalendar.tsx` para filtrar solo tareas de hoy
- [ ] Deshabilitar botón "Crear Reporte" para tareas de días futuros
- [ ] Añadir validación en `TaskReportModal.tsx` para rechazar reportes de tareas futuras
- [ ] Mostrar mensaje informativo cuando se intente acceder a tareas futuras

### 2. Validación Estricta de Completado ✅ COMPLETADO
**Problema**: El reporte se puede completar sin terminar tareas obligatorias
**Solución**: Implementar validación estricta basada en tareas requeridas
- [ ] Modificar lógica de `completionPercentage` en `TaskReportModal.tsx`
- [ ] Crear función `validateRequiredTasks()` que verifique:
  - Todas las tareas marcadas como `required: true` estén completadas
  - Todas las fotos marcadas como `photo_required: true` estén subidas
- [ ] Reemplazar validación actual (80% genérico) por validación específica de requerimientos
- [ ] Actualizar `TaskReportFooter.tsx` para mostrar mensajes específicos de qué falta

### 3. Estado Completo de Tarea ✅ COMPLETADO
**Problema**: Al finalizar reporte, la tarea no se marca como completada en todo el sistema
**Solución**: Sincronización completa del estado de tarea
- [ ] Modificar `handleComplete()` en `TaskReportModal.tsx` para:
  - Actualizar estado de tarea a `completed` en tabla `tasks`
  - Marcar reporte como `completed` en tabla `task_reports`
  - Sincronizar en tiempo real con otros componentes
- [ ] Verificar que `TaskCard.tsx` y listas de tareas reflejen el cambio inmediatamente

### 4. Modo Solo-Lectura Post-Completado ❌ PENDIENTE
**Problema**: Después de completar, cleaner puede seguir editando todo
**Solución**: Restringir edición a solo incidencias y notas
- [ ] Crear estado `isTaskCompleted` en `TaskReportModal.tsx`
- [ ] Cuando `task.status === 'completed'`:
  - Deshabilitar edición de checklist
  - Deshabilitar subida de fotos al checklist
  - Solo permitir edición en sección "Incidencias" 
  - Solo permitir edición en sección "Notas Generales"
- [ ] Actualizar UI para mostrar claramente qué está en modo solo-lectura

## Fase 1: Restricción Temporal ✅ COMPLETADO
### 1.1 Filtrado de Tareas por Fecha
- [ ] Modificar `CleanerMobileCalendar.tsx` para filtrar `todayTasks` solo del día actual
- [ ] Añadir validación de fecha en hook `useCleanerTaskSummary`
- [ ] Deshabilitar navegación a días futuros para completar tareas

### 1.2 Validación en Modal de Reporte
- [ ] Añadir validación en `TaskReportModal.tsx` al abrir:
  ```typescript
  const isTaskFromToday = task.date === format(new Date(), 'yyyy-MM-dd');
  if (!isTaskFromToday) {
    // Mostrar mensaje de error y cerrar modal
  }
  ```

## Fase 2: Validación Estricta de Completado ✅ COMPLETADO
### 2.1 Nueva Lógica de Validación
- [ ] Crear función `validateRequiredItems()`:
  ```typescript
  const validateRequiredItems = (template, checklist) => {
    // Verificar items requeridos
    // Verificar fotos requeridas
    return { isValid, missingItems, missingPhotos }
  }
  ```

### 2.2 Actualizar UI de Completado
- [ ] Modificar `TaskReportFooter.tsx` para mostrar validación específica
- [ ] Cambiar mensaje de "80% completado" a "Falta: X tareas obligatorias"
- [ ] Deshabilitar botón "Completar" hasta que todo esté requerido

## Fase 3: Sincronización de Estado ✅ COMPLETADO
### 3.1 Actualización Completa de Tarea
- [ ] Modificar `handleComplete()` para actualizar múltiples tablas
- [ ] Implementar transacción para asegurar consistencia
- [ ] Añadir invalidación de queries en React Query

### 3.2 Notificación en Tiempo Real
- [ ] Implementar Supabase Realtime para actualizar estado
- [ ] Sincronizar cambios inmediatamente en todas las vistas

## Fase 4: Modo Solo-Lectura Post-Completado ❌ PENDIENTE
### 4.1 Estados Condicionales
- [ ] Crear componente `ReadOnlyTaskReport.tsx`
- [ ] Implementar lógica de renderizado condicional
- [ ] Preservar acceso a incidencias y notas

### 4.2 UI Diferenciada
- [ ] Diseñar interfaz para modo solo-lectura
- [ ] Añadir indicadores visuales de "Completado"
- [ ] Botón para "Añadir Incidencia" en lugar de "Completar Reporte"

## Componentes a Modificar

### Principales:
- `TaskReportModal.tsx` - Lógica principal de validación y estados
- `CleanerMobileCalendar.tsx` - Filtrado de tareas por fecha
- `TaskReportFooter.tsx` - Validación y botones de completado
- `ChecklistSection.tsx` - Estados de solo-lectura
- `TaskCard.tsx` / `CleanerTaskCard.tsx` - Botones condicionales

### Nuevos:
- `useTaskValidation.ts` - Hook para validación de requerimientos
- `ReadOnlyTaskReport.tsx` - Componente para tareas completadas

## Consideraciones Técnicas

### Validación de Fechas:
```typescript
const isToday = (taskDate: string) => {
  return taskDate === format(new Date(), 'yyyy-MM-dd');
};
```

### Validación de Requerimientos:
```typescript
const validateRequired = (template, checklist) => {
  const requiredItems = template.checklist_items
    .flatMap(cat => cat.items.filter(item => item.required))
    .map(item => `${cat.id}.${item.id}`);
  
  const photoRequiredItems = template.checklist_items
    .flatMap(cat => cat.items.filter(item => item.photo_required))
    .map(item => `${cat.id}.${item.id}`);
    
  // Verificar completados...
};
```

### Sincronización de Estado:
```typescript
const updateTaskStatus = async (taskId: string) => {
  await supabase.from('tasks').update({ 
    status: 'completed' 
  }).eq('id', taskId);
  
  // Invalidar queries
  queryClient.invalidateQueries(['tasks']);
  queryClient.invalidateQueries(['task-reports']);
};
```

## Prioridad de Implementación
1. **ALTA** - Restricción temporal (solo tareas de hoy)
2. **ALTA** - Validación estricta de completado
3. **MEDIA** - Sincronización de estado completo
4. **MEDIA** - Modo solo-lectura post-completado

## Testing Required
- [ ] Probar restricción de fechas en móvil
- [ ] Verificar validación estricta con tareas requeridas
- [ ] Testear sincronización entre componentes
- [ ] Validar modo solo-lectura funcional