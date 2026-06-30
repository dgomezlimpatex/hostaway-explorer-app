import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { propertyStaffingService } from '@/services/planning/propertyStaffingService';
import {
  PlanningStaffingReplaceInput,
  PlanningStaffingScope,
  PlanningStaffingUpsertInput,
} from '@/types/planningV2';
import { toast } from '@/hooks/use-toast';

export const planningStaffingKeys = {
  all: ['planning-v2-staffing'] as const,
  config: (scope: PlanningStaffingScope, scopeId?: string) => [...planningStaffingKeys.all, 'config', scope, scopeId] as const,
  propertyContext: (propertyId?: string, startDate?: string, endDate?: string) => [
    ...planningStaffingKeys.all,
    'property-context',
    propertyId,
    startDate,
    endDate,
  ] as const,
  buildingAssignments: () => [...planningStaffingKeys.all, 'building-assignments'] as const,
  cleaners: () => [...planningStaffingKeys.all, 'cleaners'] as const,
};

export const usePlanningStaffingConfig = (scope: PlanningStaffingScope, scopeId?: string) => useQuery({
  queryKey: planningStaffingKeys.config(scope, scopeId),
  queryFn: () => propertyStaffingService.getStaffingConfig(scope, scopeId!),
  enabled: !!scopeId,
  staleTime: 60_000,
});

export const usePlanningPropertyContext = (propertyId?: string, startDate?: string, endDate?: string) => useQuery({
  queryKey: planningStaffingKeys.propertyContext(propertyId, startDate, endDate),
  queryFn: () => propertyStaffingService.getPropertyContext(propertyId!, startDate, endDate),
  enabled: !!propertyId,
  staleTime: 60_000,
});

export const usePlanningBuildingAssignments = () => useQuery({
  queryKey: planningStaffingKeys.buildingAssignments(),
  queryFn: () => propertyStaffingService.listPropertyBuildingAssignments(),
  staleTime: 5 * 60_000,
});

export const usePlanningCleaners = () => useQuery({
  queryKey: planningStaffingKeys.cleaners(),
  queryFn: () => propertyStaffingService.getCleanersForActiveSede(),
  staleTime: 60_000,
});

const invalidatePlanningStaffing = (
  queryClient: ReturnType<typeof useQueryClient>,
  scope?: PlanningStaffingScope,
  scopeId?: string,
) => {
  queryClient.invalidateQueries({ queryKey: planningStaffingKeys.all });
  if (scope && scopeId) {
    queryClient.invalidateQueries({ queryKey: planningStaffingKeys.config(scope, scopeId) });
  }
};

export const useUpsertPlanningStaffingEntry = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: PlanningStaffingUpsertInput) => propertyStaffingService.upsertStaffingEntry(input),
    onSuccess: (entry) => {
      invalidatePlanningStaffing(queryClient, entry.scope, entry.scopeId);
      toast({ title: 'Equipo de planificación actualizado' });
    },
    onError: (error) => {
      toast({
        title: 'Error al actualizar el equipo',
        description: error instanceof Error ? error.message : 'No se pudo guardar la configuración.',
        variant: 'destructive',
      });
    },
  });
};

export const useReplacePlanningStaffingEntries = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: PlanningStaffingReplaceInput) => propertyStaffingService.replaceStaffingEntries(input),
    onSuccess: (config) => {
      invalidatePlanningStaffing(queryClient, config.scope, config.scopeId);
      toast({ title: 'Equipo de planificación reemplazado' });
    },
    onError: (error) => {
      toast({
        title: 'Error al reemplazar el equipo',
        description: error instanceof Error ? error.message : 'No se pudo guardar la configuración.',
        variant: 'destructive',
      });
    },
  });
};

export const useRemovePlanningStaffingEntry = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ scope, id }: { scope: PlanningStaffingScope; id: string }) => propertyStaffingService.removeStaffingEntry(scope, id),
    onSuccess: () => {
      invalidatePlanningStaffing(queryClient);
      toast({ title: 'Trabajadora retirada del equipo' });
    },
    onError: () => {
      toast({
        title: 'Error al retirar trabajadora',
        description: 'No se pudo eliminar la configuración.',
        variant: 'destructive',
      });
    },
  });
};
