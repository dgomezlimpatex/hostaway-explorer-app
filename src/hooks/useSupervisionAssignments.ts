import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  assignSupervisorToBuilding,
  getSupervisionBuildingAssignments,
  getSupervisionUsers,
  removeSupervisorFromBuilding,
} from '@/features/supervision/buildingSupervisionStorage';
import type { SupervisionBuildingAssignment } from '@/features/supervision/buildingSupervisionStorage';

export const useSupervisionUsers = () => useQuery({
  queryKey: ['supervision-users'],
  queryFn: getSupervisionUsers,
  staleTime: 60_000,
});

export const useSupervisionBuildingAssignments = (propertyGroupId: string) => useQuery({
  queryKey: ['supervision-building-assignments', propertyGroupId],
  queryFn: () => getSupervisionBuildingAssignments(propertyGroupId),
  enabled: Boolean(propertyGroupId),
});

const invalidateSupervisionAssignments = (queryClient: ReturnType<typeof useQueryClient>, groupId: string) => {
  void queryClient.invalidateQueries({ queryKey: ['supervision-building-assignments', groupId] });
  void queryClient.invalidateQueries({ queryKey: ['building-supervision-workspace'] });
};

export const useAssignSupervisorToBuilding = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: assignSupervisorToBuilding,
    onSuccess: (_, input) => invalidateSupervisionAssignments(queryClient, input.propertyGroupId),
  });
};

export const useRemoveSupervisorFromBuilding = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ assignmentId }: { assignmentId: string; propertyGroupId: string }) => removeSupervisorFromBuilding(assignmentId),
    onSuccess: (_, input) => invalidateSupervisionAssignments(queryClient, input.propertyGroupId),
  });
};

export type { SupervisionBuildingAssignment };
