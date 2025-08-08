
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  Plus, 
  TrendingUp, 
  TrendingDown,
  CheckCircle2,
  PlusSquare,
} from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface MonthlyMetrics {
  currentMonth: number;
  lastMonth: number;
  percentageChange: number;
  isPositive: boolean;
}

interface DashboardStatsCardsProps {
  monthlyMetrics: MonthlyMetrics;
  onOpenCreateModal: () => void;
  onOpenBatchModal: () => void;
  todayCount: number;
  unassignedCount: number;
  pendingIncidents: number;
}

export const DashboardStatsCards = ({ 
  monthlyMetrics, 
  onOpenCreateModal, 
  onOpenBatchModal,
  todayCount,
  unassignedCount,
  pendingIncidents
}: DashboardStatsCardsProps) => {
  return (
    <div className="space-y-6 mb-8">
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Limpiezas del mes */}
        <Card className="lg:col-span-2 bg-gradient-to-br from-blue-500 to-blue-600 text-white border-0 shadow-lg">
          <CardHeader className="pb-3">
            <CardTitle className="text-xl font-semibold flex items-center gap-2">
              <CheckCircle2 className="h-6 w-6" />
              Limpiezas completadas en {format(new Date(), 'MMMM', { locale: es })}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-end justify-between">
              <div>
                <div className="text-4xl font-bold mb-2">{monthlyMetrics.currentMonth}</div>
                <div className="flex items-center gap-2 text-blue-100">
                  {monthlyMetrics.isPositive ? (
                    <TrendingUp className="h-4 w-4" />
                  ) : (
                    <TrendingDown className="h-4 w-4" />
                  )}
                  <span className="text-sm">
                    {monthlyMetrics.isPositive ? '+' : ''}{monthlyMetrics.percentageChange}% vs mes pasado
                  </span>
                </div>
              </div>
              <div className="text-right">
                <div className="text-sm text-blue-100 mb-1">Mes anterior</div>
                <div className="text-2xl font-semibold">{monthlyMetrics.lastMonth}</div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Action Buttons */}
        <div className="lg:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Button 
            onClick={onOpenCreateModal}
            className="h-full bg-gradient-to-br from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700 text-white border-0 shadow-lg flex flex-col items-center justify-center py-8"
          >
            <Plus className="h-8 w-8 mb-2" />
            <span className="text-lg font-semibold">Añadir Tarea</span>
          </Button>
          <Button 
            onClick={onOpenBatchModal}
            className="h-full bg-gradient-to-br from-indigo-500 to-indigo-600 hover:from-indigo-600 hover:to-indigo-700 text-white border-0 shadow-lg flex flex-col items-center justify-center py-8"
          >
            <PlusSquare className="h-8 w-8 mb-2" />
            <span className="text-lg font-semibold">Tareas Múltiples</span>
          </Button>
        </div>
      </div>

      {/* KPIs adicionales */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="shadow-md">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-gray-600">Tareas de hoy</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-gray-900">{todayCount}</div>
            <p className="text-xs text-gray-500">Programadas para hoy</p>
          </CardContent>
        </Card>
        <Card className="shadow-md">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-gray-600">Sin asignar</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-amber-600">{unassignedCount}</div>
            <p className="text-xs text-gray-500">Requieren asignación</p>
          </CardContent>
        </Card>
        <Card className="shadow-md">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-gray-600">Incidencias</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-red-600">{pendingIncidents}</div>
            <p className="text-xs text-gray-500">Pendientes de revisión</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
