
import { lazy, Suspense } from 'react';
import { useRolePermissions } from '@/hooks/useRolePermissions';
import { CleanerEntryLoading } from '@/components/dashboard/CleanerEntryLoading';
const CleaningCalendar = lazy(() => import('@/components/CleaningCalendar'));
const CleanerCalendarScreen = lazy(() => import('@/features/cleaner/CleanerCalendarScreen'));

const Calendar = () => {
  const { isCleaner } = useRolePermissions();
  return (
    <div className="min-h-screen md:h-screen bg-background transition-colors duration-300 md:overflow-hidden">
      <Suspense fallback={<CleanerEntryLoading />}>{isCleaner() ? <CleanerCalendarScreen /> : <CleaningCalendar />}</Suspense>
    </div>
  );
};

export default Calendar;
