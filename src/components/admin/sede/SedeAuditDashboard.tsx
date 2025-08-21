import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { 
  Shield, 
  Users, 
  Building2, 
  Activity, 
  AlertTriangle,
  Clock,
  User,
  MapPin,
  Info,
  TrendingUp
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';

interface SedeAuditLog {
  id: string;
  user_id: string | null;
  event_type: string;
  from_sede_id: string | null;
  to_sede_id: string | null;
  event_data: any;
  ip_address: string | null;
  created_at: string;
}

const eventTypeLabels: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  sede_changed: { label: 'Cambio de Sede', variant: 'default' },
  sede_access_granted: { label: 'Acceso Otorgado', variant: 'default' },
  sede_access_revoked: { label: 'Acceso Revocado', variant: 'destructive' },
  sede_created: { label: 'Sede Creada', variant: 'default' },
  sede_updated: { label: 'Sede Actualizada', variant: 'secondary' },
  sede_deactivated: { label: 'Sede Desactivada', variant: 'destructive' },
};

const useSedeAuditLogs = (limit: number = 50) => {
  return useQuery({
    queryKey: ['sede-audit-logs', limit],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sede_audit_log')
        .select(`
          *,
          from_sede:sedes!from_sede_id(nombre, codigo),
          to_sede:sedes!to_sede_id(nombre, codigo),
          user:profiles!user_id(full_name, email)
        `)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) throw error;
      return data as any[];
    },
  });
};

const useSedeAuditStats = () => {
  return useQuery({
    queryKey: ['sede-audit-stats'],
    queryFn: async () => {
      // Estadísticas de los últimos 7 días
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      const { data, error } = await supabase
        .from('sede_audit_log')
        .select('event_type, created_at')
        .gte('created_at', sevenDaysAgo.toISOString());

      if (error) throw error;

      // Procesar estadísticas
      const eventCounts = data.reduce((acc: Record<string, number>, log) => {
        acc[log.event_type] = (acc[log.event_type] || 0) + 1;
        return acc;
      }, {});

      const totalEvents = data.length;
      const uniqueDays = new Set(data.map(log => log.created_at.split('T')[0])).size;

      return {
        eventCounts,
        totalEvents,
        averagePerDay: uniqueDays > 0 ? Math.round(totalEvents / uniqueDays) : 0,
        lastWeekCount: totalEvents,
      };
    },
  });
};

export const SedeAuditDashboard = () => {
  const { data: auditLogs, isLoading, error } = useSedeAuditLogs();
  const { data: stats, isLoading: statsLoading } = useSedeAuditStats();

  if (error) {
    return (
      <Alert>
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>
          Error cargando logs de auditoría: {error.message}
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <TooltipProvider>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold flex items-center gap-2">
              <Shield className="h-6 w-6 text-primary" />
              Dashboard de Auditoría - Sedes
            </h2>
            <p className="text-muted-foreground">
              Monitoreo de actividades y cambios relacionados con sedes
            </p>
          </div>
        </div>

        {/* Estadísticas */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Activity className="h-4 w-4" />
                Eventos (7 días)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {statsLoading ? <Skeleton className="h-8 w-16" /> : stats?.totalEvents || 0}
              </div>
              <p className="text-xs text-muted-foreground">
                {statsLoading ? (
                  <Skeleton className="h-4 w-20" />
                ) : (
                  `Promedio: ${stats?.averagePerDay || 0}/día`
                )}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Users className="h-4 w-4" />
                Cambios de Sede
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {statsLoading ? <Skeleton className="h-8 w-16" /> : stats?.eventCounts?.sede_changed || 0}
              </div>
              <p className="text-xs text-muted-foreground">Últimos 7 días</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Building2 className="h-4 w-4" />
                Sedes Creadas
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {statsLoading ? <Skeleton className="h-8 w-16" /> : stats?.eventCounts?.sede_created || 0}
              </div>
              <p className="text-xs text-muted-foreground">Últimos 7 días</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <TrendingUp className="h-4 w-4" />
                Accesos Otorgados
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {statsLoading ? <Skeleton className="h-8 w-16" /> : stats?.eventCounts?.sede_access_granted || 0}
              </div>
              <p className="text-xs text-muted-foreground">Últimos 7 días</p>
            </CardContent>
          </Card>
        </div>

        {/* Logs de Auditoría */}
        <Tabs defaultValue="recent" className="w-full">
          <TabsList>
            <TabsTrigger value="recent">Actividad Reciente</TabsTrigger>
            <TabsTrigger value="by-type">Por Tipo de Evento</TabsTrigger>
          </TabsList>

          <TabsContent value="recent" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="h-5 w-5" />
                  Actividad Reciente
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Últimos 50 eventos de auditoría ordenados por fecha</p>
                    </TooltipContent>
                  </Tooltip>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[500px]">
                  {isLoading ? (
                    <div className="space-y-3">
                      {Array.from({ length: 10 }).map((_, i) => (
                        <div key={i} className="flex items-center space-x-4">
                          <Skeleton className="h-10 w-10 rounded-full" />
                          <div className="space-y-2 flex-1">
                            <Skeleton className="h-4 w-3/4" />
                            <Skeleton className="h-3 w-1/2" />
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : auditLogs && auditLogs.length > 0 ? (
                    <div className="space-y-3">
                      {auditLogs.map((log: any) => {
                        const eventType = eventTypeLabels[log.event_type] || { 
                          label: log.event_type, 
                          variant: 'outline' as const 
                        };
                        
                        return (
                          <div key={log.id} className="flex items-start space-x-4 p-3 border rounded-lg">
                            <div className="flex-shrink-0 mt-1">
                              <Badge variant={eventType.variant}>
                                {eventType.label}
                              </Badge>
                            </div>
                            
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                {log.user && (
                                  <div className="flex items-center gap-1 text-sm">
                                    <User className="h-3 w-3" />
                                    <span className="font-medium">
                                      {log.user.full_name || log.user.email}
                                    </span>
                                  </div>
                                )}
                                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                  <Clock className="h-3 w-3" />
                                  {formatDistanceToNow(new Date(log.created_at), { 
                                    addSuffix: true, 
                                    locale: es 
                                  })}
                                </div>
                              </div>
                              
                              <div className="text-sm">
                                {log.event_type === 'sede_changed' && (
                                  <div className="flex items-center gap-2">
                                    <span>Cambió de</span>
                                    {log.from_sede && (
                                      <Badge variant="outline" className="text-xs">
                                        {log.from_sede.nombre}
                                      </Badge>
                                    )}
                                    <span>a</span>
                                    {log.to_sede && (
                                      <Badge variant="outline" className="text-xs">
                                        {log.to_sede.nombre}
                                      </Badge>
                                    )}
                                  </div>
                                )}
                                
                                {log.event_type === 'sede_created' && (
                                  <div className="flex items-center gap-2">
                                    <span>Creó la sede</span>
                                    {log.to_sede && (
                                      <Badge variant="outline" className="text-xs">
                                        {log.to_sede.nombre}
                                      </Badge>
                                    )}
                                  </div>
                                )}
                                
                                {(log.event_type === 'sede_access_granted' || log.event_type === 'sede_access_revoked') && (
                                  <div className="flex items-center gap-2">
                                    <span>
                                      {log.event_type === 'sede_access_granted' ? 'Otorgó' : 'Revocó'} acceso a
                                    </span>
                                    {log.to_sede && (
                                      <Badge variant="outline" className="text-xs">
                                        {log.to_sede.nombre}
                                      </Badge>
                                    )}
                                  </div>
                                )}
                              </div>
                              
                              {log.ip_address && (
                                <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
                                  <MapPin className="h-3 w-3" />
                                  <span>IP: {log.ip_address}</span>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="text-center text-muted-foreground py-8">
                      <Shield className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p>No hay logs de auditoría disponibles</p>
                    </div>
                  )}
                </ScrollArea>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="by-type" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {Object.entries(eventTypeLabels).map(([eventType, config]) => {
                const eventLogs = auditLogs?.filter(log => log.event_type === eventType) || [];
                const count = stats?.eventCounts?.[eventType] || 0;
                
                return (
                  <Card key={eventType}>
                    <CardHeader>
                      <CardTitle className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Badge variant={config.variant}>{config.label}</Badge>
                          <span className="text-sm font-normal text-muted-foreground">
                            ({eventLogs.length} total)
                          </span>
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {count} esta semana
                        </div>
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ScrollArea className="h-[200px]">
                        {eventLogs.length > 0 ? (
                          <div className="space-y-2">
                            {eventLogs.slice(0, 10).map((log: any) => (
                              <div key={log.id} className="text-sm border-l-2 border-primary/20 pl-3 py-1">
                                <div className="font-medium">
                                  {log.user?.full_name || log.user?.email || 'Usuario desconocido'}
                                </div>
                                <div className="text-xs text-muted-foreground">
                                  {formatDistanceToNow(new Date(log.created_at), { 
                                    addSuffix: true, 
                                    locale: es 
                                  })}
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="text-center text-muted-foreground text-sm py-8">
                            Sin eventos de este tipo
                          </div>
                        )}
                      </ScrollArea>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </TooltipProvider>
  );
};