import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getSupervisionBuildingPolicy, upsertSupervisionBuildingPolicy, type SupervisionBuildingPolicy } from '@/features/supervision/buildingSupervisionStorage';

export const useSupervisionBuildingPolicy = (propertyGroupId: string) => useQuery({
  queryKey: ['supervision-building-policy', propertyGroupId],
  queryFn: () => getSupervisionBuildingPolicy(propertyGroupId),
  enabled: Boolean(propertyGroupId),
});

export const useUpsertSupervisionBuildingPolicy = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: upsertSupervisionBuildingPolicy,
    onSuccess: (policy) => {
      void queryClient.invalidateQueries({ queryKey: ['supervision-building-policy', policy.property_group_id] });
      void queryClient.invalidateQueries({ queryKey: ['building-supervision-workspace'] });
    },
  });
};

export type { SupervisionBuildingPolicy };
