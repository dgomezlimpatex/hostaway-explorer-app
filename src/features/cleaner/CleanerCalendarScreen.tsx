import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { CleanerMobileCalendar } from '@/components/calendar/CleanerMobileCalendar';
import { CleanerDesktopCalendar } from '@/components/calendar/CleanerDesktopCalendar';
import { useIsMobile } from '@/hooks/use-mobile';
import { formatMadridDate } from '@/utils/date';
import type { Task } from '@/types/calendar';
import { CleanerTaskReportModal } from './CleanerTaskReportModal';
import { CleanerSyncStatus } from './CleanerSyncStatus';
import { useCleanerTasks } from './useCleanerData';
import { madridDayDate, useMadridToday } from './useMadridToday';
import { mergeCleanerCalendarTasks, useCleanerRecurring } from './useCleanerRecurring';
import { CleanerEntryLoading } from '@/components/dashboard/CleanerEntryLoading';

export default function CleanerCalendarScreen() {
  const today = useMadridToday();
  const [params] = useSearchParams();
  const [currentDate, setCurrentDate] = useState(() => {
    const date = params.get('date');
    return date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? madridDayDate(date) : today;
  });
  const [selected, setSelected] = useState<Task | null>(null);
  const data = useCleanerTasks(currentDate);
  const recurring = useCleanerRecurring(currentDate);
  const tasks = useMemo(() => mergeCleanerCalendarTasks(data.tasks, recurring.data || []), [data.tasks, recurring.data]);
  const isMobile = useIsMobile();
  const day = formatMadridDate(currentDate);
  const tomorrow = new Date(currentDate);
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
  const tomorrowKey = formatMadridDate(tomorrow);
  const requestedTask = params.get('taskId') || params.get('task');
  const openedLink = useRef<string | null>(null);
  useEffect(() => {
    if (requestedTask && data.hasData && openedLink.current !== requestedTask) {
      const task = tasks.find(item => item.id === requestedTask || item.originalTaskId === requestedTask);
      if (task) { setSelected(task); openedLink.current = requestedTask; }
    }
  }, [requestedTask, data.hasData, tasks]);
  const navigate = (direction: 'prev' | 'next') => setCurrentDate(current => {
    const date = new Date(current);
    date.setUTCDate(date.getUTCDate() + (direction === 'next' ? 1 : -1));
    return date;
  });
  const shared = {
    currentDate, onNavigateDate: navigate, onDateChange: setCurrentDate,
    handleTaskClick: setSelected,
    todayTasks: tasks.filter(task => task.date === day),
    tomorrowTasks: tasks.filter(task => task.date === tomorrowKey),
  };
  return <div className="min-h-screen bg-background">
    <CleanerSyncStatus className="mx-4 mt-3" />
    {recurring.error && <p className="mx-4 mt-2 text-xs text-amber-900">No se han podido actualizar las previsiones recurrentes. Las tareas asignadas se muestran debajo.</p>}
    {data.error && !data.hasData ? <div role="alert" className="m-4 rounded-xl bg-amber-50 p-4 text-sm">Este periodo no está descargado. Recupera cobertura para cargarlo.
      <button className="ml-2 min-h-11 underline" onClick={() => void data.refetch()}>Reintentar</button></div>
      : !isMobile && data.isLoading ? <CleanerEntryLoading />
      : isMobile ? <CleanerMobileCalendar {...shared} allTasks={tasks} isLoading={data.isLoading} />
      : <CleanerDesktopCalendar {...shared} />}
    <CleanerTaskReportModal task={selected} open={Boolean(selected)} onOpenChange={open => { if (!open) setSelected(null); }} />
  </div>;
}
