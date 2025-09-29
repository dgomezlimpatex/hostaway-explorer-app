import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { hostawaySync } from '@/services/hostawaySync';
import HostawayScheduleManager from '@/components/hostaway/HostawayScheduleManager';
import { ArrowLeft, Calendar, Settings, Zap } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const HostawayAutomation = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  // Cargar estadísticas de sincronización
  const { data: syncStats, isLoading: loadingStats } = useQuery({
    queryKey: ['hostaway-sync-stats'],
    queryFn: () => hostawaySync.getSyncStats(),
    refetchInterval: 30000 // Refrescar cada 30 segundos
  });

  // Mutation para ejecutar sincronización manual
  const runSyncMutation = useMutation({
    mutationFn: () => hostawaySync.runSync(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hostaway-sync-stats'] });
      toast({
        title: "Sincronización iniciada",
        description: "La sincronización manual se está ejecutando.",
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

  // Mutation para configurar cron jobs automáticos
  const setupCronMutation = useMutation({
    mutationFn: () => hostawaySync.setupCronJobs(),
    onSuccess: (data) => {
      toast({
        title: "Cron jobs configurados",
        description: `Se configuraron ${data?.schedulesProcessed || 0} horarios automáticos.`,
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

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'Nunca';
    return new Date(dateString).toLocaleString('es-ES', {
      timeZone: 'Europe/Madrid'
    });
  };

  const getStatusBadge = (status: string | null) => {
    switch (status) {
      case 'completed':
        return <Badge variant="default">Completada</Badge>;
      case 'running':
        return <Badge variant="secondary">En progreso</Badge>;
      case 'error':
        return <Badge variant="destructive">Error</Badge>;
      default:
        return <Badge variant="outline">Desconocido</Badge>;
    }
  };

  return (
    <div className="container mx-auto p-4 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate('/hostaway-sync-logs')}
          className="gap-2"
        >
          <ArrowLeft className="w-4 h-4" />
          Volver
        </Button>
        <div>
          <h1 className="text-3xl font-bold">Automatización Hostaway</h1>
          <p className="text-muted-foreground">
            Gestiona la sincronización automática con Hostaway
          </p>
        </div>
      </div>

      {/* Estadísticas de última sincronización */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="w-5 h-5" />
            Estado Actual de la Sincronización
          </CardTitle>
          <CardDescription>
            Información sobre la última sincronización ejecutada
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loadingStats ? (
            <div className="animate-pulse space-y-4">
              <div className="h-4 bg-muted rounded w-3/4"></div>
              <div className="h-4 bg-muted rounded w-1/2"></div>
              <div className="h-4 bg-muted rounded w-2/3"></div>
            </div>
          ) : syncStats ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="space-y-2">
                <p className="text-sm font-medium text-muted-foreground">Última Sincronización</p>
                <p className="text-lg">{formatDate(syncStats.lastSync)}</p>
                {getStatusBadge(syncStats.lastSyncStatus)}
              </div>
              
              <div className="space-y-2">
                <p className="text-sm font-medium text-muted-foreground">Reservas Totales</p>
                <p className="text-2xl font-bold text-primary">{syncStats.totalReservations}</p>
              </div>
              
              <div className="space-y-2">
                <p className="text-sm font-medium text-muted-foreground">Tareas Activas</p>
                <p className="text-2xl font-bold text-green-600">{syncStats.activeTasks}</p>
              </div>
              
              <div className="space-y-2">
                <Button
                  onClick={() => runSyncMutation.mutate()}
                  disabled={runSyncMutation.isPending}
                  className="w-full mb-2"
                >
                  {runSyncMutation.isPending ? 'Sincronizando...' : 'Sincronización Manual'}
                </Button>
                <Button
                  onClick={() => setupCronMutation.mutate()}
                  disabled={setupCronMutation.isPending}
                  variant="outline"
                  className="w-full"
                >
                  {setupCronMutation.isPending ? 'Configurando...' : 'Configurar Automático'}
                </Button>
              </div>
            </div>
          ) : (
            <p className="text-muted-foreground">No se pudieron cargar las estadísticas</p>
          )}

          {syncStats?.lastSyncStats && (
            <>
              <Separator className="my-4" />
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-center">
                <div>
                  <p className="text-2xl font-bold text-blue-600">
                    {syncStats.lastSyncStats.reservationsProcessed || 0}
                  </p>
                  <p className="text-xs text-muted-foreground">Procesadas</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-green-600">
                    {syncStats.lastSyncStats.newReservations || 0}
                  </p>
                  <p className="text-xs text-muted-foreground">Nuevas</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-yellow-600">
                    {syncStats.lastSyncStats.updatedReservations || 0}
                  </p>
                  <p className="text-xs text-muted-foreground">Actualizadas</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-red-600">
                    {syncStats.lastSyncStats.cancelledReservations || 0}
                  </p>
                  <p className="text-xs text-muted-foreground">Canceladas</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-purple-600">
                    {syncStats.lastSyncStats.tasksCreated || 0}
                  </p>
                  <p className="text-xs text-muted-foreground">Tareas Creadas</p>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Gestión de horarios */}
      <HostawayScheduleManager />

      {/* Información adicional */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="w-5 h-5" />
            Información del Sistema
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h4 className="font-semibold mb-2">⏰ Horarios Automáticos</h4>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• Los horarios se ejecutan en zona horaria española (Europe/Madrid)</li>
                <li>• Cada sincronización envía un email de resumen</li>
                <li>• Se reintenta automáticamente después de 5 minutos si falla</li>
                <li>• Si el reintento también falla, se envía notificación de error</li>
              </ul>
            </div>
            
            <div>
              <h4 className="font-semibold mb-2">📧 Notificaciones</h4>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• Email de resumen después de cada sincronización</li>
                <li>• Email de error si fallan los reintentos</li>
                <li>• Destinatario: dgomezlimpatex@gmail.com</li>
                <li>• Incluye estadísticas detalladas y errores</li>
              </ul>
            </div>
          </div>
          
          <Separator />
          
          <div className="flex items-center justify-between">
            <div>
              <p className="font-semibold">Sistema de Reintentos</p>
              <p className="text-sm text-muted-foreground">
                Garantiza alta disponibilidad con reintentos automáticos
              </p>
            </div>
            <Badge variant="outline">Activo</Badge>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default HostawayAutomation;