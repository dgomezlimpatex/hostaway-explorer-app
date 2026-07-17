import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import {
  AlertTriangle,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock,
  Home,
  MapPin,
  UserRound,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { MobileBottomNav } from '@/components/mobile/MobileBottomNav';
import { cn } from '@/lib/utils';
import { formatMadridDate } from '@/utils/date';
import { countTasksByAssignedCleaner, isTaskAssignedToCleaner } from '@/utils/taskAssignments';
import type { Cleaner, Task } from '@/types/calendar';

interface ManagerMobileAgendaCalendarProps {
  currentDate: Date;
  tasks: Task[];
  cleaners: Cleaner[];
  onNavigateDate: (direction: 'prev' | 'next') => void;
  onGoToToday: () => void;
  onTaskClick: (task: Task) => void;
  onNewTask: () => void;
  onNewBatchTask: () => void;
  onNewExtraordinaryService: () => void;
}

type AgendaFilter = 'all' | 'unassigned' | string;

const statusMeta = {
  completed: {
    label: 'OK',
    className: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  },
  'in-progress': {
    label: 'En curso',
    className: 'bg-blue-100 text-blue-800 border-blue-200',
  },
  pending: {
    label: 'Pendiente',
    className: 'bg-amber-100 text-amber-800 border-amber-200',
  },
} satisfies Record<Task['status'], { label: string; className: string }>;

function AgendaTaskCard({ task, onTaskClick }: { task: Task; onTaskClick: (task: Task) => void }) {
  const meta = statusMeta[task.status];

  return (
    <button
      type="button"
      onClick={() => onTaskClick(task)}
      className="w-full rounded-xl border bg-card p-3 text-left shadow-sm transition active:scale-[0.99]"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="mb-1 flex items-start justify-between gap-2">
            <h3 className="line-clamp-2 text-sm font-semibold text-slate-950">{task.property}</h3>
            <Badge variant="outline" className={cn('shrink-0 text-[10px]', meta.className)}>
              {meta.label}
            </Badge>
          </div>
          <div className="space-y-1 text-xs text-muted-foreground">
            <p className="flex items-center gap-1.5">
              <MapPin className="h-3.5 w-3.5 shrink-0" />
              <span className="line-clamp-1">{task.address}</span>
            </p>
            <div className="flex flex-wrap gap-3">
              <span className="flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5" />
                {task.startTime} - {task.endTime}
              </span>
              <span className="flex items-center gap-1.5">
                <UserRound className="h-3.5 w-3.5" />
                {task.cleaner || 'Sin asignar'}
              </span>
            </div>
          </div>
        </div>
      </div>
    </button>
  );
}

export function ManagerMobileAgendaCalendar({
  currentDate,
  tasks,
  cleaners,
  onNavigateDate,
  onGoToToday,
  onTaskClick,
  onNewTask,
  onNewBatchTask,
  onNewExtraordinaryService,
}: ManagerMobileAgendaCalendarProps) {
  const navigate = useNavigate();
  const [selectedFilter, setSelectedFilter] = useState<AgendaFilter>('all');
  const currentDateStr = formatMadridDate(currentDate);

  const dayTasks = useMemo(
    () => tasks.filter((task) => task.date === currentDateStr),
    [tasks, currentDateStr]
  );

  const summary = useMemo(() => {
    return {
      total: dayTasks.length,
      unassigned: dayTasks.filter((task) => !task.cleanerId && !task.cleaner).length,
      inProgress: dayTasks.filter((task) => task.status === 'in-progress').length,
      completed: dayTasks.filter((task) => task.status === 'completed').length,
    };
  }, [dayTasks]);

  const cleanerCounts = useMemo(() => {
    return countTasksByAssignedCleaner(dayTasks);
  }, [dayTasks]);

  const filteredTasks = useMemo(() => {
    if (selectedFilter === 'unassigned') {
      return dayTasks.filter((task) => !task.cleanerId && !task.cleaner);
    }
    if (selectedFilter !== 'all') {
      return dayTasks.filter((task) => isTaskAssignedToCleaner(task, selectedFilter));
    }
    return dayTasks;
  }, [dayTasks, selectedFilter]);

  const groupedTasks = useMemo(() => {
    const sorted = [...filteredTasks].sort((a, b) => {
      const timeDiff = a.startTime.localeCompare(b.startTime);
      if (timeDiff !== 0) return timeDiff;
      return a.property.localeCompare(b.property);
    });

    return sorted.reduce<Array<{ time: string; tasks: Task[] }>>((groups, task) => {
      const last = groups[groups.length - 1];
      if (last?.time === task.startTime) {
        last.tasks.push(task);
      } else {
        groups.push({ time: task.startTime, tasks: [task] });
      }
      return groups;
    }, []);
  }, [filteredTasks]);

  return (
    <div className="h-[100dvh] overflow-y-auto bg-slate-50 pb-28">
      <header className="sticky top-0 z-20 border-b bg-background/95 px-4 pb-3 pt-3 shadow-sm backdrop-blur">
        <div className="mb-3 flex items-center justify-between">
          <Button variant="outline" size="icon" onClick={() => navigate('/')} aria-label="Dashboard">
            <Home className="h-4 w-4" />
          </Button>
          <div className="text-center">
            <p className="text-xs font-medium uppercase tracking-wide text-blue-700">Agenda diaria</p>
            <h1 className="text-lg font-bold capitalize">
              {format(currentDate, 'EEEE d MMM', { locale: es })}
            </h1>
          </div>
          <Button variant="outline" size="sm" onClick={onGoToToday}>
            Hoy
          </Button>
        </div>

        <div className="mb-3 flex items-center justify-between gap-3">
          <Button variant="outline" size="icon" onClick={() => onNavigateDate('prev')} aria-label="Dia anterior">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div className="grid flex-1 grid-cols-4 gap-2">
            <Card className="border-0 bg-slate-950 text-white">
              <CardContent className="p-2 text-center">
                <div className="text-lg font-bold">{summary.total}</div>
                <div className="text-[10px] text-slate-300">Total</div>
              </CardContent>
            </Card>
            <Card className="border-0">
              <CardContent className="p-2 text-center">
                <div className="text-lg font-bold text-amber-700">{summary.unassigned}</div>
                <div className="text-[10px] text-muted-foreground">Sin asig.</div>
              </CardContent>
            </Card>
            <Card className="border-0">
              <CardContent className="p-2 text-center">
                <div className="text-lg font-bold text-blue-700">{summary.inProgress}</div>
                <div className="text-[10px] text-muted-foreground">Curso</div>
              </CardContent>
            </Card>
            <Card className="border-0">
              <CardContent className="p-2 text-center">
                <div className="text-lg font-bold text-emerald-700">{summary.completed}</div>
                <div className="text-[10px] text-muted-foreground">OK</div>
              </CardContent>
            </Card>
          </div>
          <Button variant="outline" size="icon" onClick={() => onNavigateDate('next')} aria-label="Dia siguiente">
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
          <Button
            size="sm"
            variant={selectedFilter === 'all' ? 'default' : 'outline'}
            className="shrink-0 rounded-full"
            onClick={() => setSelectedFilter('all')}
          >
            Todas ({summary.total})
          </Button>
          <Button
            size="sm"
            variant={selectedFilter === 'unassigned' ? 'default' : 'outline'}
            className="shrink-0 rounded-full"
            onClick={() => setSelectedFilter('unassigned')}
          >
            <AlertTriangle className="mr-1 h-3.5 w-3.5" />
            Sin asignar ({summary.unassigned})
          </Button>
          {cleaners
            .filter((cleaner) => (cleanerCounts.get(cleaner.id) || 0) > 0)
            .map((cleaner) => (
              <Button
                key={cleaner.id}
                size="sm"
                variant={selectedFilter === cleaner.id ? 'default' : 'outline'}
                className="shrink-0 rounded-full"
                onClick={() => setSelectedFilter(cleaner.id)}
              >
                {cleaner.name} ({cleanerCounts.get(cleaner.id)})
              </Button>
            ))}
        </div>
      </header>

      <main className="mx-auto max-w-md space-y-4 px-4 py-4">
        {groupedTasks.length > 0 ? (
          groupedTasks.map((group) => (
            <section key={group.time} className="space-y-2">
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                <Clock className="h-4 w-4 text-blue-600" />
                <span>{group.time}</span>
                <div className="h-px flex-1 bg-border" />
              </div>
              {group.tasks.map((task) => (
                <AgendaTaskCard key={task.id} task={task} onTaskClick={onTaskClick} />
              ))}
            </section>
          ))
        ) : (
          <Card className="border-dashed">
            <CardContent className="px-6 py-12 text-center">
              <CalendarDays className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
              <h2 className="font-semibold">No hay tareas para este filtro</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Cambia el filtro o crea una tarea para este dia.
              </p>
              <Button className="mt-4" onClick={onNewTask}>
                Crear tarea
              </Button>
            </CardContent>
          </Card>
        )}
      </main>

      <MobileBottomNav
        onNewTask={onNewTask}
        onNewBatchTask={onNewBatchTask}
        onNewExtraordinaryService={onNewExtraordinaryService}
      />
    </div>
  );
}
