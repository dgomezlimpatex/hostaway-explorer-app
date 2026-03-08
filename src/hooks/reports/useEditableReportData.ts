import { useState, useCallback, useMemo } from 'react';
import { useReportData } from './useReportData';
import { taskStorageService } from '@/services/taskStorage';
import { ReportFilters } from '@/types/filters';
import { Task } from '@/types/calendar';
import { toast } from 'sonner';

export interface EditableTask extends Task {
  clientName?: string;
  propertyName?: string;
}

type PendingChanges = Record<string, Partial<Task>>;

export const useEditableReportData = (filters: ReportFilters) => {
  const { data: reportData, isLoading, refetch } = useReportData(filters);
  const [pendingChanges, setPendingChanges] = useState<PendingChanges>({});
  const [isSaving, setIsSaving] = useState(false);

  const enrichedTasks = useMemo((): EditableTask[] => {
    if (!reportData) return [];
    const { tasks, clients, properties } = reportData;

    return tasks.map((task) => {
      const property = properties?.find((p: any) => p.id === task.propertyId);
      const client = clients?.find((c: any) => c.id === task.clienteId) ||
        (property ? clients?.find((c: any) => c.id === property.clienteId) : null);

      return {
        ...task,
        clientName: client?.nombre || '',
        propertyName: task.property || property?.codigo || '',
        // Auto-fill supervisor from client if not set on task
        supervisor: task.supervisor || client?.supervisor || '',
      };
    });
  }, [reportData]);

  // Apply pending changes on top of DB data
  const tasksWithChanges = useMemo((): EditableTask[] => {
    return enrichedTasks.map((task) => {
      const changes = pendingChanges[task.id];
      if (!changes) return task;
      return { ...task, ...changes };
    });
  }, [enrichedTasks, pendingChanges]);

  const updateField = useCallback((taskId: string, field: keyof Task, value: any) => {
    setPendingChanges((prev) => ({
      ...prev,
      [taskId]: {
        ...(prev[taskId] || {}),
        [field]: value,
      },
    }));
  }, []);

  const pendingCount = Object.keys(pendingChanges).length;

  const saveAllChanges = useCallback(async () => {
    if (pendingCount === 0) return;
    setIsSaving(true);
    try {
      const entries = Object.entries(pendingChanges);
      await Promise.all(
        entries.map(([taskId, updates]) => taskStorageService.updateTask(taskId, updates))
      );
      toast.success(`${entries.length} tarea(s) actualizada(s) correctamente`);
      setPendingChanges({});
      refetch();
    } catch (error) {
      console.error('Error saving changes:', error);
      toast.error('Error al guardar los cambios');
    } finally {
      setIsSaving(false);
    }
  }, [pendingChanges, pendingCount, refetch]);

  const discardChanges = useCallback(() => {
    setPendingChanges({});
  }, []);

  const isFieldDirty = useCallback(
    (taskId: string, field: string) => {
      return !!(pendingChanges[taskId] && field in pendingChanges[taskId]);
    },
    [pendingChanges]
  );

  return {
    tasks: tasksWithChanges,
    isLoading,
    updateField,
    saveAllChanges,
    discardChanges,
    pendingCount,
    isSaving,
    isFieldDirty,
    clients: reportData?.clients || [],
    properties: reportData?.properties || [],
  };
};
