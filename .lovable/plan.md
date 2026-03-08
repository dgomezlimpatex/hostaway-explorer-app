

## Analysis

The system already has the `is_active` field on cleaners and a toggle in the edit modal. The issue is that when a worker leaves, the user **deletes** them (which unassigns all tasks) instead of marking them inactive. 

The current behavior when deleting:
- Unassigns all tasks (`cleaner = null, cleaner_id = null`)
- Deletes task_assignments
- Deletes the cleaner record

What's needed: Make the "deactivate" flow more prominent and ensure inactive workers' tasks stay assigned, while hiding inactive workers from new assignment selectors.

## Changes

### 1. Add "Deactivate" button to WorkersList (alongside Delete)
Replace the single "Eliminar" button with two options:
- **"Desactivar"** (yellow/warning) - sets `is_active = false`, keeps tasks assigned
- **"Eliminar"** (red/destructive) - current behavior, with stronger warning that tasks will be unassigned

The deactivate button should show only for active workers; for inactive workers, show a "Reactivar" button instead.

### 2. Update delete confirmation dialog
Add clearer messaging: "Se desasignarán todas las tareas de este trabajador. Si solo quieres que deje de aparecer en las asignaciones, usa 'Desactivar' en su lugar."

### 3. Hide inactive workers from calendar column
In `WorkersColumn.tsx`, the cleaners are already passed filtered. Check where the calendar gets its cleaners list - it likely already filters by `isActive`. If not, add the filter.

### 4. Filter inactive from assignment selectors
The `CleanerSection`, `AssignCleanerModal`, and `AssignMultipleCleanersModal` already filter `.filter(cleaner => cleaner.isActive)`. This is already handled.

### 5. Visual distinction in WorkersPage
The page already separates active/inactive workers. We just need to make sure inactive workers are visually distinct (greyed out row) and show both lists clearly.

## Files to modify

1. **`src/components/workers/WorkersList.tsx`** - Add Desactivar/Reactivar buttons, update delete dialog text
2. **`src/components/workers/WorkersPage.tsx`** - Ensure inactive workers section is clearly separated with a header
3. **`src/hooks/useCleaners.ts`** - Add a `useDeactivateCleaner` hook (or reuse `useUpdateCleaner` with `isActive: false`)

The approach is minimal: leverage the existing `isActive` field and `useUpdateCleaner` hook, just add UI buttons to make deactivation the primary action instead of deletion.

