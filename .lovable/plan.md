
# Plan: Corregir el fallo de envio de reportes en moviles (caso Thalia - iPhone)

## Problema raiz identificado

Despues de analizar todo el flujo de envio de reportes, he encontrado **un fallo critico de condicion de carrera** que hace que los reportes completados se reviertan a "en progreso":

### Secuencia del fallo:

1. La operaria pulsa "Completar"
2. El sistema actualiza el reporte a `overall_status: 'completed'` y la tarea a `status: 'completed'`
3. Se cierra el modal (`onOpenChange(false)`)
4. **AQUI ESTA EL BUG**: Al cerrarse el modal, se dispara un `useEffect` de "auto-guardado al cerrar" (linea 308 de TaskReportModal.tsx) que ejecuta `forceSave()`
5. Ese auto-guardado calcula el estado basandose en `completionPercentage`, que puede no ser exactamente 100% en ese instante
6. **RESULTADO**: El auto-guardado SOBREESCRIBE el reporte de vuelta a `in_progress`, deshaciendo todo el trabajo de la operaria

### Evidencia en la base de datos:

He verificado los datos de Thalia:
- Tarea de hoy (`e0485750`): estado = `pending`, reporte = `in_progress` -- deberia ser `completed` en ambos
- Tarea del 15 Feb (`258b010c`): estado = `pending`, reporte = `in_progress` -- mismo patron
- Ninguna de sus tareas recientes tiene estado `completed`

Esto confirma que el sistema esta revirtiendo los cambios sistematicamente.

## Solucion

### Archivo 1: `src/components/modals/TaskReportModal.tsx`

**Cambio principal**: Anadir una bandera `isCompleting` que evite que el auto-guardado sobreescriba el estado al cerrar el modal.

Cambios especificos:

1. **Anadir estado `isCompleting`** (nuevo useState):
   - Se activa al inicio de `handleComplete`
   - Impide que el `useEffect` de auto-guardado al cerrar ejecute `forceSave()`

2. **Modificar el useEffect de cierre del modal** (lineas 308-332):
   - Anadir condicion: si `isCompleting` es true, NO ejecutar `forceSave()`
   - Esto evita la sobreescritura del estado completado

3. **Mejorar `handleComplete`** (lineas 511-626):
   - Activar `isCompleting = true` al inicio
   - Asegurar que primero se guarda el reporte, luego se actualiza la tarea, y solo si ambos tienen exito se cierra el modal
   - Invalidar correctamente TODOS los caches relevantes (tasks, task-reports, task-report) para que la vista de la operaria se actualice
   - Anadir invalidacion del query key especifico del cleaner: `['tasks', 'cleaner', currentCleanerId]`

4. **Corregir `autoSaveData`** (linea 289):
   - No cambiar a 'completed' automaticamente basandose en porcentaje
   - El auto-guardado solo debe usar 'in_progress' -- el estado 'completed' solo se establece explicitamente en `handleComplete`

### Archivo 2: `src/hooks/useOptimizedAutoSave.ts` (revision)

Verificar que el hook de auto-guardado respeta la bandera y no ejecuta guardados despues de que el modal se cierre tras completar.

---

## Detalle tecnico del fix principal

```text
ANTES (buggy):
  handleComplete() -> updateReport(completed) -> updateTask(completed) -> onOpenChange(false)
  useEffect(open=false) -> forceSave() -> updateReport(in_progress) <-- BUG: sobreescribe!

DESPUES (correcto):
  handleComplete() -> isCompleting=true -> updateReport(completed) -> updateTask(completed) -> onOpenChange(false)
  useEffect(open=false) -> if(isCompleting) SKIP forceSave() <-- protegido
```

## Cambios adicionales de robustez

- Invalidar el cache especifico para cleaners (`['tasks', 'cleaner', cleanerId, sedeId]`) despues de completar, ya que ese es el query key que usa `useOptimizedTasks` para las operarias
- Anadir un pequeno delay antes de cerrar el modal para asegurar que las mutaciones se completen
- Resetear `isCompleting` en el bloque catch para permitir reintentos

## Resultado esperado

Cuando una operaria (Thalia o cualquier otra) complete un reporte:
1. El reporte quedara marcado como `completed` permanentemente
2. La tarea quedara marcada como `completed` permanentemente  
3. Al volver a la lista de tareas, vera la tarea como completada
4. No habra "reinicio" ni perdida de datos
