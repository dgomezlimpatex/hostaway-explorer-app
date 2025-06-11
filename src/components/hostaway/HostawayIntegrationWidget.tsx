
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { RefreshCw, Calendar, CheckCircle, XCircle, Clock, AlertTriangle } from "lucide-react";
import { useQuery } from '@tanstack/react-query';
import { hostawaySync } from '@/services/hostawaySync';
import { useToast } from '@/hooks/use-toast';

export const HostawayIntegrationWidget = () => {
  const { toast } = useToast();

  const { data: stats, isLoading: statsLoading, refetch: refetchStats } = useQuery({
    queryKey: ['hostaway-stats'],
    queryFn: hostawaySync.getSyncStats,
    refetchInterval: 60000, // Actualizar cada minuto
  });

  const { data: logs, isLoading: logsLoading } = useQuery({
    queryKey: ['hostaway-logs'],
    queryFn: () => hostawaySync.getSyncLogs(5),
    refetchInterval: 60000,
  });

  const handleManualSync = async () => {
    try {
      toast({
        title: "Sincronización iniciada",
        description: "Sincronizando con Hostaway...",
      });

      await hostawaySync.runSync();
      
      toast({
        title: "Sincronización completada",
        description: "Los datos se han actualizado correctamente.",
      });

      refetchStats();
    } catch (error) {
      console.error('Error en sincronización manual:', error);
      toast({
        title: "Error en sincronización",
        description: "No se pudo completar la sincronización. Revisa la consola para más detalles.",
        variant: "destructive",
      });
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'failed':
        return <XCircle className="h-4 w-4 text-red-500" />;
      case 'running':
        return <RefreshCw className="h-4 w-4 text-blue-500 animate-spin" />;
      default:
        return <Clock className="h-4 w-4 text-gray-500" />;
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('es-ES');
  };

  if (statsLoading || logsLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Integración Hostaway
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-4">
            <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2 text-gray-400" />
            <p className="text-sm text-gray-500">Cargando datos de sincronización...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Integración Hostaway
          </CardTitle>
          <Button 
            onClick={handleManualSync} 
            size="sm" 
            variant="outline"
            className="flex items-center gap-2"
          >
            <RefreshCw className="h-4 w-4" />
            Sincronizar
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Estado actual */}
        <div className="grid grid-cols-2 gap-4">
          <div className="text-center p-3 bg-blue-50 rounded-lg">
            <div className="text-2xl font-bold text-blue-600">
              {typeof stats?.totalReservations === 'number' ? stats.totalReservations : 0}
            </div>
            <div className="text-sm text-blue-700">Reservas Total</div>
          </div>
          <div className="text-center p-3 bg-green-50 rounded-lg">
            <div className="text-2xl font-bold text-green-600">
              {typeof stats?.activeTasks === 'number' ? stats.activeTasks : 0}
            </div>
            <div className="text-sm text-green-700">Tareas Activas</div>
          </div>
        </div>

        <Separator />

        {/* Última sincronización */}
        {stats?.lastSync && (
          <div>
            <h4 className="font-medium mb-2 flex items-center gap-2">
              {getStatusIcon(stats.lastSyncStatus)}
              Última Sincronización
            </h4>
            <div className="text-sm text-gray-600 mb-2">
              {formatDate(stats.lastSync)}
            </div>
            
            {stats.lastSyncStats && (
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="flex justify-between">
                  <span>Nuevas:</span>
                  <Badge variant="secondary">{stats.lastSyncStats.newReservations}</Badge>
                </div>
                <div className="flex justify-between">
                  <span>Actualizadas:</span>
                  <Badge variant="secondary">{stats.lastSyncStats.updatedReservations}</Badge>
                </div>
                <div className="flex justify-between">
                  <span>Canceladas:</span>
                  <Badge variant="destructive">{stats.lastSyncStats.cancelledReservations}</Badge>
                </div>
                <div className="flex justify-between">
                  <span>Tareas:</span>
                  <Badge variant="default">{stats.lastSyncStats.tasksCreated}</Badge>
                </div>
              </div>
            )}

            {stats.lastSyncStats?.errors && stats.lastSyncStats.errors.length > 0 && (
              <div className="mt-2 p-2 bg-red-50 rounded text-xs">
                <div className="flex items-center gap-1 text-red-700 mb-1">
                  <AlertTriangle className="h-3 w-3" />
                  {stats.lastSyncStats.errors.length} Error(es)
                </div>
              </div>
            )}
          </div>
        )}

        <Separator />

        {/* Historial reciente */}
        <div>
          <h4 className="font-medium mb-2">Historial Reciente</h4>
          <div className="space-y-2">
            {logs && logs.length > 0 ? (
              logs.slice(0, 3).map((log) => (
                <div key={log.id} className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    {getStatusIcon(log.status)}
                    <span>{formatDate(log.sync_started_at)}</span>
                  </div>
                  <div className="flex gap-1">
                    {log.new_reservations > 0 && (
                      <Badge variant="secondary" className="text-xs">
                        +{log.new_reservations}
                      </Badge>
                    )}
                    {log.cancelled_reservations > 0 && (
                      <Badge variant="destructive" className="text-xs">
                        -{log.cancelled_reservations}
                      </Badge>
                    )}
                  </div>
                </div>
              ))
            ) : (
              <p className="text-xs text-gray-500">No hay sincronizaciones recientes</p>
            )}
          </div>
        </div>

        <div className="text-xs text-gray-500 text-center">
          Sincronización automática cada 2 horas
        </div>
      </CardContent>
    </Card>
  );
};
