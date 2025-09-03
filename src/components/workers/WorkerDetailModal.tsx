import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar, Clock, FileText, User, DollarSign, Phone, BarChart3 } from 'lucide-react';
import { Cleaner } from '@/types/calendar';
import { WorkerTimeTracking } from './WorkerTimeTracking';
import { WorkerScheduleCalendar } from './WorkerScheduleCalendar'; 
import { WorkerBasicInfo } from './WorkerBasicInfo';
import { WorkerHoursOverview } from './WorkerHoursOverview';
import { AlertsPanel } from './AlertsPanel';
import { TaskTimeBreakdown } from './TaskTimeBreakdown';
import { SalaryCalculation } from './SalaryCalculation';
import { VacationRequestsList } from './VacationRequestsList';
import { ContractManagement } from './ContractManagement';
import { useWorkerHoursOverview } from '@/hooks/useWorkerAlerts';

interface WorkerDetailModalProps {
  worker: Cleaner | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const WorkerDetailModal = ({ worker, open, onOpenChange }: WorkerDetailModalProps) => {
  const { overview, alerts } = useWorkerHoursOverview(worker?.id || '');
  
  if (!worker) return null;

  const getContractTypeBadge = (type?: string) => {
    const variants = {
      'full-time': 'default',
      'part-time': 'secondary', 
      'temporary': 'outline',
      'freelance': 'destructive'
    } as const;
    
    return (
      <Badge variant={variants[type as keyof typeof variants] || 'default'}>
        {type === 'full-time' ? 'Tiempo Completo' :
         type === 'part-time' ? 'Tiempo Parcial' :
         type === 'temporary' ? 'Temporal' :
         type === 'freelance' ? 'Autónomo' : type}
      </Badge>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[95vh] overflow-y-auto">
        <DialogHeader className="sticky top-0 bg-background z-10 pb-4">
          <DialogTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            {worker.name}
          </DialogTitle>
          <DialogDescription>
            Gestión completa del trabajador - Información, horarios y control de tiempo
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Información básica resumida */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  Horas Contrato
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{worker.contractHoursPerWeek || 0}h</div>
                <div className="text-xs text-muted-foreground">por semana</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <DollarSign className="h-4 w-4" />
                  Tarifa
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {worker.hourlyRate ? `€${worker.hourlyRate}` : 'N/A'}
                </div>
                <div className="text-xs text-muted-foreground">por hora</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Tipo de Contrato</CardTitle>
              </CardHeader>
              <CardContent>
                {getContractTypeBadge(worker.contractType)}
                <div className="text-xs text-muted-foreground mt-1">
                  {worker.startDate && `Desde ${new Date(worker.startDate).toLocaleDateString()}`}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Tabs principales */}
          <Tabs defaultValue="overview" className="w-full">
            <TabsList className="grid w-full grid-cols-6 sticky top-[120px] bg-background z-10">
              <TabsTrigger value="overview">Resumen</TabsTrigger>
              <TabsTrigger value="alerts">Alertas</TabsTrigger>
              <TabsTrigger value="tasks">Tareas</TabsTrigger>
              <TabsTrigger value="salary">Nómina</TabsTrigger>
              <TabsTrigger value="vacations">Vacaciones</TabsTrigger>
              <TabsTrigger value="contracts">Contratos</TabsTrigger>
            </TabsList>

            <div className="mt-4 space-y-6">
              <TabsContent value="overview" className="mt-0">
                {overview ? (
                  <div className="max-h-[60vh] overflow-y-auto">
                    <WorkerHoursOverview 
                      overview={overview} 
                      workerName={worker.name}
                      showProjections={true}
                    />
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <p>No hay datos de contrato disponibles</p>
                    <p className="text-sm">Configure un contrato para ver el resumen de horas</p>
                  </div>
                )}
              </TabsContent>
              
              <TabsContent value="alerts" className="mt-0">
                <div className="max-h-[60vh] overflow-y-auto">
                  {alerts.length > 0 ? (
                    <AlertsPanel className="h-fit" />
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      <p>Sin alertas activas</p>
                      <p className="text-sm">Todo funciona correctamente</p>
                    </div>
                  )}
                </div>
              </TabsContent>
              
              <TabsContent value="tasks" className="mt-0">
                <div className="max-h-[60vh] overflow-y-auto">
                  <TaskTimeBreakdown 
                    workerId={worker.id} 
                    workerName={worker.name}
                  />
                </div>
              </TabsContent>
              
              <TabsContent value="salary" className="mt-0">
                <div className="max-h-[60vh] overflow-y-auto">
                  <SalaryCalculation cleanerId={worker.id} cleanerName={worker.name} />
                </div>
              </TabsContent>
              
              <TabsContent value="vacations" className="mt-0">
                <div className="max-h-[60vh] overflow-y-auto">
                  <VacationRequestsList 
                    cleanerId={worker.id} 
                    cleanerName={worker.name}
                    isManager={true}
                  />
                </div>
              </TabsContent>
              
              <TabsContent value="contracts" className="mt-0">
                <div className="max-h-[60vh] overflow-y-auto">
                  <ContractManagement 
                    cleanerId={worker.id} 
                    cleanerName={worker.name}
                    isManager={true}
                  />
                </div>
              </TabsContent>
            </div>
          </Tabs>
        </div>
      </DialogContent>
    </Dialog>
  );
};