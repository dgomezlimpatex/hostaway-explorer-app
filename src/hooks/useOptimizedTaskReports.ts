import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { taskReportsStorageService } from '@/services/storage/taskReportsStorage';
import { TaskReport, CreateTaskReportData } from '@/types/taskReports';
import { useToast } from '@/hooks/use-toast';
import { useNetworkStatus } from './useNetworkStatus';
import { useDeviceType } from './use-mobile';
import { offlineStorage } from '@/utils/offlineStorage';
import { useEffect, useCallback } from 'react';

export const useOptimizedTaskReports = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { isOnline, isSlowConnection } = useNetworkStatus();
  const { isMobile } = useDeviceType();

  // Configuración dinámica basada en dispositivo y conexión
  const getQueryConfig = () => {
    if (isMobile) {
      return {
        staleTime: isSlowConnection ? 15 * 60 * 1000 : 10 * 60 * 1000, // 15min para conexión lenta, 10min para móvil
        gcTime: 30 * 60 * 1000, // 30 minutos
        refetchOnWindowFocus: false,
        refetchInterval: false as const,
        networkMode: 'offlineFirst' as const
      };
    }
    
    return {
      staleTime: 5 * 60 * 1000, // 5 minutos para desktop
      gcTime: 15 * 60 * 1000,
      refetchOnWindowFocus: true,
      refetchInterval: false as const,
      networkMode: 'online' as const
    };
  };

  // Query optimizada para reportes
  const {
    data: reports = [],
    isLoading,
    error
  } = useQuery({
    queryKey: ['task-reports'],
    queryFn: async () => {
      console.log('🚀 useOptimizedQuery executing...', { isOnline, isMobile, isSlowConnection });
      const result = await taskReportsStorageService.getTaskReports();
      console.log('🚀 useOptimizedQuery result:', result?.length || 0, 'reports');
      return result;
    },
    ...getQueryConfig(),
    retry: (failureCount, error) => {
      // En móvil, reintentar más veces
      const maxRetries = isMobile ? 3 : 1;
      return failureCount < maxRetries;
    },
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000)
  });

  // Sincronización de operaciones offline cuando se recupera conexión
  const syncOfflineOperations = useCallback(async () => {
    if (!isOnline) return;

    const pendingOperations = offlineStorage.getPendingOperations();
    console.log('Syncing offline operations:', pendingOperations.length);

    for (const operation of pendingOperations) {
      try {
        switch (operation.type) {
          case 'create':
            await taskReportsStorageService.createTaskReport(operation.data);
            break;
          case 'update':
            await taskReportsStorageService.updateTaskReport(
              operation.data.reportId, 
              operation.data.updates
            );
            break;
          case 'uploadMedia':
            await taskReportsStorageService.uploadMedia(
              operation.data.file,
              operation.data.reportId,
              operation.data.checklistItemId
            );
            break;
        }
        
        offlineStorage.removeOperation(operation.id);
        console.log('Offline operation synced:', operation.id);
      } catch (error) {
        console.error('Error syncing operation:', operation.id, error);
        offlineStorage.incrementRetryCount(operation.id);
      }
    }

    // Invalidar queries después de sincronizar
    if (pendingOperations.length > 0) {
      queryClient.invalidateQueries({ queryKey: ['task-reports'] });
    }
  }, [isOnline, queryClient]);

  // Ejecutar sincronización cuando se recupera conexión
  useEffect(() => {
    if (isOnline) {
      syncOfflineOperations();
    }
  }, [isOnline, syncOfflineOperations]);

  // Mutation optimizada para crear reporte
  const createReportMutation = useMutation({
    mutationFn: async (data: CreateTaskReportData) => {
      console.log('Creating optimized task report:', data);
      
      if (!isOnline) {
        // Guardar offline
        const offlineId = offlineStorage.addOperation('create', data);
        toast({
          title: "Guardado offline",
          description: "El reporte se guardará cuando haya conexión.",
        });
        return { id: offlineId, ...data, offline: true };
      }
      
      return taskReportsStorageService.createTaskReport(data);
    },
    onSuccess: (data, variables) => {
      console.log('Task report created successfully:', data);
      queryClient.invalidateQueries({ queryKey: ['task-reports'] });
      queryClient.invalidateQueries({ queryKey: ['task-report', variables.task_id] });
      
      if (!(data as any).offline) {
        toast({
          title: "Reporte creado",
          description: "El reporte de tarea se ha creado exitosamente.",
        });
      }
    },
    onError: (error) => {
      console.error('Error creating report:', error);
      toast({
        title: "Error",
        description: "No se pudo crear el reporte. Inténtalo de nuevo.",
        variant: "destructive",
      });
    },
  });

  // Mutation optimizada para actualizar reporte
  const updateReportMutation = useMutation({
    mutationFn: async ({ reportId, updates, silent = false }: { 
      reportId: string; 
      updates: Partial<TaskReport>; 
      silent?: boolean 
    }) => {
      console.log('Updating optimized task report:', reportId, updates);
      
      if (!isOnline) {
        // Guardar cambios offline
        offlineStorage.saveReportOffline(reportId, updates);
        offlineStorage.addOperation('update', { reportId, updates });
        return { id: reportId, ...updates, offline: true };
      }
      
      return taskReportsStorageService.updateTaskReport(reportId, updates);
    },
    onSuccess: (data, variables) => {
      console.log('Task report updated successfully:', data);
      
      // Actualización optimista en cache
      queryClient.setQueryData(['task-reports'], (oldData: TaskReport[] = []) => {
        return oldData.map(report => 
          report.id === variables.reportId 
            ? { ...report, ...variables.updates }
            : report
        );
      });

      if (!(data as any).offline && !variables.silent) {
        toast({
          title: "Reporte actualizado",
          description: "El reporte se ha actualizado exitosamente.",
        });
      }
    },
    onError: (error) => {
      console.error('Error updating report:', error);
      toast({
        title: "Error",
        description: "No se pudo actualizar el reporte. Inténtalo de nuevo.",
        variant: "destructive",
      });
    },
  });

  return {
    reports,
    isLoading,
    error,
    isOnline,
    isSlowConnection,
    createReport: createReportMutation.mutate,
    updateReport: updateReportMutation.mutate,
    isCreatingReport: createReportMutation.isPending,
    isUpdatingReport: updateReportMutation.isPending,
    syncOfflineOperations,
  };
};