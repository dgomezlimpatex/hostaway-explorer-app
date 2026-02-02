import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Clock, AlertTriangle, TrendingUp, TrendingDown, ChevronRight } from 'lucide-react';
import { useCurrentWeekWorkload } from '@/hooks/useWorkloadCalculation';
import { getProgressBarColor, getStatusColor } from '@/types/workload';
import { Link } from 'react-router-dom';
import { format, startOfWeek, endOfWeek } from 'date-fns';
import { es } from 'date-fns/locale';
import { LoadingSpinner } from '@/components/ui/loading-spinner';

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

  // Filter workers with contracts
  const workersWithContracts = (workloadData || []).filter(w => w.contractHoursPerWeek > 0);
  
  const overtimeWorkers = workersWithContracts.filter(w => w.status === 'overtime');
  const deficitWorkers = workersWithContracts.filter(w => w.status === 'deficit' || w.status === 'critical-deficit');

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Control de Horas - Esta Semana
          </CardTitle>
          <Link to="/workload">
            <Button variant="ghost" size="sm" className="text-muted-foreground">
              Ver Completo
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </Link>
        </div>
        <p className="text-sm text-muted-foreground">
          {format(weekStart, "d MMM", { locale: es })} - {format(weekEnd, "d MMM yyyy", { locale: es })}
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {workersWithContracts.length === 0 ? (
          <div className="text-center py-6 text-muted-foreground">
            <p>No hay trabajadores con contrato configurado</p>
          </div>
        ) : (
          <>
            {/* Worker progress bars */}
            <div className="space-y-3 max-h-[250px] overflow-y-auto">
              {workersWithContracts.slice(0, 5).map(worker => (
                <div key={worker.cleanerId} className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium truncate max-w-[120px]">{worker.cleanerName}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground">
                        {worker.totalWorked.toFixed(1)}/{worker.contractHoursPerWeek}h
                      </span>
                      <span className={`font-medium ${getStatusColor(worker.status)}`}>
                        {worker.overtimeHours > 0 && (
                          <>
                            <TrendingUp className="h-3 w-3 inline mr-1" />
                            +{worker.overtimeHours.toFixed(1)}h
                          </>
                        )}
                        {worker.remainingHours > 0 && worker.status !== 'on-track' && (
                          <>
                            <TrendingDown className="h-3 w-3 inline mr-1" />
                            -{worker.remainingHours.toFixed(1)}h
                          </>
                        )}
                        {worker.status === 'on-track' && worker.remainingHours > 0 && (
                          <span className="text-green-600">-{worker.remainingHours.toFixed(1)}h</span>
                        )}
                      </span>
                    </div>
                  </div>
                  <Progress 
                    value={Math.min(worker.percentageComplete, 120)} 
                    className="h-2"
                    indicatorClassName={getProgressBarColor(worker.status)}
                  />
                </div>
              ))}
              {workersWithContracts.length > 5 && (
                <p className="text-xs text-muted-foreground text-center pt-2">
                  +{workersWithContracts.length - 5} trabajadores más
                </p>
              )}
            </div>

            {/* Alerts summary */}
            {(overtimeWorkers.length > 0 || deficitWorkers.length > 0) && (
              <div className="flex items-center gap-2 pt-2 border-t">
                <AlertTriangle className="h-4 w-4 text-amber-500" />
                <span className="text-sm text-muted-foreground">
                  {overtimeWorkers.length > 0 && (
                    <Badge variant="outline" className="mr-2 bg-amber-50 text-amber-700 border-amber-200">
                      {overtimeWorkers.length} con horas extra
                    </Badge>
                  )}
                  {deficitWorkers.length > 0 && (
                    <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">
                      {deficitWorkers.length} con déficit
                    </Badge>
                  )}
                </span>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
};

export default WorkloadWidget;
