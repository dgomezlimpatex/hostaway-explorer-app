
import { lazy, Suspense } from 'react';
import { LoadingSpinner } from '@/components/ui/loading-spinner';

// Lazy loading de componentes pesados del calendario
export const LazyCalendarGrid = lazy(() => 
  import('./CalendarGrid').then(module => ({ default: module.CalendarGrid }))
);

export const LazyUnassignedTasks = lazy(() => 
  import('./UnassignedTasks').then(module => ({ default: module.UnassignedTasks }))
);

export const LazyCalendarModals = lazy(() => 
  import('./CalendarModals').then(module => ({ default: module.CalendarModals }))
);

// Wrapper components con fallback
export const CalendarGridWithSuspense = (props: any) => (
  <Suspense fallback={<LoadingSpinner size="lg" text="Cargando calendario..." />}>
    <LazyCalendarGrid {...props} />
  </Suspense>
);

export const UnassignedTasksWithSuspense = (props: any) => (
  <Suspense fallback={<LoadingSpinner size="sm" text="Cargando tareas..." />}>
    <LazyUnassignedTasks {...props} />
  </Suspense>
);

export const CalendarModalsWithSuspense = (props: any) => (
  <Suspense fallback={<div />}>
    <LazyCalendarModals {...props} />
  </Suspense>
);
