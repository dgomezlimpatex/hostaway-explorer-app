import React, { Suspense } from 'react';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import {
  AlertTriangle,
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  Clock3,
  Layers3,
  Plus,
  Route,
  Sparkles,
  Users,
} from 'lucide-react';

import { SedeSelector } from '@/components/sede/SedeSelector';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { cn } from '@/lib/utils';
import { Task } from '@/types/calendar';

interface MonthlyMetrics {
  currentMonth: number;
  lastMonth: number;
  percentageChange: number;
  isPositive: boolean;
}

interface IncidentDashboardStats {
  total: number;
  pending_limpatex: number;
  open: number;
  in_progress: number;
  resolved: number;
  discarded: number;
}

interface DesktopManagerDashboardProps {
  todayTasks: Task[];
  unassignedTasks: Task[];
  monthlyMetrics: MonthlyMetrics;
  pendingIncidents: number;
  incidentStats?: IncidentDashboardStats;
  onTaskClick: (task: Task) => void;
  onOpenCreateModal: () => void;
  onOpenBatchModal: () => void;
  showRouteV2: boolean;
  showWorkloadWidget: boolean;
  showLinenWidget: boolean;
  workloadWidget: React.ReactNode;
  linenWidget: React.ReactNode;
}

const statusConfig = {
  completed: {
    label: 'Completada',
    className: 'border-line bg-surface text-success',
  },
  'in-progress': {
    label: 'En curso',
    className: 'border-line bg-surface text-ink-2',
  },
  pending: {
    label: 'Pendiente',
    className: 'border-line bg-surface text-warning',
  },
};

const ComponentLoader = () => (
  <div className="flex min-h-[180px] items-center justify-center">
    <LoadingSpinner size="sm" />
  </div>
);

const formatPercent = (value: number) => `${value > 0 ? '+' : ''}${value}%`;

const DesktopManagerDashboard = ({
  todayTasks,
  unassignedTasks,
  monthlyMetrics,
  pendingIncidents,
  incidentStats,
  onTaskClick,
  onOpenCreateModal,
  onOpenBatchModal,
  showRouteV2,
  showWorkloadWidget,
  showLinenWidget,
  workloadWidget,
  linenWidget,
}: DesktopManagerDashboardProps) => {
  const navigate = useNavigate();

  const completedToday = todayTasks.filter((task) => task.status === 'completed').length;
  const inProgressToday = todayTasks.filter((task) => task.status === 'in-progress').length;
  const pendingToday = todayTasks.filter((task) => task.status === 'pending').length;
  const progressToday = todayTasks.length > 0 ? Math.round((completedToday / todayTasks.length) * 100) : 0;
  const activeIncidents = (incidentStats?.open ?? 0) + (incidentStats?.in_progress ?? 0);

  const sortedTodayTasks = [...todayTasks].sort((a, b) => a.startTime.localeCompare(b.startTime));
  const nextTasks = sortedTodayTasks.filter((task) => task.status !== 'completed').slice(0, 8);
  const urgentUnassigned = unassignedTasks
    .filter((task) => task.status !== 'completed')
    .sort((a, b) => `${a.date} ${a.startTime}`.localeCompare(`${b.date} ${b.startTime}`))
    .slice(0, 5);

  const actionCards = [
    {
      title: 'Nueva tarea',
      description: 'Crear una limpieza puntual',
      icon: Plus,
      onClick: onOpenCreateModal,
      className: 'border-line bg-surface text-ink-2 hover:bg-paper',
    },
    {
      title: 'Tareas multiples',
      description: 'Planificar en lote',
      icon: Layers3,
      onClick: onOpenBatchModal,
      className: 'border-line bg-surface text-brand hover:bg-paper',
    },
    ...(showRouteV2 ? [{
      title: 'Nuevo sistema de ruta',
      description: 'Probar el nuevo flujo de lavandería',
      icon: Route,
      onClick: () => navigate('/lavanderia/nuevo-sistema'),
      className: 'border-line bg-surface text-brand hover:bg-line-soft',
    }] : []),
  ];

  const healthCards = [
    {
      label: 'Tareas hoy',
      value: todayTasks.length,
      detail: `${completedToday} completadas`,
      icon: CalendarDays,
      accent: 'text-ink-2 bg-surface border-line',
    },
    {
      label: 'Sin asignar',
      value: unassignedTasks.length,
      detail: unassignedTasks.length > 0 ? 'requieren revision' : 'todo cubierto',
      icon: Users,
      accent: unassignedTasks.length > 0 ? 'text-warning bg-surface border-line' : 'text-success bg-surface border-line',
    },
    {
      label: 'Incidencias',
      value: pendingIncidents,
      detail: pendingIncidents > 0 ? 'pendientes' : 'sin alertas',
      icon: AlertTriangle,
      accent: pendingIncidents > 0 ? 'text-danger bg-surface border-line' : 'text-success bg-surface border-line',
    },
    {
      label: 'Mes actual',
      value: monthlyMetrics.currentMonth,
      detail: `${formatPercent(monthlyMetrics.percentageChange)} vs mes pasado`,
      icon: CheckCircle2,
      accent: monthlyMetrics.isPositive ? 'text-success bg-surface border-line' : 'text-danger bg-surface border-line',
    },
  ];

  return (
    <div className="min-h-screen bg-paper px-6 py-6">
      <div className="mx-auto max-w-[1500px] space-y-6">
        <section className="rounded-lg border border-line bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="max-w-3xl">
              <div className="mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-ink-2">
                <Sparkles className="h-4 w-4" />
                Centro de mando operativo
              </div>
              <h1 className="text-3xl font-semibold tracking-tight text-ink">
                Dashboard de gestion
              </h1>
              <p className="mt-1 text-sm text-ink-3">
                {format(new Date(), "EEEE, d 'de' MMMM 'de' yyyy", { locale: es })}
              </p>
            </div>

            <div className="rounded-lg border border-line bg-surface/70 p-3">
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-ink-2">
                Sede activa
              </p>
              <SedeSelector />
            </div>
          </div>

          <div className="mt-5 grid gap-4 xl:grid-cols-[minmax(0,1fr)_420px]">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {healthCards.map((card) => {
                const Icon = card.icon;

                return (
                  <div key={card.label} className={cn('rounded-lg border p-3', card.accent)}>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] opacity-75">
                          {card.label}
                        </p>
                        <p className="mt-1 text-2xl font-semibold tabular-nums">{card.value}</p>
                        <p className="mt-0.5 text-xs font-medium opacity-80">{card.detail}</p>
                      </div>
                      <Icon className="h-4 w-4 opacity-80" />
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="rounded-lg bg-ink p-4 text-white">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-cyan-200">
                    Pulso del dia
                  </p>
                  <h2 className="mt-1 text-xl font-semibold">{progressToday}% completado</h2>
                </div>
                <div className="rounded-lg border border-white/10 bg-white/10 px-3 py-2 text-right">
                  <p className="text-xl font-semibold tabular-nums">{completedToday}/{todayTasks.length}</p>
                  <p className="text-[11px] text-ink-4">tareas</p>
                </div>
              </div>

              <Progress value={progressToday} className="mt-3 h-1.5 bg-white/15 [&>div]:bg-line" />

              <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                <div className="rounded-lg bg-white/10 px-3 py-2">
                  <p className="text-lg font-semibold tabular-nums">{pendingToday}</p>
                  <p className="text-[11px] text-ink-4">pendientes</p>
                </div>
                <div className="rounded-lg bg-white/10 px-3 py-2">
                  <p className="text-lg font-semibold tabular-nums">{inProgressToday}</p>
                  <p className="text-[11px] text-ink-4">en curso</p>
                </div>
                <div className="rounded-lg bg-white/10 px-3 py-2">
                  <p className="text-lg font-semibold tabular-nums">{urgentUnassigned.length}</p>
                  <p className="text-[11px] text-ink-4">criticas</p>
                </div>
              </div>

              <div className={cn('mt-3 grid gap-2', showRouteV2 ? 'grid-cols-2' : 'grid-cols-3')}>
                {actionCards.map((action) => {
                  const Icon = action.icon;

                  return (
                    <button
                      key={action.title}
                      type="button"
                      onClick={action.onClick}
                      className={cn(
                        'flex min-h-12 items-center gap-2 rounded-lg border px-3 py-2 text-left text-xs font-semibold transition-colors',
                        action.className,
                      )}
                    >
                      <Icon className="h-4 w-4 shrink-0" />
                      <span className="truncate">{action.title}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </section>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
          <section className="rounded-lg border border-line bg-white shadow-sm">
            <div className="flex items-center justify-between gap-4 border-b border-line px-5 py-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-ink-2">
                  Agenda inmediata
                </p>
                <h2 className="mt-1 text-xl font-semibold text-ink">Tareas de hoy</h2>
              </div>
              <Button variant="outline" onClick={() => navigate('/calendar')}>
                Ver calendario
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>

            <div className="p-4">
              {nextTasks.length === 0 ? (
                <div className="flex min-h-[260px] flex-col items-center justify-center rounded-lg border border-dashed border-line bg-paper text-center">
                  <CheckCircle2 className="h-10 w-10 text-success" />
                  <p className="mt-3 text-base font-semibold text-ink">Dia bajo control</p>
                  <p className="mt-1 text-sm text-ink-3">No quedan tareas pendientes para hoy.</p>
                </div>
              ) : (
                <div className="grid gap-3 lg:grid-cols-2">
                  {nextTasks.map((task) => {
                    const status = statusConfig[task.status];

                    return (
                      <button
                        key={task.id}
                        type="button"
                        onClick={() => onTaskClick(task)}
                        className="group rounded-lg border border-line bg-white p-4 text-left transition hover:border-line hover:bg-surface/40 hover:shadow-sm"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="truncate text-base font-semibold text-ink">
                              {task.propertyCode || task.property}
                            </p>
                            <p className="mt-1 truncate text-sm text-ink-3">{task.property}</p>
                          </div>
                          <Badge variant="outline" className={cn('shrink-0', status.className)}>
                            {status.label}
                          </Badge>
                        </div>

                        <div className="mt-4 grid gap-2 text-sm text-ink-3 sm:grid-cols-2">
                          <span className="flex items-center gap-2">
                            <Clock3 className="h-4 w-4 text-ink-4" />
                            {task.startTime} - {task.endTime}
                          </span>
                          <span className="flex min-w-0 items-center gap-2">
                            <Users className="h-4 w-4 text-ink-4" />
                            <span className="truncate">{task.cleaner || 'Sin asignar'}</span>
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </section>

          <aside className="space-y-6">
            <section className="rounded-lg border border-line bg-white shadow-sm">
              <div className="flex items-start justify-between gap-3 border-b border-line px-5 py-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-danger">
                    Incidencias
                  </p>
                  <h2 className="mt-1 text-xl font-semibold text-ink">Revisión operativa</h2>
                </div>
                {pendingIncidents > 0 && (
                  <Badge variant="destructive" className="rounded-full">
                    {pendingIncidents} pendientes
                  </Badge>
                )}
              </div>
              <div className="space-y-3 p-4">
                <div className="grid grid-cols-2 gap-2">
                  <div className="rounded-lg border border-line bg-surface p-3">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-danger">
                      Pendientes
                    </p>
                    <p className="mt-1 text-2xl font-semibold tabular-nums text-danger">
                      {pendingIncidents}
                    </p>
                  </div>
                  <div className="rounded-lg border border-line bg-surface p-3">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-2">
                      Activas
                    </p>
                    <p className="mt-1 text-2xl font-semibold tabular-nums text-ink">
                      {activeIncidents}
                    </p>
                  </div>
                  <div className="rounded-lg border border-line bg-surface p-3">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-2">
                      En curso
                    </p>
                    <p className="mt-1 text-2xl font-semibold tabular-nums text-ink">
                      {incidentStats?.in_progress ?? 0}
                    </p>
                  </div>
                  <div className="rounded-lg border border-line bg-surface p-3">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-success">
                      Resueltas
                    </p>
                    <p className="mt-1 text-2xl font-semibold tabular-nums text-ink">
                      {incidentStats?.resolved ?? 0}
                    </p>
                  </div>
                </div>
                <Button variant="outline" className="w-full" onClick={() => navigate('/cleaning-reports')}>
                  Revisar incidencias
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </section>

            <section className="rounded-lg border border-line bg-white shadow-sm">
              <div className="border-b border-line px-5 py-4">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-warning">
                  Riesgo operativo
                </p>
                <h2 className="mt-1 text-xl font-semibold text-ink">Sin asignar</h2>
              </div>
              <div className="p-4">
                {urgentUnassigned.length === 0 ? (
                  <div className="rounded-lg border border-line bg-surface p-4 text-sm text-success">
                    Todas las tareas visibles tienen responsable asignado.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {urgentUnassigned.map((task) => (
                      <button
                        key={task.id}
                        type="button"
                        onClick={() => onTaskClick(task)}
                        className="w-full rounded-lg border border-line bg-surface/70 p-3 text-left transition hover:bg-paper"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-ink">
                              {task.propertyCode || task.property}
                            </p>
                            <p className="mt-1 text-xs text-ink-3">
                              {format(new Date(task.date), 'EEE d MMM', { locale: es })} · {task.startTime}
                            </p>
                          </div>
                          <AlertTriangle className="h-4 w-4 shrink-0 text-warning" />
                        </div>
                      </button>
                    ))}
                    <Button variant="outline" className="w-full" onClick={() => navigate('/calendar')}>
                      Revisar calendario
                    </Button>
                  </div>
                )}
              </div>
            </section>

            {showWorkloadWidget ? (
              <Suspense fallback={<ComponentLoader />}>{workloadWidget}</Suspense>
            ) : (
              <section className="rounded-lg border border-line bg-white p-4 text-sm text-ink-3 shadow-sm">
                Sin acceso al control de horas.
              </section>
            )}

            {showLinenWidget ? (
              <Suspense fallback={<ComponentLoader />}>{linenWidget}</Suspense>
            ) : (
              <section className="rounded-lg border border-line bg-white p-4 text-sm text-ink-3 shadow-sm">
                Sin acceso al control de mudas.
              </section>
            )}
          </aside>
        </div>
      </div>
    </div>
  );
};

export default DesktopManagerDashboard;
