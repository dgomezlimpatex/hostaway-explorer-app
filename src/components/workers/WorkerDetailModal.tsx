import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Clock, User, DollarSign } from 'lucide-react';
import { Cleaner } from '@/types/calendar';
import { TaskTimeBreakdown } from './TaskTimeBreakdown';
import { ContractManagement } from './ContractManagement';
import { AbsencesTab } from './absences/AbsencesTab';
import { useCleanerContracts } from '@/hooks/useWorkerContracts';

interface WorkerDetailModalProps {
  worker: Cleaner | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const WorkerDetailModal = ({ worker, open, onOpenChange }: WorkerDetailModalProps) => {
  const { data: contracts = [] } = useCleanerContracts(worker?.id || '');
  
  // Get active contract data
  const activeContract = contracts.find(contract => contract.isActive);
  
  // Use contract data if available, fallback to worker data
  const displayHours = activeContract?.contractHoursPerWeek || worker?.contractHoursPerWeek || 0;
  const displayRate = activeContract?.hourlyRate || worker?.hourlyRate;
  const displayContractType = activeContract?.contractType || worker?.contractType;
  
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
                <div className="text-2xl font-bold">{displayHours}h</div>
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
                  {displayRate ? `€${displayRate}` : 'N/A'}
                </div>
                <div className="text-xs text-muted-foreground">por hora</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Tipo de Contrato</CardTitle>
              </CardHeader>
              <CardContent>
                {getContractTypeBadge(displayContractType)}
                <div className="text-xs text-muted-foreground mt-1">
                  {activeContract?.startDate 
                    ? `Desde ${new Date(activeContract.startDate).toLocaleDateString()}` 
                    : worker.startDate && `Desde ${new Date(worker.startDate).toLocaleDateString()}`
                  }
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Tabs principales */}
          <Tabs defaultValue="tasks" className="w-full">
            <TabsList className="grid w-full grid-cols-3 sticky top-[120px] bg-background z-10">
              <TabsTrigger value="tasks">Tareas</TabsTrigger>
              <TabsTrigger value="absences">Ausencias</TabsTrigger>
              <TabsTrigger value="contracts">Contratos</TabsTrigger>
            </TabsList>

            <div className="mt-4 space-y-6">
              <TabsContent value="tasks" className="mt-0">
                <div className="max-h-[60vh] overflow-y-auto">
                  <TaskTimeBreakdown 
                    workerId={worker.id} 
                    workerName={worker.name}
                  />
                </div>
              </TabsContent>
              
              <TabsContent value="absences" className="mt-0">
                <div className="max-h-[60vh] overflow-y-auto">
                  <AbsencesTab 
                    cleanerId={worker.id} 
                    cleanerName={worker.name}
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