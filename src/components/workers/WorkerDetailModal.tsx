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
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            {worker.name}
          </DialogTitle>
          <DialogDescription>
            Gestión completa del trabajador - Información, horarios y control de tiempo
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col h-full">
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
          <Tabs defaultValue="overview" className="flex-1">
        <TabsList className="grid w-full grid-cols-6">
          <TabsTrigger value="overview">Resumen</TabsTrigger>
          <TabsTrigger value="alerts">Alertas</TabsTrigger>
          <TabsTrigger value="tasks">Tareas</TabsTrigger>
          <TabsTrigger value="salary">Nómina</TabsTrigger>
          <TabsTrigger value="vacations">Vacaciones</TabsTrigger>
          <TabsTrigger value="contracts">Contratos</TabsTrigger>
        </TabsList>

            <TabsContent value="overview">
              {overview ? (
                <WorkerHoursOverview 
                  overview={overview} 
                  workerName={worker.name}
                  showProjections={true}
                />
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <p>No hay datos de contrato disponibles</p>
                  <p className="text-sm">Configure un contrato para ver el resumen de horas</p>
                </div>
              )}
            </TabsContent>
            
            <TabsContent value="alerts">
              {alerts.length > 0 ? (
                <AlertsPanel className="h-fit" />
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <p>Sin alertas activas</p>
                  <p className="text-sm">Todo funciona correctamente</p>
                </div>
              )}
            </TabsContent>
            
            <TabsContent value="tasks">
              <TaskTimeBreakdown 
                workerId={worker.id} 
                workerName={worker.name}
              />
            </TabsContent>
            
            <TabsContent value="salary">
              <SalaryCalculation cleanerId={worker.id} cleanerName={worker.name} />
            </TabsContent>
            
            <TabsContent value="vacations">
              <div className="text-center py-8 text-muted-foreground">
                <p>Sistema de vacaciones en desarrollo</p>
                <p className="text-sm">Funcionalidad de gestión de vacaciones próximamente</p>
              </div>
            </TabsContent>
            
            <TabsContent value="contracts">
              <div className="text-center py-8 text-muted-foreground">
                Gestión de contratos en desarrollo
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </DialogContent>
    </Dialog>
  );
};