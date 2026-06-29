import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CleaningPlanningSummary } from '@/types/cleaningPlanning';
import { minutesToHoursLabel } from '@/utils/cleaningPlanning';
import { AlertTriangle, CheckCircle2, Clock, Users } from 'lucide-react';

interface PlanningSummaryCardsProps {
  summary: CleaningPlanningSummary;
}

export const PlanningSummaryCards = ({ summary }: PlanningSummaryCardsProps) => {
  const cards = [
    {
      title: 'Tareas activas',
      value: summary.totalTasks,
      detail: `${summary.assignedTasks} asignadas · ${summary.unassignedTasks} sin asignar`,
      icon: CheckCircle2,
      accent: 'text-emerald-200',
      surface: 'from-emerald-400/12 to-white/[0.03]',
    },
    {
      title: 'Sin asignar',
      value: summary.unassignedTasks,
      detail: 'Cola operativa pendiente',
      icon: Users,
      accent: 'text-amber-200',
      surface: 'from-amber-400/12 to-white/[0.03]',
    },
    {
      title: 'Riesgos',
      value: summary.conflictTasks + summary.overcapacityCleaners,
      detail: `${summary.conflictTasks} tareas · ${summary.overcapacityCleaners} personas sobrecargadas`,
      icon: AlertTriangle,
      accent: 'text-red-200',
      surface: 'from-red-400/12 to-white/[0.03]',
    },
    {
      title: 'Carga real',
      value: `${summary.utilizationPercent}%`,
      detail: `${minutesToHoursLabel(summary.plannedMinutes)} / ${minutesToHoursLabel(summary.capacityMinutes)}`,
      icon: Clock,
      accent: 'text-[#d8ccff]',
      surface: 'from-[#310984]/30 to-white/[0.03]',
    },
  ];

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      {cards.map((card) => {
        const Icon = card.icon;
        return (
          <Card key={card.title} className={`border-white/10 bg-[#0f1011] bg-gradient-to-br ${card.surface} text-white shadow-xl shadow-black/20 backdrop-blur`}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-xs font-medium uppercase tracking-[0.18em] text-white/45">{card.title}</CardTitle>
              <Icon className={`h-4 w-4 ${card.accent}`} />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-semibold tracking-tight">{card.value}</div>
              <p className="mt-1 text-xs text-white/50">{card.detail}</p>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
};
