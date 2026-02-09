import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Clock, ChevronRight } from 'lucide-react';
import { useCurrentWeekWorkload } from '@/hooks/useWorkloadCalculation';
import { getProgressBarColor, getStatusColor, WorkloadSummary } from '@/types/workload';
import { Link } from 'react-router-dom';
import { format, startOfWeek, endOfWeek } from 'date-fns';
import { es } from 'date-fns/locale';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { cn } from '@/lib/utils';

const statusOrder: Record<WorkloadSummary['status'], number> = {
  'critical-deficit': 0,
  'deficit': 1,
  'overtime': 2,
  'on-track': 3,
};

export const WorkloadWidget = () => {
  const { data: workloadData, isLoading } = useCurrentWeekWorkload();
  
  const now = new Date();
  const weekStart = startOfWeek(now, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(now, { weekStartsOn: 1 });

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Control de Horas
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <LoadingSpinner size="sm" />
          </div>
        </CardContent>
      </Card>
    );
  }

  const workersWithContracts = (workloadData || [])
    .filter(w => w.contractHoursPerWeek > 0)
    .sort((a, b) => statusOrder[a.status] - statusOrder[b.status]);

  const getDiffText = (w: WorkloadSummary) => {
    if (w.overtimeHours > 0) return `+${w.overtimeHours.toFixed(1)}`;
    if (w.remainingHours > 0) return `-${w.remainingHours.toFixed(1)}`;
    return '0';
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Control de Horas
          </CardTitle>
          <Link to="/workload">
            <Button variant="ghost" size="sm" className="text-muted-foreground">
              Ver todo
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </Link>
        </div>
        <p className="text-xs text-muted-foreground">
          {format(weekStart, "d MMM", { locale: es })} - {format(weekEnd, "d MMM yyyy", { locale: es })}
        </p>
      </CardHeader>
      <CardContent className="space-y-2">
        {workersWithContracts.length === 0 ? (
          <div className="text-center py-4 text-muted-foreground text-sm">
            No hay trabajadores con contrato
          </div>
        ) : (
          <div className="space-y-1.5">
            {workersWithContracts.map(worker => (
              <div key={worker.cleanerId} className="flex items-center gap-2 text-sm">
                <span className="truncate w-[90px] shrink-0">{worker.cleanerName}</span>
                <Progress 
                  value={Math.min(worker.percentageComplete, 120)} 
                  className="h-1.5 flex-1"
                  indicatorClassName={getProgressBarColor(worker.status)}
                />
                <span className={cn(
                  "text-xs tabular-nums w-[40px] text-right font-medium shrink-0",
                  getStatusColor(worker.status)
                )}>
                  {getDiffText(worker)}h
                </span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default WorkloadWidget;
