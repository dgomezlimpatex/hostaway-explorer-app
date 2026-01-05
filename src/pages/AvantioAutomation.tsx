import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { avantioSync } from "@/services/avantioSync";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, RefreshCw, Settings, Clock, AlertCircle, CheckCircle2, Info } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

const AvantioAutomation = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  // Obtener estadísticas de sincronización
  const { data: syncStats, isLoading: statsLoading } = useQuery({
    queryKey: ['avantio-sync-stats'],
    queryFn: () => avantioSync.getSyncStats(),
    refetchInterval: 30000,
  });

  // Obtener logs de sincronización
  const { data: syncLogs, isLoading: logsLoading } = useQuery({
    queryKey: ['avantio-sync-logs'],
    queryFn: () => avantioSync.getSyncLogs(5),
  });

  // Obtener horarios
  const { data: schedules, isLoading: schedulesLoading } = useQuery({
    queryKey: ['avantio-schedules'],
    queryFn: () => avantioSync.getSchedules(),
  });

  // Mutación para ejecutar sincronización manual
  const runSyncMutation = useMutation({
    mutationFn: () => avantioSync.runSync(),
    onSuccess: (data) => {
      if (data.success === false && data.requiredSecrets) {
        toast({
          title: "Configuración requerida",
          description: "Debes configurar los secretos de Avantio antes de sincronizar.",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Sincronización completada",
          description: `Procesadas ${data.stats?.reservationsProcessed || 0} reservas`,
        });
        queryClient.invalidateQueries({ queryKey: ['avantio-sync-stats'] });
        queryClient.invalidateQueries({ queryKey: ['avantio-sync-logs'] });
      }
    },
    onError: (error) => {
      toast({
        title: "Error en sincronización",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Mutación para configurar cron jobs
  const setupCronMutation = useMutation({
    mutationFn: () => avantioSync.setupAutomation(),
    onSuccess: (data) => {
      toast({
        title: "Automatización configurada",
        description: `${data.jobsCreated || 0} trabajos programados configurados`,
      });
    },
    onError: (error) => {
      toast({
        title: "Error configurando automatización",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'Nunca';
    return new Date(dateString).toLocaleString('es-ES');
  };

  const getStatusBadge = (status: string | null) => {
    switch (status) {
      case 'completed':
        return <Badge className="bg-green-100 text-green-800"><CheckCircle2 className="w-3 h-3 mr-1" />Completado</Badge>;
      case 'failed':
        return <Badge variant="destructive"><AlertCircle className="w-3 h-3 mr-1" />Error</Badge>;
      case 'running':
        return <Badge className="bg-blue-100 text-blue-800"><RefreshCw className="w-3 h-3 mr-1 animate-spin" />En proceso</Badge>;
      default:
        return <Badge variant="secondary">Sin datos</Badge>;
    }
  };

  return (
    <div className="container mx-auto p-6 max-w-6xl">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold">Automatización Avantio</h1>
          <p className="text-muted-foreground">Sincronización automática de reservas con Avantio</p>
        </div>
      </div>

      {/* Alerta de configuración */}
      <Alert className="mb-6 border-amber-200 bg-amber-50">
        <Info className="h-4 w-4 text-amber-600" />
        <AlertTitle className="text-amber-800">Configuración requerida</AlertTitle>
        <AlertDescription className="text-amber-700">
          Para que la sincronización funcione, debes configurar los siguientes secretos en Supabase:
          <ul className="list-disc list-inside mt-2 space-y-1">
            <li><code className="bg-amber-100 px-1 rounded">AVANTIO_API_URL</code> - URL base de la API de Avantio</li>
            <li><code className="bg-amber-100 px-1 rounded">AVANTIO_API_KEY</code> - API Key de autenticación</li>
            <li><code className="bg-amber-100 px-1 rounded">AVANTIO_CLIENT_ID</code> - (Opcional) Client ID para OAuth</li>
            <li><code className="bg-amber-100 px-1 rounded">AVANTIO_CLIENT_SECRET</code> - (Opcional) Client Secret para OAuth</li>
          </ul>
        </AlertDescription>
      </Alert>

      {/* Estado actual */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Última sincronización</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-lg font-semibold">
              {formatDate(syncStats?.lastSync)}
            </div>
            {syncStats?.lastSyncStatus && getStatusBadge(syncStats.lastSyncStatus)}
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Reservas totales</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{syncStats?.totalReservations || 0}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Tareas activas</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{syncStats?.activeTasks || 0}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Horarios activos</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {schedules?.filter(s => s.is_active).length || 0}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Acciones */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <RefreshCw className="h-5 w-5" />
              Sincronización Manual
            </CardTitle>
            <CardDescription>
              Ejecutar sincronización inmediata con Avantio
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button 
              onClick={() => runSyncMutation.mutate()}
              disabled={runSyncMutation.isPending}
              className="w-full"
            >
              {runSyncMutation.isPending ? (
                <>
                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                  Sincronizando...
                </>
              ) : (
                <>
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Sincronizar ahora
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              Configurar Automatización
            </CardTitle>
            <CardDescription>
              Activar sincronización automática (09:00, 14:00, 19:00)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button 
              onClick={() => setupCronMutation.mutate()}
              disabled={setupCronMutation.isPending}
              variant="outline"
              className="w-full"
            >
              {setupCronMutation.isPending ? (
                <>
                  <Settings className="mr-2 h-4 w-4 animate-spin" />
                  Configurando...
                </>
              ) : (
                <>
                  <Settings className="mr-2 h-4 w-4" />
                  Configurar horarios automáticos
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Horarios programados */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Horarios de Sincronización
          </CardTitle>
          <CardDescription>
            Horarios configurados para sincronización automática
          </CardDescription>
        </CardHeader>
        <CardContent>
          {schedulesLoading ? (
            <div className="text-center py-4">Cargando horarios...</div>
          ) : schedules && schedules.length > 0 ? (
            <div className="space-y-2">
              {schedules.map((schedule) => (
                <div 
                  key={schedule.id}
                  className="flex items-center justify-between p-3 bg-muted rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">{schedule.name}</span>
                    <span className="text-muted-foreground">
                      {schedule.hour.toString().padStart(2, '0')}:{schedule.minute.toString().padStart(2, '0')}
                    </span>
                    <span className="text-xs text-muted-foreground">({schedule.timezone})</span>
                  </div>
                  <Badge variant={schedule.is_active ? "default" : "secondary"}>
                    {schedule.is_active ? "Activo" : "Inactivo"}
                  </Badge>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-4 text-muted-foreground">
              No hay horarios configurados
            </div>
          )}
        </CardContent>
      </Card>

      {/* Últimas sincronizaciones */}
      <Card>
        <CardHeader>
          <CardTitle>Últimas Sincronizaciones</CardTitle>
          <CardDescription>Historial de las últimas sincronizaciones</CardDescription>
        </CardHeader>
        <CardContent>
          {logsLoading ? (
            <div className="text-center py-4">Cargando historial...</div>
          ) : syncLogs && syncLogs.length > 0 ? (
            <div className="space-y-3">
              {syncLogs.map((log) => (
                <div 
                  key={log.id}
                  className="flex items-center justify-between p-3 border rounded-lg"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      {getStatusBadge(log.status)}
                      <span className="text-sm text-muted-foreground">
                        {formatDate(log.sync_started_at)}
                      </span>
                    </div>
                    <div className="text-sm">
                      {log.reservations_processed || 0} reservas procesadas, {log.tasks_created || 0} tareas creadas
                    </div>
                  </div>
                  {log.errors && log.errors.length > 0 && (
                    <Badge variant="destructive">{log.errors.length} errores</Badge>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-4 text-muted-foreground">
              No hay historial de sincronizaciones
            </div>
          )}
        </CardContent>
      </Card>

      {/* Información del sistema */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Información del Sistema</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 bg-muted rounded-lg">
              <h4 className="font-semibold mb-2">📅 Rango de sincronización</h4>
              <p className="text-sm text-muted-foreground">
                Se sincronizan las reservas con checkout en los próximos 30 días
              </p>
            </div>
            <div className="p-4 bg-muted rounded-lg">
              <h4 className="font-semibold mb-2">🧹 Creación de tareas</h4>
              <p className="text-sm text-muted-foreground">
                Se crea una tarea de limpieza para el día del checkout de cada reserva
              </p>
            </div>
            <div className="p-4 bg-muted rounded-lg">
              <h4 className="font-semibold mb-2">👤 Identificador de reserva</h4>
              <p className="text-sm text-muted-foreground">
                Cada reserva se identifica por el nombre del huésped y el apartamento
              </p>
            </div>
            <div className="p-4 bg-muted rounded-lg">
              <h4 className="font-semibold mb-2">🔄 Gestión de cancelaciones</h4>
              <p className="text-sm text-muted-foreground">
                Las reservas canceladas eliminan automáticamente sus tareas asociadas
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default AvantioAutomation;
