import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { avantioSync } from "@/services/avantioSync";
import { AvantioSyncLog, AvantioSyncError } from "@/types/avantio";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, RefreshCw, Settings, Clock, AlertCircle, CheckCircle2, Info, ChevronDown, ChevronUp, AlertTriangle, Check } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

const AvantioAutomation = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);
  const [showAllErrors, setShowAllErrors] = useState(false);

  const { data: syncStats } = useQuery({
    queryKey: ['avantio-sync-stats'],
    queryFn: () => avantioSync.getSyncStats(),
    refetchInterval: 30000,
  });

  const { data: syncLogs } = useQuery({
    queryKey: ['avantio-sync-logs'],
    queryFn: () => avantioSync.getSyncLogs(10),
  });

  const { data: schedules } = useQuery({
    queryKey: ['avantio-schedules'],
    queryFn: () => avantioSync.getSchedules(),
  });

  const { data: syncErrors } = useQuery({
    queryKey: ['avantio-sync-errors', showAllErrors],
    queryFn: () => avantioSync.getSyncErrors(!showAllErrors),
  });

  const runSyncMutation = useMutation({
    mutationFn: () => avantioSync.runSync(),
    onSuccess: (data) => {
      if (data.success === false && data.requiredSecrets) {
        toast({ title: "Configuración requerida", description: "Debes configurar AVANTIO_API_TOKEN.", variant: "destructive" });
      } else {
        toast({ title: "Sincronización completada", description: `Procesadas ${data.stats?.reservationsProcessed || 0} reservas` });
        queryClient.invalidateQueries({ queryKey: ['avantio-sync-stats'] });
        queryClient.invalidateQueries({ queryKey: ['avantio-sync-logs'] });
        queryClient.invalidateQueries({ queryKey: ['avantio-sync-errors'] });
      }
    },
    onError: (error) => {
      toast({ title: "Error en sincronización", description: error.message, variant: "destructive" });
    },
  });

  const setupCronMutation = useMutation({
    mutationFn: () => avantioSync.setupAutomation(),
    onSuccess: (data) => {
      toast({ title: "Automatización configurada", description: `${data.jobsCreated || 0} trabajos programados` });
    },
    onError: (error) => {
      toast({ title: "Error configurando automatización", description: error.message, variant: "destructive" });
    },
  });

  const resolveErrorMutation = useMutation({
    mutationFn: (errorId: string) => avantioSync.resolveError(errorId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['avantio-sync-errors'] });
      queryClient.invalidateQueries({ queryKey: ['avantio-sync-stats'] });
      toast({ title: "Error marcado como resuelto" });
    },
  });

  const resolveAllMutation = useMutation({
    mutationFn: () => avantioSync.resolveAllErrors(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['avantio-sync-errors'] });
      queryClient.invalidateQueries({ queryKey: ['avantio-sync-stats'] });
      toast({ title: "Todos los errores marcados como resueltos" });
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

  const getErrorTypeBadge = (type: string) => {
    const colors: Record<string, string> = {
      property_not_found: 'bg-orange-100 text-orange-800',
      task_creation_failed: 'bg-red-100 text-red-800',
      task_update_failed: 'bg-yellow-100 text-yellow-800',
      task_deletion_failed: 'bg-pink-100 text-pink-800',
      reservation_save_failed: 'bg-purple-100 text-purple-800',
      api_error: 'bg-red-100 text-red-800',
    };
    const labels: Record<string, string> = {
      property_not_found: 'Propiedad no encontrada',
      task_creation_failed: 'Error creando tarea',
      task_update_failed: 'Error actualizando tarea',
      task_deletion_failed: 'Error eliminando tarea',
      reservation_save_failed: 'Error guardando reserva',
      api_error: 'Error de API',
    };
    return <Badge className={colors[type] || 'bg-gray-100 text-gray-800'}>{labels[type] || type}</Badge>;
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
          <p className="text-muted-foreground">Sincronización automática de reservas con Avantio PMS v1</p>
        </div>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Última sincronización</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-sm font-semibold">{formatDate(syncStats?.lastSync)}</div>
            {syncStats?.lastSyncStatus && getStatusBadge(syncStats.lastSyncStatus)}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardDescription>Reservas totales</CardDescription></CardHeader>
          <CardContent><div className="text-2xl font-bold">{syncStats?.totalReservations || 0}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardDescription>Tareas activas</CardDescription></CardHeader>
          <CardContent><div className="text-2xl font-bold">{syncStats?.activeTasks || 0}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardDescription>Horarios activos</CardDescription></CardHeader>
          <CardContent><div className="text-2xl font-bold">{schedules?.filter(s => s.is_active).length || 0}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardDescription>Errores sin resolver</CardDescription></CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${(syncStats?.unresolvedErrors || 0) > 0 ? 'text-destructive' : ''}`}>
              {syncStats?.unresolvedErrors || 0}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><RefreshCw className="h-5 w-5" />Sincronización Manual</CardTitle>
            <CardDescription>Ejecutar sincronización inmediata con Avantio</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => runSyncMutation.mutate()} disabled={runSyncMutation.isPending} className="w-full">
              {runSyncMutation.isPending ? <><RefreshCw className="mr-2 h-4 w-4 animate-spin" />Sincronizando...</> : <><RefreshCw className="mr-2 h-4 w-4" />Sincronizar ahora</>}
            </Button>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Settings className="h-5 w-5" />Configurar Automatización</CardTitle>
            <CardDescription>Activar sincronización automática</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => setupCronMutation.mutate()} disabled={setupCronMutation.isPending} variant="outline" className="w-full">
              {setupCronMutation.isPending ? <><Settings className="mr-2 h-4 w-4 animate-spin" />Configurando...</> : <><Settings className="mr-2 h-4 w-4" />Configurar horarios automáticos</>}
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Sync Errors Panel */}
      <Card className="mb-6">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-destructive" />
                Errores de Sincronización
                {(syncStats?.unresolvedErrors || 0) > 0 && (
                  <Badge variant="destructive">{syncStats?.unresolvedErrors}</Badge>
                )}
              </CardTitle>
              <CardDescription>Errores detectados durante las sincronizaciones</CardDescription>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setShowAllErrors(!showAllErrors)}>
                {showAllErrors ? 'Solo sin resolver' : 'Ver todos'}
              </Button>
              {(syncStats?.unresolvedErrors || 0) > 0 && (
                <Button variant="outline" size="sm" onClick={() => resolveAllMutation.mutate()} disabled={resolveAllMutation.isPending}>
                  <Check className="mr-1 h-3 w-3" />Resolver todos
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {syncErrors && syncErrors.length > 0 ? (
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {syncErrors.map((err: AvantioSyncError) => (
                <div key={err.id} className="flex items-start justify-between p-3 border rounded-lg gap-3">
                  <div className="space-y-1 flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      {getErrorTypeBadge(err.error_type)}
                      <span className="text-xs text-muted-foreground">{formatDate(err.created_at)}</span>
                      {err.resolved && <Badge variant="outline" className="text-green-700">Resuelto</Badge>}
                    </div>
                    <p className="text-sm truncate">{err.error_message}</p>
                    {err.error_details && (
                      <div className="text-xs text-muted-foreground space-y-0.5">
                        {(err.error_details as any).property_name && <span>Propiedad: {(err.error_details as any).property_name}</span>}
                        {(err.error_details as any).accommodation_name && <span> | Avantio: {(err.error_details as any).accommodation_name}</span>}
                        {(err.error_details as any).guest_name && <span> | Huésped: {(err.error_details as any).guest_name}</span>}
                      </div>
                    )}
                  </div>
                  {!err.resolved && (
                    <Button variant="ghost" size="sm" onClick={() => resolveErrorMutation.mutate(err.id)} disabled={resolveErrorMutation.isPending}>
                      <Check className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-4 text-muted-foreground">
              {showAllErrors ? 'No hay errores registrados' : 'No hay errores sin resolver 🎉'}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Schedules */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Clock className="h-5 w-5" />Horarios de Sincronización</CardTitle>
        </CardHeader>
        <CardContent>
          {schedules && schedules.length > 0 ? (
            <div className="space-y-2">
              {schedules.map((schedule) => (
                <div key={schedule.id} className="flex items-center justify-between p-3 bg-muted rounded-lg">
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
            <div className="text-center py-4 text-muted-foreground">No hay horarios configurados</div>
          )}
        </CardContent>
      </Card>

      {/* Sync Logs with expandable details */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Últimas Sincronizaciones</CardTitle>
          <CardDescription>Historial con detalles expandibles</CardDescription>
        </CardHeader>
        <CardContent>
          {syncLogs && syncLogs.length > 0 ? (
            <div className="space-y-2">
              {syncLogs.map((log: AvantioSyncLog) => (
                <Collapsible key={log.id} open={expandedLogId === log.id} onOpenChange={() => setExpandedLogId(expandedLogId === log.id ? null : log.id)}>
                  <CollapsibleTrigger asChild>
                    <div className="flex items-center justify-between p-3 border rounded-lg cursor-pointer hover:bg-muted/50 transition-colors">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          {getStatusBadge(log.status)}
                          <span className="text-sm text-muted-foreground">{formatDate(log.sync_started_at)}</span>
                        </div>
                        <div className="text-sm flex gap-3 flex-wrap">
                          <span>{log.reservations_processed || 0} procesadas</span>
                          {(log.tasks_created || 0) > 0 && <span className="text-green-700">+{log.tasks_created} tareas</span>}
                          {(log.tasks_modified || 0) > 0 && <span className="text-blue-700">~{log.tasks_modified} modificadas</span>}
                          {(log.tasks_cancelled || 0) > 0 && <span className="text-red-700">-{log.tasks_cancelled} canceladas</span>}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {log.errors && log.errors.length > 0 && <Badge variant="destructive">{log.errors.length} errores</Badge>}
                        {expandedLogId === log.id ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                      </div>
                    </div>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <div className="p-3 border border-t-0 rounded-b-lg space-y-3 bg-muted/20">
                      {/* Tasks created */}
                      {log.tasks_details && log.tasks_details.length > 0 && (
                        <div>
                          <h4 className="text-sm font-semibold text-green-700 mb-1">✅ Tareas creadas ({log.tasks_details.length})</h4>
                          <div className="space-y-1">
                            {log.tasks_details.map((t, i) => (
                              <div key={i} className="text-xs p-2 bg-green-50 rounded flex justify-between">
                                <span>{t.property_name} - {t.guest_name}</span>
                                <span className="text-muted-foreground">{t.task_date}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      {/* Tasks modified */}
                      {log.tasks_modified_details && log.tasks_modified_details.length > 0 && (
                        <div>
                          <h4 className="text-sm font-semibold text-blue-700 mb-1">📅 Tareas modificadas ({log.tasks_modified_details.length})</h4>
                          <div className="space-y-1">
                            {log.tasks_modified_details.map((t, i) => (
                              <div key={i} className="text-xs p-2 bg-blue-50 rounded flex justify-between">
                                <span>{t.property_name} - {t.guest_name}</span>
                                <span className="text-muted-foreground">→ {t.task_date}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      {/* Tasks cancelled */}
                      {log.tasks_cancelled_details && log.tasks_cancelled_details.length > 0 && (
                        <div>
                          <h4 className="text-sm font-semibold text-red-700 mb-1">🚫 Tareas canceladas ({log.tasks_cancelled_details.length})</h4>
                          <div className="space-y-1">
                            {log.tasks_cancelled_details.map((t, i) => (
                              <div key={i} className="text-xs p-2 bg-red-50 rounded flex justify-between">
                                <span>{t.property_name} - {t.guest_name}</span>
                                <span className="text-muted-foreground">{t.task_date}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      {/* Errors */}
                      {log.errors && log.errors.length > 0 && (
                        <div>
                          <h4 className="text-sm font-semibold text-red-700 mb-1">❌ Errores ({log.errors.length})</h4>
                          <div className="space-y-1">
                            {log.errors.map((err, i) => (
                              <div key={i} className="text-xs p-2 bg-red-50 rounded text-red-800">{err}</div>
                            ))}
                          </div>
                        </div>
                      )}
                      {/* No details */}
                      {!log.tasks_details?.length && !log.tasks_modified_details?.length && !log.tasks_cancelled_details?.length && !log.errors?.length && (
                        <div className="text-sm text-muted-foreground text-center py-2">Sin cambios en esta sincronización</div>
                      )}
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              ))}
            </div>
          ) : (
            <div className="text-center py-4 text-muted-foreground">No hay historial de sincronizaciones</div>
          )}
        </CardContent>
      </Card>

      {/* System Info */}
      <Card>
        <CardHeader><CardTitle>Información del Sistema</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 bg-muted rounded-lg">
              <h4 className="font-semibold mb-2">📅 Rango de sincronización</h4>
              <p className="text-sm text-muted-foreground">Checkout entre 10 días atrás y 30 días adelante</p>
            </div>
            <div className="p-4 bg-muted rounded-lg">
              <h4 className="font-semibold mb-2">🧹 Creación de tareas</h4>
              <p className="text-sm text-muted-foreground">Se crea una tarea de limpieza para el día del checkout de cada reserva confirmada</p>
            </div>
            <div className="p-4 bg-muted rounded-lg">
              <h4 className="font-semibold mb-2">🔄 Gestión de cambios</h4>
              <p className="text-sm text-muted-foreground">Tareas se crean, modifican o eliminan automáticamente según cambios en las reservas</p>
            </div>
            <div className="p-4 bg-muted rounded-lg">
              <h4 className="font-semibold mb-2">🔑 API Avantio PMS v1</h4>
              <p className="text-sm text-muted-foreground">Conexión directa con la API real usando token de autenticación</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default AvantioAutomation;
