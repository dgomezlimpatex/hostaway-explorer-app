import { useState } from 'react';
import { CleanerTodayTasksPage } from '@/components/tasks/CleanerTodayTasksPage';
import type { Task } from '@/types/calendar';
import { useCleanerTasks } from './useCleanerData';
import { CleanerTaskReportModal } from './CleanerTaskReportModal';
import { useMadridToday } from './useMadridToday';

export default function CleanerTasksScreen() {
  const today = useMadridToday();
  const { tasks, isLoading, error, hasData, refetch } = useCleanerTasks(today);
  const [selected, setSelected] = useState<Task | null>(null);
  return <>
    {error && !hasData && <div role="alert" className="m-4 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm">
      No se han podido cargar tus tareas. Abre la app con cobertura para descargarlas en este móvil.
      <button className="ml-2 min-h-11 font-semibold underline" onClick={() => void refetch()}>Reintentar</button>
    </div>}
    <CleanerTodayTasksPage tasks={tasks} isLoading={isLoading} onOpenReport={setSelected} unavailable={Boolean(error && !hasData)} />
    <CleanerTaskReportModal task={selected} open={Boolean(selected)} onOpenChange={open => { if (!open) setSelected(null); }} />
  </>;
}
