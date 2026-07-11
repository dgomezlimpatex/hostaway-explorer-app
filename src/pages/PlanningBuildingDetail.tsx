import { useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { BuildingCrmPage } from '@/components/planning/building-crm/BuildingCrmPage';
import { useCleaners } from '@/hooks/useCleaners';
import {
  useCleanerAssignments,
  usePropertyAssignments,
  usePropertyGroups,
} from '@/hooks/usePropertyGroups';
import { useProperties } from '@/hooks/useProperties';
import { buildPlanningBuildingCrmProfile } from '@/services/planning/buildingCrmAggregator';

const PlanningBuildingDetail = () => {
  const { propertyGroupId = '' } = useParams<{ propertyGroupId: string }>();
  const groupsQuery = usePropertyGroups();
  const propertiesQuery = useProperties();
  const propertyAssignmentsQuery = usePropertyAssignments(propertyGroupId);
  const cleanerAssignmentsQuery = useCleanerAssignments(propertyGroupId);
  const cleanersQuery = useCleaners();

  const profile = useMemo(() => {
    const groupExists = groupsQuery.data?.some((group) => group.id === propertyGroupId);
    if (!propertyGroupId || !groupExists) return undefined;

    return buildPlanningBuildingCrmProfile({
      propertyGroupId,
      dateFrom: '2000-01-01',
      dateTo: '2000-01-01',
      fallbackDailyCapacityMinutes: 480,
      propertyGroups: groupsQuery.data || [],
      propertyGroupAssignments: propertyAssignmentsQuery.data || [],
      properties: propertiesQuery.data || [],
      cleaners: cleanersQuery.cleaners,
      cleanerGroupAssignments: cleanerAssignmentsQuery.data || [],
      tasks: [],
      forecastItems: [],
      teamAvailability: [],
    });
  }, [
    cleanerAssignmentsQuery.data,
    cleanersQuery.cleaners,
    groupsQuery.data,
    propertiesQuery.data,
    propertyAssignmentsQuery.data,
    propertyGroupId,
  ]);

  const isLoading = groupsQuery.isLoading
    || propertiesQuery.isLoading
    || propertyAssignmentsQuery.isLoading
    || cleanerAssignmentsQuery.isLoading
    || cleanersQuery.isLoading;
  const firstError = groupsQuery.error
    || propertiesQuery.error
    || propertyAssignmentsQuery.error
    || cleanerAssignmentsQuery.error;

  const refresh = () => Promise.all([
    groupsQuery.refetch(),
    propertiesQuery.refetch(),
    propertyAssignmentsQuery.refetch(),
    cleanerAssignmentsQuery.refetch(),
    cleanersQuery.refetch(),
  ]);

  return (
    <BuildingCrmPage
      propertyGroupId={propertyGroupId}
      profile={profile}
      isLoading={isLoading}
      isError={Boolean(firstError)}
      error={firstError instanceof Error ? firstError.message : null}
      onRefresh={() => { void refresh(); }}
    />
  );
};

export default PlanningBuildingDetail;
