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
import { Calendar, Clock, FileText, User, DollarSign, Phone } from 'lucide-react';
import { Cleaner } from '@/types/calendar';
import { WorkerTimeTracking } from './WorkerTimeTracking';
import { WorkerScheduleCalendar } from './WorkerScheduleCalendar'; 
import { WorkerBasicInfo } from './WorkerBasicInfo';

interface WorkerDetailModalProps {
  worker: Cleaner | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const WorkerDetailModal = ({ worker, open, onOpenChange }: WorkerDetailModalProps) => {
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
          <Tabs defaultValue="info" className="flex-1">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="info" className="flex items-center gap-2">
                <User className="h-4 w-4" />
                Información
              </TabsTrigger>
              <TabsTrigger value="schedule" className="flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                Horarios
              </TabsTrigger>
              <TabsTrigger value="time" className="flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Control Tiempo
              </TabsTrigger>
              <TabsTrigger value="reports" className="flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Reportes
              </TabsTrigger>
            </TabsList>

            <div className="mt-4 flex-1 overflow-auto">
              <TabsContent value="info" className="space-y-4">
                <WorkerBasicInfo worker={worker} />
              </TabsContent>

              <TabsContent value="schedule" className="space-y-4">
                <WorkerScheduleCalendar workerId={worker.id} />
              </TabsContent>

              <TabsContent value="time" className="space-y-4">
                <WorkerTimeTracking workerId={worker.id} />
              </TabsContent>

              <TabsContent value="reports" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Reportes y Estadísticas</CardTitle>
                    <CardDescription>
                      Análisis de rendimiento y estadísticas del trabajador
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="text-center py-8 text-muted-foreground">
                      <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p>Funcionalidad de reportes en desarrollo</p>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            </div>
          </Tabs>
        </div>
      </DialogContent>
    </Dialog>
  );
};