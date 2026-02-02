import React, { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { ChevronDown, ChevronUp, Plus, TrendingUp, TrendingDown, Home, Wrench, Edit } from 'lucide-react';
import { WorkloadSummary, getProgressBarColor, getStatusColor, getStatusBgColor } from '@/types/workload';
import { cn } from '@/lib/utils';

interface WorkloadOverviewCardProps {
  summary: WorkloadSummary;
  onAddAdjustment: (cleanerId: string) => void;
  showDetails?: boolean;
}

export const WorkloadOverviewCard = ({ 
  summary, 
  onAddAdjustment,
  showDetails = false 
}: WorkloadOverviewCardProps) => {
  const [isExpanded, setIsExpanded] = useState(showDetails);

  const getStatusLabel = (status: WorkloadSummary['status']): string => {
    switch (status) {
      case 'on-track': return 'OK';
      case 'overtime': return 'Extra';
      case 'deficit': return 'Bajo';
      case 'critical-deficit': return 'Déficit';
      default: return '';
    }
  };

  const getStatusIcon = () => {
    if (summary.overtimeHours > 0) {
      return <TrendingUp className="h-4 w-4" />;
    }
    if (summary.remainingHours > 0 && summary.status !== 'on-track') {
      return <TrendingDown className="h-4 w-4" />;
    }
    return null;
  };

  const getDifferenceText = () => {
    if (summary.overtimeHours > 0) {
      return `+${summary.overtimeHours.toFixed(1)}h`;
    }
    if (summary.remainingHours > 0) {
      return `-${summary.remainingHours.toFixed(1)}h`;
    }
    return '0h';
  };

  return (
    <Card className="overflow-hidden">
      <CardContent className="p-4">
        {/* Main row */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex-1">
            <h3 className="font-semibold text-lg">{summary.cleanerName}</h3>
            <p className="text-sm text-muted-foreground">
              Contrato: {summary.contractHoursPerWeek}h/semana
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge 
              variant="outline" 
              className={cn(
                "font-medium",
                getStatusBgColor(summary.status),
                getStatusColor(summary.status)
              )}
            >
              {getStatusIcon()}
              <span className="ml-1">{getDifferenceText()}</span>
            </Badge>
          </div>
        </div>

        {/* Progress bar */}
        <div className="space-y-1 mb-3">
          <div className="flex justify-between text-sm">
            <span>{summary.totalWorked.toFixed(1)}h trabajadas</span>
            <span className="text-muted-foreground">{summary.percentageComplete.toFixed(0)}%</span>
          </div>
          <Progress 
            value={Math.min(summary.percentageComplete, 120)} 
            className="h-3"
            indicatorClassName={getProgressBarColor(summary.status)}
          />
        </div>

        {/* Summary row */}
        <div className="flex items-center justify-between text-sm text-muted-foreground mb-2">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1">
              <Home className="h-3 w-3" />
              Turísticas: {summary.touristHours.toFixed(1)}h
              {summary.touristTaskCount > 0 && (
                <span className="text-xs">({summary.touristTaskCount})</span>
              )}
            </span>
            <span className="flex items-center gap-1">
              <Wrench className="h-3 w-3" />
              Mant.: {summary.maintenanceHours.toFixed(1)}h
            </span>
            {summary.adjustmentHours !== 0 && (
              <span className="flex items-center gap-1">
                <Edit className="h-3 w-3" />
                Ajustes: {summary.adjustmentHours > 0 ? '+' : ''}{summary.adjustmentHours.toFixed(1)}h
              </span>
            )}
          </div>
        </div>

        {/* Toggle details button */}
        <div className="flex items-center justify-between pt-2 border-t">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsExpanded(!isExpanded)}
            className="text-muted-foreground"
          >
            {isExpanded ? (
              <>
                <ChevronUp className="h-4 w-4 mr-1" />
                Ocultar detalles
              </>
            ) : (
              <>
                <ChevronDown className="h-4 w-4 mr-1" />
                Ver detalles
              </>
            )}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onAddAdjustment(summary.cleanerId)}
          >
            <Plus className="h-4 w-4 mr-1" />
            Ajustar Horas
          </Button>
        </div>

        {/* Expanded details */}
        {isExpanded && (
          <div className="mt-4 pt-4 border-t space-y-3">
            {/* Breakdown table */}
            <div className="bg-muted/50 rounded-lg p-3 space-y-2">
              <h4 className="font-medium text-sm">Desglose</h4>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>Limpiezas turísticas:</div>
                <div className="text-right">{summary.touristHours.toFixed(1)}h ({summary.touristTaskCount} tareas)</div>
                
                <div>Limpiezas mantenimiento:</div>
                <div className="text-right">{summary.maintenanceHours.toFixed(1)}h (fijo semanal)</div>
                
                {summary.adjustmentHours !== 0 && (
                  <>
                    <div>Ajustes manuales:</div>
                    <div className="text-right">
                      {summary.adjustmentHours > 0 ? '+' : ''}{summary.adjustmentHours.toFixed(1)}h
                    </div>
                  </>
                )}
                
                <div className="font-medium border-t pt-2">TOTAL:</div>
                <div className="text-right font-medium border-t pt-2">{summary.totalWorked.toFixed(1)}h</div>
              </div>
            </div>

            {/* Adjustments list if any */}
            {summary.adjustments.length > 0 && (
              <div className="space-y-2">
                <h4 className="font-medium text-sm">Ajustes aplicados</h4>
                <div className="space-y-1">
                  {summary.adjustments.map(adj => (
                    <div key={adj.id} className="flex items-center justify-between text-sm bg-muted/30 rounded px-2 py-1">
                      <span className="text-muted-foreground">
                        {new Date(adj.date).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}
                      </span>
                      <span>{adj.reason}</span>
                      <span className={adj.hours > 0 ? 'text-green-600' : 'text-red-600'}>
                        {adj.hours > 0 ? '+' : ''}{adj.hours}h
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
