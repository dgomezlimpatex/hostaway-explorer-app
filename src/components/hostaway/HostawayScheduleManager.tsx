import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { hostawaySync } from '@/services/hostawaySync';
import { HostawaySchedule, CreateScheduleRequest } from '@/types/hostawaySchedule';
import { Clock, Play, Plus, Settings, Trash2, RefreshCw } from 'lucide-react';

const HostawayScheduleManager = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [newSchedule, setNewSchedule] = useState<CreateScheduleRequest>({
    name: '',
    hour: 9,
    minute: 0,
    timezone: 'Europe/Madrid',
    is_active: true
  });
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);

  // Cargar horarios
  const { data: schedules, isLoading } = useQuery({
    queryKey: ['hostaway-schedules'],
    queryFn: () => hostawaySync.getSchedules()
  });

  // Mutation para crear horario
  const createScheduleMutation = useMutation({
    mutationFn: (data: CreateScheduleRequest) => hostawaySync.createSchedule(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hostaway-schedules'] });
      setIsCreateDialogOpen(false);
      setNewSchedule({
        name: '',
        hour: 9,
        minute: 0,
        timezone: 'Europe/Madrid',
        is_active: true
      });
      toast({
        title: "Horario creado",
        description: "El nuevo horario de sincronización ha sido creado exitosamente.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "No se pudo crear el horario",
        variant: "destructive",
      });
    }
  });

  // Mutation para actualizar horario
  const updateScheduleMutation = useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Partial<HostawaySchedule> }) =>
      hostawaySync.updateSchedule(id, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hostaway-schedules'] });
      toast({
        title: "Horario actualizado",
        description: "Los cambios han sido guardados exitosamente.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "No se pudo actualizar el horario",
        variant: "destructive",
      });
    }
  });

  // Mutation para eliminar horario
  const deleteScheduleMutation = useMutation({
    mutationFn: (id: string) => hostawaySync.deleteSchedule(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hostaway-schedules'] });
      toast({
        title: "Horario eliminado",
        description: "El horario ha sido eliminado exitosamente.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "No se pudo eliminar el horario",
        variant: "destructive",
      });
    }
  });

  // Mutation para ejecutar sincronización
  const runSyncMutation = useMutation({
    mutationFn: (scheduleId: string) => hostawaySync.runScheduledSync(scheduleId),
    onSuccess: () => {
      toast({
        title: "Sincronización iniciada",
        description: "La sincronización se está ejecutando en segundo plano.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "No se pudo ejecutar la sincronización",
        variant: "destructive",
      });
    }
  });

  // Mutation para configurar cron jobs
  const setupCronMutation = useMutation({
    mutationFn: () => hostawaySync.setupCronJobs(),
    onSuccess: () => {
      toast({
        title: "Cron Jobs configurados",
        description: "Los trabajos automáticos han sido reconfigurados exitosamente.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "No se pudieron configurar los cron jobs",
        variant: "destructive",
      });
    }
  });

  const formatTime = (hour: number, minute: number) => {
    return `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
  };

  const handleToggleActive = (schedule: HostawaySchedule) => {
    updateScheduleMutation.mutate({
      id: schedule.id,
      updates: { is_active: !schedule.is_active }
    });
  };

  const handleTimeChange = (schedule: HostawaySchedule, hour: number, minute: number) => {
    updateScheduleMutation.mutate({
      id: schedule.id,
      updates: { hour, minute }
    });
  };

  const handleCreateSchedule = () => {
    if (!newSchedule.name.trim()) {
      toast({
        title: "Error",
        description: "El nombre del horario es requerido",
        variant: "destructive",
      });
      return;
    }

    createScheduleMutation.mutate(newSchedule);
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="w-5 h-5" />
            Gestión de Horarios de Sincronización
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <RefreshCw className="w-6 h-6 animate-spin" />
            <span className="ml-2">Cargando horarios...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="w-5 h-5" />
          Gestión de Horarios de Sincronización
        </CardTitle>
        <CardDescription>
          Configura los horarios automáticos para la sincronización con Hostaway
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Botones de acción */}
        <div className="flex flex-wrap gap-2">
          <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm">
                <Plus className="w-4 h-4 mr-2" />
                Nuevo Horario
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Crear Nuevo Horario</DialogTitle>
                <DialogDescription>
                  Define un nuevo horario para la sincronización automática
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="name">Nombre del Horario</Label>
                  <Input
                    id="name"
                    value={newSchedule.name}
                    onChange={(e) => setNewSchedule(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="Ej: Sincronización Mañana"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="hour">Hora</Label>
                    <Input
                      id="hour"
                      type="number"
                      min="0"
                      max="23"
                      value={newSchedule.hour}
                      onChange={(e) => setNewSchedule(prev => ({ ...prev, hour: parseInt(e.target.value) }))}
                    />
                  </div>
                  <div>
                    <Label htmlFor="minute">Minuto</Label>
                    <Input
                      id="minute"
                      type="number"
                      min="0"
                      max="59"
                      value={newSchedule.minute}
                      onChange={(e) => setNewSchedule(prev => ({ ...prev, minute: parseInt(e.target.value) }))}
                    />
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <Switch
                    id="active"
                    checked={newSchedule.is_active}
                    onCheckedChange={(checked) => setNewSchedule(prev => ({ ...prev, is_active: checked }))}
                  />
                  <Label htmlFor="active">Activar inmediatamente</Label>
                </div>
              </div>
              <DialogFooter>
                <Button
                  onClick={handleCreateSchedule}
                  disabled={createScheduleMutation.isPending}
                >
                  {createScheduleMutation.isPending && <RefreshCw className="w-4 h-4 mr-2 animate-spin" />}
                  Crear Horario
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setupCronMutation.mutate()}
            disabled={setupCronMutation.isPending}
          >
            <Settings className="w-4 h-4 mr-2" />
            {setupCronMutation.isPending && <RefreshCw className="w-4 h-4 mr-2 animate-spin" />}
            Reconfigurar Cron Jobs
          </Button>
        </div>

        <Separator />

        {/* Lista de horarios */}
        <div className="space-y-4">
          {schedules && schedules.length > 0 ? (
            schedules.map((schedule) => (
              <Card key={schedule.id} className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div>
                      <h3 className="font-semibold">{schedule.name}</h3>
                      <p className="text-sm text-muted-foreground">
                        {formatTime(schedule.hour, schedule.minute)} ({schedule.timezone})
                      </p>
                    </div>
                    <Badge variant={schedule.is_active ? "default" : "secondary"}>
                      {schedule.is_active ? "Activo" : "Inactivo"}
                    </Badge>
                  </div>

                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        min="0"
                        max="23"
                        value={schedule.hour}
                        onChange={(e) => handleTimeChange(schedule, parseInt(e.target.value), schedule.minute)}
                        className="w-16"
                        disabled={updateScheduleMutation.isPending}
                      />
                      <span>:</span>
                      <Input
                        type="number"
                        min="0"
                        max="59"
                        value={schedule.minute}
                        onChange={(e) => handleTimeChange(schedule, schedule.hour, parseInt(e.target.value))}
                        className="w-16"
                        disabled={updateScheduleMutation.isPending}
                      />
                    </div>

                    <Switch
                      checked={schedule.is_active}
                      onCheckedChange={() => handleToggleActive(schedule)}
                      disabled={updateScheduleMutation.isPending}
                    />

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => runSyncMutation.mutate(schedule.id)}
                      disabled={runSyncMutation.isPending}
                    >
                      <Play className="w-4 h-4" />
                    </Button>

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => deleteScheduleMutation.mutate(schedule.id)}
                      disabled={deleteScheduleMutation.isPending}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </Card>
            ))
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <Clock className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>No hay horarios configurados</p>
              <p className="text-sm">Crea tu primer horario de sincronización automática</p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default HostawayScheduleManager;