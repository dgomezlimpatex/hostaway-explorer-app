import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Clock, TrendingUp, AlertTriangle, Calendar, BarChart3 } from "lucide-react";
import { WorkerHoursOverview as WorkerHoursOverviewType } from '@/types/calendar';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { useCleanerContracts } from '@/hooks/useWorkerContracts';
import { useTaskTimeSync } from '@/hooks/useTaskTimeSync';
import { format, subMonths, startOfMonth, endOfMonth } from 'date-fns';
import { es } from 'date-fns/locale';

interface WorkerHoursOverviewProps {
  overview: WorkerHoursOverviewType;
  workerName: string;
  workerId: string;
  showProjections?: boolean;
}

export const WorkerHoursOverview = ({ 
  overview, 
  workerName, 
  workerId,
  showProjections = true 
}: WorkerHoursOverviewProps) => {
  const { data: contracts = [] } = useCleanerContracts(workerId);
  const activeContract = contracts.find(contract => contract.isActive);
  
  const progressPercentage = (overview.workedHours / overview.contractHours) * 100;
  const isOvertime = overview.overtimeHours > 0;
  const isUnderHours = overview.workedHours < overview.contractHours * 0.9;

  // Generate data for the last 6 months
  const monthlyData = useMemo(() => {
    const months = [];
    const currentDate = new Date();
    
    for (let i = 5; i >= 0; i--) {
      const monthDate = subMonths(currentDate, i);
      const monthStart = startOfMonth(monthDate);
      const monthEnd = endOfMonth(monthDate);
      
      // For now, we'll use simulated data, but this could be replaced with real data fetching
      const contractHours = (activeContract?.contractHoursPerWeek || 40) * 4; // Approximate monthly hours
      const workedHours = Math.random() * contractHours * 1.2; // Simulate worked hours with some variance
      const overtimeHours = Math.max(0, workedHours - contractHours);
      
      months.push({
        month: format(monthDate, 'MMM', { locale: es }),
        monthFull: format(monthDate, 'MMMM yyyy', { locale: es }),
        contractHours: contractHours,
        workedHours: workedHours,
        overtimeHours: overtimeHours,
        remainingHours: Math.max(0, contractHours - workedHours)
      });
    }
    
    return months;
  }, [activeContract]);

  const getEfficiencyColor = (efficiency: number) => {
    if (efficiency >= 90 && efficiency <= 110) return 'text-green-600';
    if (efficiency >= 80 && efficiency < 90) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getProgressColor = () => {
    if (isOvertime) return 'bg-red-500';
    if (isUnderHours) return 'bg-yellow-500';
    return 'bg-green-500';
  };

  return (
    <div className="space-y-6">
      <Card className="w-full">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg font-semibold">{workerName}</CardTitle>
            <div className="flex gap-2">
              {isOvertime && (
                <Badge variant="destructive" className="text-xs">
                  <AlertTriangle className="w-3 h-3 mr-1" />
                  Horas Extra
                </Badge>
              )}
              {isUnderHours && (
                <Badge variant="outline" className="text-xs border-yellow-500 text-yellow-700">
                  <Clock className="w-3 h-3 mr-1" />
                  Bajo Contrato
                </Badge>
              )}
            </div>
          </div>
        </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Progress Bar */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span>Horas Trabajadas</span>
            <span className="font-medium">
              {overview.workedHours.toFixed(1)}h / {overview.contractHours}h
            </span>
          </div>
          <Progress 
            value={Math.min(progressPercentage, 100)} 
            className="h-2"
          />
          {isOvertime && (
            <div className="text-xs text-red-600 font-medium">
              +{overview.overtimeHours.toFixed(1)}h horas extra
            </div>
          )}
        </div>

        {/* Metrics Grid */}
        <div className="grid grid-cols-2 gap-4">
          <div className="text-center p-3 bg-gray-50 rounded-lg">
            <div className="text-2xl font-bold text-primary">
              {overview.remainingHours.toFixed(1)}h
            </div>
            <div className="text-xs text-muted-foreground">Horas Restantes</div>
          </div>
          
          <div className="text-center p-3 bg-gray-50 rounded-lg">
            <div className={`text-2xl font-bold ${getEfficiencyColor(overview.efficiencyRate)}`}>
              {overview.efficiencyRate.toFixed(0)}%
            </div>
            <div className="text-xs text-muted-foreground">Eficiencia</div>
          </div>
        </div>

        {/* Projections */}
        {showProjections && (
          <div className="space-y-3 pt-2 border-t">
            <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <TrendingUp className="w-4 h-4" />
              Proyecciones
            </div>
            
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div className="flex justify-between">
                <span>Semanal:</span>
                <span className={overview.weeklyProjection > overview.contractHours ? 'text-red-600 font-medium' : 'text-muted-foreground'}>
                  {overview.weeklyProjection.toFixed(1)}h
                </span>
              </div>
              
              <div className="flex justify-between">
                <span>Mensual:</span>
                <span className="text-muted-foreground">
                  {overview.monthlyProjection.toFixed(0)}h
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Status Summary */}
        <div className="pt-2 border-t">
          <div className="flex items-center gap-2 text-sm">
            <Calendar className="w-4 h-4 text-muted-foreground" />
            <span className="text-muted-foreground">Estado:</span>
            <span className={`font-medium ${
              isOvertime ? 'text-red-600' : 
              isUnderHours ? 'text-yellow-600' : 
              'text-green-600'
            }`}>
              {isOvertime 
                ? 'Exceso de horas' 
                : isUnderHours 
                ? 'Por debajo del contrato' 
                : 'Dentro del rango'}
            </span>
          </div>
        </div>
        </CardContent>
      </Card>

      {/* Monthly Hours Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Análisis de Horas Mensuales
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={monthlyData}
                margin={{
                  top: 20,
                  right: 30,
                  left: 20,
                  bottom: 5,
                }}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip 
                  formatter={(value: number, name: string) => [
                    `${value.toFixed(1)}h`, 
                    name === 'contractHours' ? 'Horas Contrato' :
                    name === 'workedHours' ? 'Horas Trabajadas' :
                    name === 'overtimeHours' ? 'Horas Extra' :
                    'Horas Restantes'
                  ]}
                  labelFormatter={(label) => {
                    const monthData = monthlyData.find(m => m.month === label);
                    return monthData?.monthFull || label;
                  }}
                />
                <Legend 
                  formatter={(value) => 
                    value === 'contractHours' ? 'Horas Contrato' :
                    value === 'workedHours' ? 'Horas Trabajadas' :
                    value === 'overtimeHours' ? 'Horas Extra' :
                    'Horas Restantes'
                  }
                />
                <Bar dataKey="contractHours" stackId="a" fill="#e5e7eb" name="contractHours" />
                <Bar dataKey="workedHours" stackId="b" fill="#3b82f6" name="workedHours" />
                <Bar dataKey="overtimeHours" stackId="b" fill="#ef4444" name="overtimeHours" />
              </BarChart>
            </ResponsiveContainer>
          </div>
          
          {/* Chart Legend Info */}
          <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-gray-300 rounded"></div>
              <span>Horas Contrato</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-blue-500 rounded"></div>
              <span>Horas Trabajadas</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-red-500 rounded"></div>
              <span>Horas Extra</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-green-500 rounded"></div>
              <span>Disponibles</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};