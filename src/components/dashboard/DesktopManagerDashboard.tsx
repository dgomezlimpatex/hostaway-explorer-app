import React, { Suspense } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  Layers3,
  Plus,
  Route,
} from 'lucide-react';

import { SedeSelector } from '@/components/sede/SedeSelector';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
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
  attentionWidget?: React.ReactNode;
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
  workloadWidget: React.ReactNode;
}

const ComponentLoader = () => (
  <div className="flex min-h-[180px] items-center justify-center">
    <LoadingSpinner size="sm" />
  </div>
);

const DesktopManagerDashboard = ({
  attentionWidget,
  pendingIncidents,
  incidentStats,
  onOpenCreateModal,
  onOpenBatchModal,
  showRouteV2,
  showWorkloadWidget,
  workloadWidget,
}: DesktopManagerDashboardProps) => {
  const navigate = useNavigate();

  const activeIncidents = (incidentStats?.open ?? 0) + (incidentStats?.in_progress ?? 0);

  const actionCards = [
    {
      title: 'Nueva tarea',
      description: 'Crear una limpieza puntual',
      icon: Plus,
      onClick: onOpenCreateModal,
      className: 'border-line bg-surface text-ink-2 hover:bg-paper',
    },
    {
      title: 'Tareas múltiples',
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

  return (
    <div className="min-h-screen bg-paper px-6 py-6">
      <div className="mx-auto max-w-[1500px] space-y-6">
        <section aria-label="Sede activa y acciones" className="rounded-lg border border-line bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="shrink-0">
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-ink-2">
                Sede activa
              </p>
              <SedeSelector />
            </div>

            <div className="flex flex-wrap gap-2">
              {actionCards.map((action) => {
                const Icon = action.icon;

                return (
                  <button
                    key={action.title}
                    type="button"
                    onClick={action.onClick}
                    className={cn(
                      'flex min-h-12 items-center gap-2 rounded-lg border px-4 py-3 text-left text-sm font-semibold transition-colors',
                      action.className,
                    )}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    <span>{action.title}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </section>

        {attentionWidget}
        {showWorkloadWidget ? (
          <Suspense fallback={<ComponentLoader />}>{workloadWidget}</Suspense>
        ) : (
          <section className="rounded-lg border border-line bg-white p-4 text-sm text-ink-3 shadow-sm">
            Sin acceso al control de horas.
          </section>
        )}

        <div className="space-y-6">
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

        </div>
      </div>
    </div>
  );
};

export default DesktopManagerDashboard;
