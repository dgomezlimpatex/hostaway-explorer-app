
// Direct imports instead of lazy loading to fix module loading issues
import { CalendarGrid } from './CalendarGrid';
import { UnassignedTasks } from './UnassignedTasks';
import { CalendarModals } from './CalendarModals';

// Direct export components (no lazy loading)
export const CalendarGridWithSuspense = (props: any) => (
  <CalendarGrid {...props} />
);

export const UnassignedTasksWithSuspense = (props: any) => (
  <UnassignedTasks {...props} />
);

export const CalendarModalsWithSuspense = (props: any) => (
  <CalendarModals {...props} />
);
