import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useSede } from '@/contexts/SedeContext';
import { operationalPlanningService } from '@/services/planning/operationalPlanningService';
import { PlanningGenerateInput, PlanningSettings } from '@/types/operationalPlanning';
import { formatMadridDate } from '@/utils/date';

const getErrorMessage = (error: unknown, fallback: string) => {
  if (error instanceof Error) return error.message;
  if (error && typeof error === 'object' && 'message' in error) {
    return String((error as { message: unknown }).message);
  }
  return fallback;
};

const planningKeys = {
  root: ['operational-planning'] as const,
  overview: (sedeId?: string) => ['operational-planning', 'overview', sedeId] as const,
  runs: (sedeId?: string) => ['operational-planning', 'runs', sedeId] as const,
  preview: (runId?: string) => ['operational-planning', 'preview', runId] as const,
  workers: (sedeId?: string) => ['operational-planning', 'workers', sedeId] as const,
  buildings: (sedeId?: string) => ['operational-planning', 'buildings', sedeId] as const,
};

export const usePlanningRange = (horizonDays = 14) => {
  const today = useMemo(() => formatMadridDate(new Date()), []);
  const initialEnd = useMemo(
    () => formatMadridDate(new Date(Date.now() + Math.max(0, horizonDays - 1) * 86400000)),
    [horizonDays],
  );

  const [dateFrom, setDateFrom] = useState(today);
  const [dateTo, setDateTo] = useState(initialEnd);

  useEffect(() => {
    setDateTo(formatMadridDate(new Date(Date.now() + Math.max(0, horizonDays - 1) * 86400000)));
  }, [dateFrom, horizonDays]);

  return {
    dateFrom,
    dateTo,
    setDateFrom,
    setDateTo,
  };
};

export const useOperationalPlanningOverview = () => {
  const { activeSede, isInitialized, loading } = useSede();

  return useQuery({
    queryKey: planningKeys.overview(activeSede?.id),
    queryFn: () => operationalPlanningService.getOverview(activeSede!.id),
    enabled: isInitialized && !loading && !!activeSede?.id,
  });
};

export const useOperationalPlanningRuns = () => {
  const { activeSede, isInitialized, loading } = useSede();

  return useQuery({
    queryKey: planningKeys.runs(activeSede?.id),
    queryFn: () => operationalPlanningService.listRuns(activeSede!.id),
    enabled: isInitialized && !loading && !!activeSede?.id,
  });
};

export const useOperationalPlanningPreview = (runId?: string | null) =>
  useQuery({
    queryKey: planningKeys.preview(runId || undefined),
    queryFn: () => operationalPlanningService.getPreview(runId!),
    enabled: !!runId,
  });

export const useOperationalPlanningWorkers = () => {
  const { activeSede, isInitialized, loading } = useSede();

  return useQuery({
    queryKey: planningKeys.workers(activeSede?.id),
    queryFn: () => operationalPlanningService.getPlanningWorkers(activeSede!.id),
    enabled: isInitialized && !loading && !!activeSede?.id,
  });
};

export const useOperationalPlanningBuildings = () => {
  const { activeSede, isInitialized, loading } = useSede();

  return useQuery({
    queryKey: planningKeys.buildings(activeSede?.id),
    queryFn: () => operationalPlanningService.getPlanningBuildings(activeSede!.id),
    enabled: isInitialized && !loading && !!activeSede?.id,
  });
};

export const useSaveOperationalPlanningSettings = () => {
  const queryClient = useQueryClient();
  const { activeSede } = useSede();

  return useMutation({
    mutationFn: (updates: Partial<PlanningSettings>) => {
      if (!activeSede?.id) throw new Error('No hay sede activa.');
      return operationalPlanningService.saveSettings(activeSede.id, updates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: planningKeys.overview(activeSede?.id) });
      toast.success('Reglas de planificación actualizadas.');
    },
    onError: (error) => {
      toast.error(getErrorMessage(error, 'No se pudieron guardar las reglas.'));
    },
  });
};

export const useGenerateOperationalPlanningRun = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: PlanningGenerateInput) => operationalPlanningService.generateRun(input),
    onSuccess: (preview) => {
      queryClient.invalidateQueries({ queryKey: planningKeys.runs(preview.run.sedeId || undefined) });
      queryClient.invalidateQueries({ queryKey: planningKeys.overview(preview.run.sedeId || undefined) });
      queryClient.setQueryData(planningKeys.preview(preview.run.id), preview);
      toast.success(`Borrador generado con ${preview.items.length} propuestas.`);
    },
    onError: (error) => {
      toast.error(getErrorMessage(error, 'No se pudo generar la planificación.'));
    },
  });
};

export const useApproveOperationalPlanningRun = () => {
  const queryClient = useQueryClient();
  const { activeSede } = useSede();

  return useMutation({
    mutationFn: (runId: string) => operationalPlanningService.approveRun(runId),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: planningKeys.runs(activeSede?.id) });
      queryClient.invalidateQueries({ queryKey: planningKeys.overview(activeSede?.id) });
      queryClient.invalidateQueries({ queryKey: planningKeys.preview(result.run.id) });
      toast.success(`Plan aprobado: ${result.appliedTasks} tareas aplicadas.`);
    },
    onError: (error) => {
      toast.error(getErrorMessage(error, 'No se pudo aprobar la planificación.'));
    },
  });
};

export const useDiscardOperationalPlanningRun = () => {
  const queryClient = useQueryClient();
  const { activeSede } = useSede();

  return useMutation({
    mutationFn: (runId: string) => operationalPlanningService.discardRun(runId),
    onSuccess: (run) => {
      queryClient.invalidateQueries({ queryKey: planningKeys.runs(activeSede?.id) });
      queryClient.invalidateQueries({ queryKey: planningKeys.preview(run.id) });
      toast.success('Borrador descartado.');
    },
    onError: (error) => {
      toast.error(getErrorMessage(error, 'No se pudo descartar el borrador.'));
    },
  });
};

export const useApplyOperationalPlanningReplacement = () => {
  const queryClient = useQueryClient();
  const { activeSede } = useSede();

  return useMutation({
    mutationFn: (input: {
      taskId: string;
      replacementCleanerIds: string[];
      replacedCleanerIds: string[];
      keepCleanerIds?: string[];
    }) => operationalPlanningService.applyReplacementToTask(input),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: planningKeys.overview(activeSede?.id) });
      queryClient.invalidateQueries({ queryKey: planningKeys.runs(activeSede?.id) });
      queryClient.invalidateQueries({ queryKey: planningKeys.workers(activeSede?.id) });
      queryClient.invalidateQueries({ queryKey: planningKeys.buildings(activeSede?.id) });
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['cleaning-planning-tasks'] });
      toast.success(`Sustitución aplicada en ${result.assignedCleanerNames.join(', ')}.`);
    },
    onError: (error) => {
      toast.error(getErrorMessage(error, 'No se pudo aplicar la sustitución.'));
    },
  });
};

export const useUpdateOperationalPlanningWorkerProfile = () => {
  const queryClient = useQueryClient();
  const { activeSede } = useSede();

  return useMutation({
    mutationFn: ({ cleanerId, updates }: { cleanerId: string; updates: Parameters<typeof operationalPlanningService.updateWorkerPlanningProfile>[1] }) =>
      operationalPlanningService.updateWorkerPlanningProfile(cleanerId, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cleaners', activeSede?.id || 'pending-sede'] });
      queryClient.invalidateQueries({ queryKey: planningKeys.workers(activeSede?.id) });
      queryClient.invalidateQueries({ queryKey: planningKeys.overview(activeSede?.id) });
      toast.success('Perfil operativo actualizado.');
    },
    onError: (error) => {
      toast.error(getErrorMessage(error, 'No se pudo actualizar el perfil operativo.'));
    },
  });
};

export const useUpdateOperationalPlanningPropertyProfile = () => {
  const queryClient = useQueryClient();
  const { activeSede } = useSede();

  return useMutation({
    mutationFn: ({ propertyId, updates }: { propertyId: string; updates: Parameters<typeof operationalPlanningService.updatePropertyPlanningProfile>[1] }) =>
      operationalPlanningService.updatePropertyPlanningProfile(propertyId, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['properties', activeSede?.id || 'pending-sede'] });
      queryClient.invalidateQueries({ queryKey: planningKeys.buildings(activeSede?.id) });
      queryClient.invalidateQueries({ queryKey: planningKeys.overview(activeSede?.id) });
      toast.success('Perfil operativo de la propiedad actualizado.');
    },
    onError: (error) => {
      toast.error(getErrorMessage(error, 'No se pudo actualizar la configuración operativa de la propiedad.'));
    },
  });
};
