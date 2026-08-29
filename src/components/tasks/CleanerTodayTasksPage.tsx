import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  Circle,
  Clock3,
  ListChecks,
  MapPin,
  PlayCircle,
} from 'lucide-react';
import { OperationalModeSwitcher } from '@/components/auth/OperationalModeSwitcher';
import { UserMenu } from '@/components/auth/UserMenu';
import { TaskPreviewModal } from '@/components/modals/TaskPreviewModal';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/hooks/useAuth';
import { useCleaners } from '@/hooks/useCleaners';
import { cn } from '@/lib/utils';
import type { Task } from '@/types/calendar';
import { formatMadridDate, getTodayMadrid } from '@/utils/date';
import { isTaskAssignedToCleaner } from '@/utils/taskAssignments';
import {
  getEffectiveTaskDurationMinutes,
  getEffectiveTaskEndTime,
} from '@/utils/taskPositioning';

type TodayTaskFilter = 'all' | Task['status'];

interface CleanerTodayTasksPageProps {
  tasks: Task[];
  isLoading: boolean;
  onOpenReport: (task: Task) => void;
}

const statusMeta: Record<Task['status'], {
  label: string;
  shortLabel: string;
  icon: typeof Circle;
  cardClass: string;
  badgeClass: string;
  railClass: string;
}> = {
  pending: {
    label: 'Pendiente',
    shortLabel: 'Pendientes',
    icon: Circle,
    cardClass: 'border-[#eadff8] bg-white hover:border-[#c9b1ed]',
    badgeClass: 'bg-[#fff1e8] text-[#aa4b22]',
    railClass: 'bg-[#e37a46]',
  },
  'in-progress': {
    label: 'En curso',
    shortLabel: 'En curso',
    icon: PlayCircle,
    cardClass: 'border-[#cddcf8] bg-[#f8fbff] hover:border-[#89acec]',
    badgeClass: 'bg-[#e8f1ff] text-[#28599f]',
    railClass: 'bg-[#4f7fd2]',
  },
  completed: {
    label: 'Completada',
    shortLabel: 'Hechas',
    icon: CheckCircle2,
    cardClass: 'border-[#ccebdc] bg-[#f8fdf9] hover:border-[#83c9a4]',
    badgeClass: 'bg-[#e6f7ed] text-[#187248]',
    railClass: 'bg-[#32a66a]',
  },
};

const formatMinutes = (minutes: number) => {
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  if (hours === 0) return `${remainder} min`;
  if (remainder === 0) return `${hours} h`;
  return `${hours} h ${remainder} min`;
};

const formatTime = (time: string) => time.slice(0, 5);

const CleanerTaskRow = ({ task, onOpen }: { task: Task; onOpen: () => void }) => {
  const meta = statusMeta[task.status];
  const StatusIcon = meta.icon;
  const duration = getEffectiveTaskDurationMinutes(task);
  const endTime = getEffectiveTaskEndTime(task);
  const code = task.propertyCode || task.property;
  const propertyName = task.propertyName || (task.property !== code ? task.property : '');
  return (
    <article className="relative grid grid-cols-[4.35rem_minmax(0,1fr)] gap-3 sm:grid-cols-[5rem_minmax(0,1fr)] sm:gap-4">
      <div className="pt-4 text-right">
        <p className="text-base font-black tracking-[-0.03em] text-[#2b1b3c] sm:text-lg">{formatTime(task.startTime)}</p>
        <p className="mt-0.5 text-[11px] font-semibold text-[#968aa3]">{formatMinutes(duration)}</p>
      </div>

      <button
        type="button"
        onClick={onOpen}
        className={cn(
          'group relative min-w-0 overflow-hidden rounded-2xl border p-4 text-left shadow-[0_8px_24px_rgba(44,20,78,0.06)] transition duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6d40ca] focus-visible:ring-offset-2 active:scale-[0.99] sm:p-5',
          meta.cardClass,
        )}
      >
        <span className={cn('absolute inset-y-0 left-0 w-1', meta.railClass)} aria-hidden="true" />

        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="truncate text-lg font-black tracking-[-0.035em] text-[#21142f] sm:text-xl">{code}</h2>
              <span className={cn('inline-flex items-center gap-1 rounded-full px-2 py-1 text-[10px] font-black uppercase tracking-[0.08em]', meta.badgeClass)}>
                <StatusIcon className="h-3 w-3" aria-hidden="true" />
                {meta.label}
              </span>
            </div>
            {propertyName && <p className="mt-1 truncate text-sm font-semibold text-[#756a80]">{propertyName}</p>}
          </div>
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#f3edfb] text-[#5c309b] transition-transform group-hover:translate-x-0.5">
            <ChevronRight className="h-5 w-5" aria-hidden="true" />
          </span>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs font-semibold text-[#665a72]">
          <span className="inline-flex items-center gap-1.5">
            <Clock3 className="h-3.5 w-3.5 text-[#7b53b8]" aria-hidden="true" />
            {formatTime(task.startTime)} - {formatTime(endTime)}
          </span>
          {task.address && (
            <span className="inline-flex min-w-0 items-center gap-1.5 text-[#5c309b]">
              <MapPin className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              <span className="max-w-[14rem] truncate sm:max-w-md">{task.address}</span>
            </span>
          )}
        </div>
      </button>
    </article>
  );
};

export const CleanerTodayTasksPage = ({ tasks, isLoading, onOpenReport }: CleanerTodayTasksPageProps) => {
  const { user } = useAuth();
  const { cleaners, isInitialLoading: cleanersLoading } = useCleaners();
  const [filter, setFilter] = useState<TodayTaskFilter>('all');
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const today = useMemo(() => getTodayMadrid(), []);
  const todayKey = formatMadridDate(today);

  const currentCleaner = useMemo(
    () => cleaners.find((cleaner) => cleaner.user_id === user?.id) || null,
    [cleaners, user?.id],
  );

  const todayTasks = useMemo(
    () => tasks
      .filter((task) => (
        task.date === todayKey
        && currentCleaner
        && isTaskAssignedToCleaner(task, currentCleaner.id, currentCleaner.name)
      ))
      .sort((a, b) => a.startTime.localeCompare(b.startTime)),
    [tasks, todayKey, currentCleaner],
  );

  const counts = useMemo(() => ({
    pending: todayTasks.filter((task) => task.status === 'pending').length,
    'in-progress': todayTasks.filter((task) => task.status === 'in-progress').length,
    completed: todayTasks.filter((task) => task.status === 'completed').length,
  }), [todayTasks]);

  const visibleTasks = filter === 'all'
    ? todayTasks
    : todayTasks.filter((task) => task.status === filter);

  const totalMinutes = todayTasks.reduce(
    (sum, task) => sum + getEffectiveTaskDurationMinutes(task),
    0,
  );
  const completedCount = counts.completed;
  const remainingCount = counts.pending + counts['in-progress'];
  const progress = todayTasks.length > 0 ? Math.round((completedCount / todayTasks.length) * 100) : 0;
  const dateLabel = new Intl.DateTimeFormat('es-ES', {
    timeZone: 'Europe/Madrid',
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(today);

  const filters: Array<{ value: TodayTaskFilter; label: string; count: number }> = [
    { value: 'all', label: 'Todas', count: todayTasks.length },
    { value: 'pending', label: 'Pendientes', count: counts.pending },
    { value: 'in-progress', label: 'En curso', count: counts['in-progress'] },
    { value: 'completed', label: 'Hechas', count: counts.completed },
  ];

  return (
    <div className="cleaner-dashboard-shell min-h-screen pb-10">
      <header className="cleaner-dashboard-header sticky top-0 z-30">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-6 sm:py-4 lg:px-8">
          <div className="flex min-w-0 items-center gap-2">
            <Button asChild variant="ghost" size="icon" className="h-11 w-11 shrink-0 rounded-2xl text-[#55308d] hover:bg-[#f1eaff]">
              <Link to="/" aria-label="Volver al panel">
                <ArrowLeft className="h-5 w-5" />
              </Link>
            </Button>
            <Link to="/" className="flex min-w-0 items-center gap-2.5" aria-label="Limpatex, volver al panel">
              <img src="/limpatex-logo.png" alt="Limpatex" width="44" height="44" className="h-10 w-10 shrink-0 object-contain" />
              <span className="min-w-0">
                <span className="block truncate text-sm font-black tracking-[-0.02em] text-[#24123f]">Mis tareas</span>
                <span className="block truncate text-[11px] font-medium capitalize text-[#817493]">{dateLabel}</span>
              </span>
            </Link>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <OperationalModeSwitcher compact />
            <div className="rounded-2xl border border-white/80 bg-white/70 p-0.5 shadow-sm backdrop-blur">
              <UserMenu />
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl px-4 pt-5 sm:px-6 sm:pt-8 lg:px-8">
        <section className="overflow-hidden rounded-[1.75rem] bg-[#351267] px-5 py-5 text-white shadow-[0_18px_48px_rgba(49,9,132,0.16)] sm:px-7 sm:py-6">
          <div className="flex items-start justify-between gap-5">
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[#c8b5e8]">Jornada de hoy</p>
              <h1 className="mt-1 text-3xl font-semibold tracking-[-0.055em] sm:text-4xl">
                {todayTasks.length === 0 ? 'Día despejado' : `${remainingCount} ${remainingCount === 1 ? 'tarea pendiente' : 'tareas pendientes'}`}
              </h1>
              <p className="mt-2 text-sm text-white/65">
                {todayTasks.length === 0
                  ? 'No tienes limpiezas asignadas para hoy.'
                  : `${completedCount} de ${todayTasks.length} completadas · ${formatMinutes(totalMinutes)} planificadas`}
              </p>
            </div>
            <div className="flex h-16 w-16 shrink-0 flex-col items-center justify-center rounded-2xl border border-white/15 bg-white/10 sm:h-20 sm:w-20">
              <span className="text-xl font-black sm:text-2xl">{progress}%</span>
              <span className="text-[9px] font-bold uppercase tracking-[0.12em] text-white/55">Hecho</span>
            </div>
          </div>
          <div className="mt-5 h-2 overflow-hidden rounded-full bg-white/12">
            <div className="h-full rounded-full bg-gradient-to-r from-[#ffc7ad] to-[#d8c7ff] transition-[width] duration-500" style={{ width: `${progress}%` }} />
          </div>
        </section>

        <nav className="mt-4 flex gap-2 overflow-x-auto pb-1" aria-label="Filtrar tareas de hoy">
          {filters.map((item) => (
            <button
              key={item.value}
              type="button"
              onClick={() => setFilter(item.value)}
              className={cn(
                'inline-flex min-h-11 shrink-0 items-center gap-2 rounded-xl border px-3.5 text-xs font-black transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6d40ca]',
                filter === item.value
                  ? 'border-[#4b1c8c] bg-[#4b1c8c] text-white shadow-sm'
                  : 'border-[#e4dbea] bg-white/85 text-[#5f526b] hover:bg-[#f5f0fa]',
              )}
              aria-pressed={filter === item.value}
            >
              {item.label}
              <span className={cn('rounded-full px-1.5 py-0.5 text-[10px]', filter === item.value ? 'bg-white/15' : 'bg-[#eee7f5] text-[#5c309b]')}>
                {item.count}
              </span>
            </button>
          ))}
          <Button asChild variant="outline" className="ml-auto min-h-11 shrink-0 rounded-xl border-[#ded3e8] bg-white/85 text-[#5c309b]">
            <Link to="/calendar">
              <CalendarDays className="mr-2 h-4 w-4" />
              Ver calendario
            </Link>
          </Button>
        </nav>

        <section className="mt-5" aria-live="polite">
          {isLoading || cleanersLoading ? (
            <div className="space-y-3">
              {[0, 1, 2].map((item) => <Skeleton key={item} className="ml-[5rem] h-32 rounded-2xl" />)}
            </div>
          ) : visibleTasks.length > 0 ? (
            <div className="space-y-3 sm:space-y-4">
              {visibleTasks.map((task) => (
                <CleanerTaskRow key={task.id} task={task} onOpen={() => setSelectedTask(task)} />
              ))}
            </div>
          ) : todayTasks.length === 0 ? (
            <div className="rounded-[1.75rem] border border-dashed border-[#d8cbe5] bg-white/70 px-6 py-12 text-center">
              <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#f0e8fa] text-[#6d40ca]">
                <ListChecks className="h-7 w-7" aria-hidden="true" />
              </span>
              <h2 className="mt-4 text-xl font-black tracking-[-0.035em] text-[#29183b]">Hoy no tienes tareas</h2>
              <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-[#776b82]">Consulta el calendario para revisar los próximos servicios asignados.</p>
              <Button asChild className="mt-5 min-h-11 rounded-xl bg-[#4b1c8c] px-5 hover:bg-[#3c146f]">
                <Link to="/calendar">
                  <CalendarDays className="mr-2 h-4 w-4" />
                  Abrir calendario
                </Link>
              </Button>
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-[#d8cbe5] bg-white/70 px-5 py-9 text-center">
              <p className="font-bold text-[#362743]">No hay tareas en este estado.</p>
              <button type="button" onClick={() => setFilter('all')} className="mt-2 text-sm font-bold text-[#6334a5] hover:underline">Ver todas</button>
            </div>
          )}
        </section>
      </main>

      <TaskPreviewModal
        task={selectedTask}
        open={Boolean(selectedTask)}
        onOpenChange={(open) => !open && setSelectedTask(null)}
        onCreateReport={onOpenReport}
        onViewReport={onOpenReport}
      />
    </div>
  );
};
