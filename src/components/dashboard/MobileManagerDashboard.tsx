import { useMemo } from 'react';
import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import {
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  Clock,
  MapPin,
  Plus,
  Sparkles,
  Users,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { SedeSelector } from '@/components/sede/SedeSelector';
import { MobileBottomNav } from '@/components/mobile/MobileBottomNav';
import { cn } from '@/lib/utils';
import type { Task } from '@/types/calendar';

interface MonthlyMetrics {
  currentMonth: number;
  lastMonth: number;
  percentageChange: number;
  isPositive: boolean;
}

interface MobileManagerDashboardProps {
  todayTasks: Task[];
  unassignedTasks: Task[];
  monthlyMetrics: MonthlyMetrics;
  pendingIncidents: number;
  onTaskClick: (task: Task) => void;
  onOpenCreateModal: () => void;
  onOpenBatchModal: () => void;
  onOpenExtraordinaryServiceModal: () => void;
  showWorkloadWidget: boolean;
  showLinenWidget: boolean;
  workloadWidget?: ReactNode;
  linenWidget?: ReactNode;
}

const statusMeta = {
  completed: {
    label: 'Completada',
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

function TaskRow({ task, onTaskClick }: { task: Task; onTaskClick: (task: Task) => void }) {
  const meta = statusMeta[task.status];

  return (
    <button
      type="button"
      onClick={() => onTaskClick(task)}
      className="w-full rounded-xl border bg-card p-3 text-left shadow-sm transition active:scale-[0.99]"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="mb-1 flex items-center gap-2 text-sm font-semibold">
            <span className="tabular-nums text-blue-700">{task.startTime}</span>
            <span className="truncate">{task.property}</span>
          </div>
          <p className="line-clamp-1 text-xs text-muted-foreground">{task.address}</p>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            {task.cleaner && (
              <span className="inline-flex items-center gap-1">
                <Users className="h-3 w-3" />
                {task.cleaner}
              </span>
            )}
            <span className="inline-flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {task.startTime} - {task.endTime}
            </span>
          </div>
        </div>
        <Badge variant="outline" className={cn('shrink-0 text-[10px]', meta.className)}>
          {meta.label}
        </Badge>
      </div>
    </button>
  );
}

export function MobileManagerDashboard({
  todayTasks,
  unassignedTasks,
  monthlyMetrics,
  pendingIncidents,
  onTaskClick,
  onOpenCreateModal,
  onOpenBatchModal,
  onOpenExtraordinaryServiceModal,
  showWorkloadWidget,
  showLinenWidget,
  workloadWidget,
  linenWidget,
}: MobileManagerDashboardProps) {
  const navigate = useNavigate();
  const visibleTasks = todayTasks.slice(0, 8);

  const summary = useMemo(() => {
    return {
      pending: todayTasks.filter((task) => task.status === 'pending').length,
      inProgress: todayTasks.filter((task) => task.status === 'in-progress').length,
      completed: todayTasks.filter((task) => task.status === 'completed').length,
    };
  }, [todayTasks]);

  return (
    <div className="min-h-screen bg-slate-50 pb-28">
      <div className="mx-auto max-w-md space-y-4 px-4 py-4">
        <header className="space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-blue-700">Sistema de gestion</p>
              <h1 className="text-2xl font-bold text-slate-950">Hoy</h1>
              <p className="text-sm capitalize text-muted-foreground">
                {format(new Date(), "EEEE, d MMMM", { locale: es })}
              </p>
            </div>
            <div className="max-w-[170px]">
              <SedeSelector />
            </div>
          </div>

          <Card className="border-0 bg-slate-950 text-white shadow-lg">
            <CardContent className="p-4">
              <div className="grid grid-cols-4 gap-3 text-center">
                <div>
                  <div className="text-2xl font-bold">{todayTasks.length}</div>
                  <div className="text-[11px] text-slate-300">Tareas</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-amber-300">{summary.pending}</div>
                  <div className="text-[11px] text-slate-300">Pend.</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-sky-300">{summary.inProgress}</div>
                  <div className="text-[11px] text-slate-300">Curso</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-emerald-300">{summary.completed}</div>
                  <div className="text-[11px] text-slate-300">OK</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </header>

        <section className="grid grid-cols-2 gap-3">
          <Button onClick={onOpenCreateModal} className="h-20 flex-col gap-1 rounded-xl">
            <Plus className="h-5 w-5" />
            Nueva tarea
          </Button>
          <Button
            onClick={onOpenExtraordinaryServiceModal}
            variant="outline"
            className="h-20 flex-col gap-1 rounded-xl bg-white"
          >
            <Sparkles className="h-5 w-5 text-emerald-600" />
            Extraordinaria
          </Button>
          <Button
            onClick={() => navigate('/calendar')}
            variant="outline"
            className="h-16 justify-start gap-3 rounded-xl bg-white"
          >
            <CalendarDays className="h-5 w-5 text-blue-600" />
            Ver agenda
          </Button>
          <Button
            onClick={() => navigate('/calendar')}
            variant="outline"
            className="h-16 justify-start gap-3 rounded-xl bg-white"
          >
            <AlertTriangle className="h-5 w-5 text-amber-600" />
            Sin asignar ({unassignedTasks.length})
          </Button>
        </section>

        <section className="grid grid-cols-3 gap-2">
          <Card className="border-0 shadow-sm">
            <CardContent className="p-3">
              <p className="text-[11px] text-muted-foreground">Mes</p>
              <p className="text-xl font-bold">{monthlyMetrics.currentMonth}</p>
              <p className="text-[11px] text-muted-foreground">
                {monthlyMetrics.isPositive ? '+' : ''}{monthlyMetrics.percentageChange}%
              </p>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-sm">
            <CardContent className="p-3">
              <p className="text-[11px] text-muted-foreground">Incidencias</p>
              <p className="text-xl font-bold">{pendingIncidents}</p>
              <p className="text-[11px] text-muted-foreground">pendientes</p>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-sm">
            <CardContent className="p-3">
              <p className="text-[11px] text-muted-foreground">Anterior</p>
              <p className="text-xl font-bold">{monthlyMetrics.lastMonth}</p>
              <p className="text-[11px] text-muted-foreground">mes pasado</p>
            </CardContent>
          </Card>
        </section>

        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-base">
                <CheckCircle2 className="h-5 w-5 text-blue-600" />
                Tareas de hoy
              </CardTitle>
              <Button variant="ghost" size="sm" onClick={() => navigate('/calendar')}>
                Ver todas
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            {visibleTasks.length > 0 ? (
              visibleTasks.map((task) => (
                <TaskRow key={task.id} task={task} onTaskClick={onTaskClick} />
              ))
            ) : (
              <div className="rounded-xl border border-dashed py-8 text-center text-sm text-muted-foreground">
                No hay tareas programadas para hoy
              </div>
            )}
            {todayTasks.length > visibleTasks.length && (
              <Button variant="outline" className="w-full" onClick={() => navigate('/calendar')}>
                Ver {todayTasks.length - visibleTasks.length} mas en calendario
              </Button>
            )}
          </CardContent>
        </Card>

        {unassignedTasks.length > 0 && (
          <Card className="border-amber-200 bg-amber-50 shadow-sm">
            <CardContent className="flex items-center justify-between gap-3 p-4">
              <div>
                <p className="font-semibold text-amber-950">Tareas sin asignar</p>
                <p className="text-sm text-amber-800">{unassignedTasks.length} necesitan trabajador</p>
              </div>
              <Button variant="outline" size="sm" onClick={() => navigate('/calendar')}>
                Revisar
              </Button>
            </CardContent>
          </Card>
        )}

        {(showWorkloadWidget || showLinenWidget) && (
          <section className="space-y-3">
            {showWorkloadWidget && workloadWidget}
            {showLinenWidget && linenWidget}
          </section>
        )}
      </div>

      <MobileBottomNav
        onNewTask={onOpenCreateModal}
        onNewBatchTask={onOpenBatchModal}
        onNewExtraordinaryService={onOpenExtraordinaryServiceModal}
      />
    </div>
  );
}
