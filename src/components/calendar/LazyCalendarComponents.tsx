
// Direct imports instead of lazy loading to fix module loading issues
import type * as React from 'react';
import { CalendarGrid } from './CalendarGrid';
import { UnassignedTasks } from './UnassignedTasks';
import { CalendarModals } from './CalendarModals';

// Direct export components (no lazy loading)
export const CalendarGridWithSuspense = (props: React.ComponentProps<typeof CalendarGrid>) => (
  <CalendarGrid {...props} />
);

export const UnassignedTasksWithSuspense = (props: React.ComponentProps<typeof UnassignedTasks>) => (
  <UnassignedTasks {...props} />
);

export const CalendarModalsWithSuspense = (props: React.ComponentProps<typeof CalendarModals>) => (
  <CalendarModals {...props} />
);
