import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { useSede } from '@/contexts/SedeContext';
import { createIncident, saveReview, uploadSupervisionPhoto } from './supervisionStorage';
import { ensureAutomaticBuildingRoute, fetchBuildingSupervisionWorkspace, updateSupervisionWorkItemStatus, beginBuildingStockCheck, completeBuildingStockCheck } from './buildingSupervisionStorage';
import type { SupervisionIncident, SupervisionReview } from './types';
import type { BuildingAgendaBuildingResult } from './buildingAgenda';

export const useBuildingSupervisionWorkspace = (date: string) => {
  const { activeSede } = useSede();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const sedeId = activeSede?.id || '';
  const userId = user?.id || '';
  const enabled = Boolean(sedeId && userId && date);
  const queryKey = ['building-supervision-workspace', userId, sedeId, date];

  const workspaceQuery = useQuery({
    queryKey,
    queryFn: () => fetchBuildingSupervisionWorkspace(sedeId, userId, date),
    enabled,
    staleTime: 15_000,
  });

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey });
    void queryClient.invalidateQueries({ queryKey: ['supervision-workspace'] });
  };

  const prepareBuildingMutation = useMutation({
    mutationFn: (building: BuildingAgendaBuildingResult) => ensureAutomaticBuildingRoute({
      sedeId,
      date,
      building,
      tasks: workspaceQuery.data?.tasks || [],
    }),
  });

  const saveReviewMutation = useMutation({
    mutationFn: (input: Omit<SupervisionReview, 'id' | 'created_at' | 'updated_at'>) => saveReview(sedeId, date, input),
    onSuccess: invalidate,
  });

  const incidentMutation = useMutation({
    mutationFn: (input: Omit<SupervisionIncident, 'id' | 'created_at' | 'updated_at'>) => createIncident(sedeId, date, input),
    onSuccess: invalidate,
  });

  const photoMutation = useMutation({
    mutationFn: (input: { reviewId: string; file: File }) => uploadSupervisionPhoto(sedeId, input.reviewId, input.file),
    onSuccess: invalidate,
  });

  const workItemStatusMutation = useMutation({
    mutationFn: (input: { workItemId: string; status: import('./buildingAgenda').BuildingAgendaStatus; reason?: string | null }) => updateSupervisionWorkItemStatus(input.workItemId, input.status, input.reason),
    onSuccess: invalidate,
  });

  const stockCheckMutation = useMutation({
    mutationFn: ({ propertyGroupId, date, checkType }: { propertyGroupId: string; date: string; checkType?: 'restock' | 'inventory' }) => beginBuildingStockCheck(propertyGroupId, date, checkType),
  });
  const completeStockCheckMutation = useMutation({
    mutationFn: ({ checkId, lines, notes }: { checkId: string; lines: Array<{ id: string; observed_quantity: number; notes?: string | null }>; notes?: string | null }) => completeBuildingStockCheck(checkId, lines, notes),
    onSuccess: invalidate,
  });

  return {
    ...workspaceQuery.data,
    activeSede,
    user,
    sedeId,
    isLoading: workspaceQuery.isLoading,
    isFetching: workspaceQuery.isFetching,
    error: workspaceQuery.error,
    refresh: () => queryClient.invalidateQueries({ queryKey }),
    prepareBuilding: prepareBuildingMutation.mutateAsync,
    saveReview: saveReviewMutation.mutateAsync,
    createIncident: incidentMutation.mutateAsync,
    updateWorkItemStatus: workItemStatusMutation.mutateAsync,
    beginStockCheck: stockCheckMutation.mutateAsync,
    completeStockCheck: completeStockCheckMutation.mutateAsync,
    uploadPhoto: photoMutation.mutateAsync,
    isSaving: prepareBuildingMutation.isPending || saveReviewMutation.isPending || incidentMutation.isPending || workItemStatusMutation.isPending || stockCheckMutation.isPending || completeStockCheckMutation.isPending || photoMutation.isPending,
  };
};
