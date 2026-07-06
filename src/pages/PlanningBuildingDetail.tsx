import { useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { BuildingCrmPage } from '@/components/planning/building-crm/BuildingCrmPage';
import { useOperationalPlanningBuildingCrm } from '@/hooks/useOperationalPlanning';
import { formatMadridDate } from '@/utils/date';

const addDays = (base: Date, days: number) => {
  const next = new Date(base);
  next.setDate(base.getDate() + days);
  return next;
};

const PlanningBuildingDetail = () => {
  const { propertyGroupId } = useParams<{ propertyGroupId: string }>();
  const [rangeDays, setRangeDays] = useState(30);
  const today = useMemo(() => new Date(), []);
  const dateFrom = useMemo(() => formatMadridDate(today), [today]);
  const dateTo = useMemo(() => formatMadridDate(addDays(today, rangeDays - 1)), [today, rangeDays]);
  const query = useOperationalPlanningBuildingCrm(propertyGroupId, dateFrom, dateTo);

  return (
    <BuildingCrmPage
      propertyGroupId={propertyGroupId || ''}
      dateFrom={dateFrom}
      dateTo={dateTo}
      rangeDays={rangeDays}
      onRangeDaysChange={setRangeDays}
      profile={query.data}
      isLoading={query.isLoading || query.isFetching}
      isError={query.isError}
      error={query.error instanceof Error ? query.error.message : null}
      onRefresh={() => query.refetch()}
    />
  );
};

export default PlanningBuildingDetail;
