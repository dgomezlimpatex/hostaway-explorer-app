
import { lazy, Suspense } from 'react';
import { useRolePermissions } from '@/hooks/useRolePermissions';
import { CleanerEntryLoading } from '@/components/dashboard/CleanerEntryLoading';
const TasksPage = lazy(() => import('@/components/tasks/TasksPage'));
const CleanerTasksScreen = lazy(() => import('@/features/cleaner/CleanerTasksScreen'));

const Tasks = () => {
  const { isCleaner } = useRolePermissions();
  return (
    <div className="min-h-screen bg-gray-50">
      <Suspense fallback={<CleanerEntryLoading />}>{isCleaner() ? <CleanerTasksScreen /> : <TasksPage />}</Suspense>
    </div>
  );
};

export default Tasks;
