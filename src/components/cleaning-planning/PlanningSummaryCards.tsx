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
    },
    {
      title: 'Sin asignar',
      value: summary.unassignedTasks,
      detail: 'Prioridad para planificar',
      icon: Users,
    },
    {
      title: 'Riesgos',
      value: summary.conflictTasks + summary.overcapacityCleaners,
      detail: `${summary.conflictTasks} tareas · ${summary.overcapacityCleaners} personas sobrecargadas`,
      icon: AlertTriangle,
    },
    {
      title: 'Carga prevista',
      value: `${summary.utilizationPercent}%`,
      detail: `${minutesToHoursLabel(summary.plannedMinutes)} / ${minutesToHoursLabel(summary.capacityMinutes)}`,
      icon: Clock,
    },
  ];

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      {cards.map((card) => {
        const Icon = card.icon;
        return (
          <Card key={card.title}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{card.title}</CardTitle>
              <Icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{card.value}</div>
              <p className="text-xs text-muted-foreground">{card.detail}</p>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
};
