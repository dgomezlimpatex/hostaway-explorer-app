
import { Card, CardContent } from '@/components/ui/card';
import { BarChart3, Building2, Users, TrendingUp } from 'lucide-react';

interface SummaryData {
  totalTasksAnalyzed: number;
  avgEfficiency: number;
  propertiesNeedingAdjustment: number;
  cleanersWithIssues: number;
}

interface AnalyticsSummaryCardsProps {
  summary: SummaryData;
}

export const AnalyticsSummaryCards = ({ summary }: AnalyticsSummaryCardsProps) => {
  const cards = [
    {
      title: 'Tareas Analizadas',
      value: summary.totalTasksAnalyzed.toLocaleString(),
      icon: BarChart3,
      description: 'Total de tareas con datos completos',
      color: 'text-primary',
      bgColor: 'bg-primary/10',
    },
    {
      title: 'Eficiencia Promedio',
      value: `${summary.avgEfficiency}%`,
      icon: TrendingUp,
      description: summary.avgEfficiency >= 90 ? 'Excelente rendimiento' : summary.avgEfficiency >= 75 ? 'Buen rendimiento' : 'Necesita mejora',
      color: summary.avgEfficiency >= 90 ? 'text-success' : summary.avgEfficiency >= 75 ? 'text-warning' : 'text-destructive',
      bgColor: summary.avgEfficiency >= 90 ? 'bg-success/10' : summary.avgEfficiency >= 75 ? 'bg-warning/10' : 'bg-destructive/10',
    },
    {
      title: 'Propiedades a Ajustar',
      value: summary.propertiesNeedingAdjustment.toString(),
      icon: Building2,
      description: 'Estimaciones incorrectas (>15%)',
      color: summary.propertiesNeedingAdjustment > 5 ? 'text-warning' : 'text-muted-foreground',
      bgColor: summary.propertiesNeedingAdjustment > 5 ? 'bg-warning/10' : 'bg-muted',
    },
    {
      title: 'Trabajadores con Alertas',
      value: summary.cleanersWithIssues.toString(),
      icon: Users,
      description: 'Eficiencia <80% o retrasos >30%',
      color: summary.cleanersWithIssues > 0 ? 'text-destructive' : 'text-success',
      bgColor: summary.cleanersWithIssues > 0 ? 'bg-destructive/10' : 'bg-success/10',
    },
  ];

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {cards.map((card) => (
        <Card key={card.title}>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className={`p-3 rounded-lg ${card.bgColor}`}>
                <card.icon className={`h-6 w-6 ${card.color}`} />
              </div>
              <div className="space-y-1">
                <p className="text-sm font-medium text-muted-foreground">{card.title}</p>
                <p className={`text-2xl font-bold ${card.color}`}>{card.value}</p>
                <p className="text-xs text-muted-foreground">{card.description}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};
