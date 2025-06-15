
import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { CalendarDays, RotateCw, CheckCircle } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { hostawaySync } from '@/services/hostawaySync';
import { toast } from '@/hooks/use-toast';

export function HostawayIntegrationWidget() {
  const queryClient = useQueryClient();

  // Obtener estadísticas de sincronización
  const { data: syncStats, isLoading } = useQuery({
    queryKey: ['hostaway-sync-stats'],
    queryFn: () => hostawaySync.getSyncStats(),
    refetchInterval: 30000, // Refrescar cada 30 segundos
  });

  // Mutación para sincronización manual
  const syncMutation = useMutation({
    mutationFn: () => hostawaySync.runSync(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hostaway-sync-stats'] });
      toast({
        title: "Sincronización completada",
        description: "Las reservas han sido sincronizadas exitosamente.",
      });
    },
    onError: (error) => {
      console.error('Error en sincronización:', error);
      toast({
        title: "Error en sincronización",
        description: "Ha ocurrido un error durante la sincronización.",
        variant: "destructive",
      });
    },
  });

  // Formatear fecha
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('es-ES', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CalendarDays className="h-5 w-5" />
            Integración Hostaway
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p>Cargando estadísticas...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Accordion type="single" collapsible className="w-full">
      <AccordionItem value="hostaway-integration" className="border rounded-lg bg-white shadow-lg">
        <AccordionTrigger className="px-6 py-4 hover:no-underline">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-50 rounded-lg">
              <CalendarDays className="h-5 w-5 text-blue-600" />
            </div>
            <div className="text-left">
              <h3 className="font-semibold text-gray-900">Integración Hostaway</h3>
              <p className="text-sm text-gray-600">
                Última sincronización: {syncStats?.lastSync ? formatDate(syncStats.lastSync) : 'Nunca'}
              </p>
            </div>
            <div className="ml-auto">
              <Badge variant={
                syncStats?.lastSyncStatus === 'completed' ? 'default' :
                syncStats?.lastSyncStatus === 'failed' ? 'destructive' : 'secondary'
              }>
                {syncStats?.lastSyncStatus === 'completed' ? 'Completada' :
                 syncStats?.lastSyncStatus === 'failed' ? 'Fallida' :
                 syncStats?.lastSyncStatus === 'running' ? 'En progreso' : 'Pendiente'}
              </Badge>
            </div>
          </div>
        </AccordionTrigger>
        <AccordionContent className="px-6 pb-6">
          <div className="space-y-4">
            {/* Estado de la última sincronización */}
            <div className="space-y-2">
              <h4 className="font-medium">Estado de Sincronización</h4>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Última sincronización:</span>
                <span className="text-sm">
                  {syncStats?.lastSync ? formatDate(syncStats.lastSync) : 'Nunca'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Estado:</span>
                <Badge variant={
                  syncStats?.lastSyncStatus === 'completed' ? 'default' :
                  syncStats?.lastSyncStatus === 'failed' ? 'destructive' : 'secondary'
                }>
                  {syncStats?.lastSyncStatus === 'completed' ? 'Completada' :
                   syncStats?.lastSyncStatus === 'failed' ? 'Fallida' :
                   syncStats?.lastSyncStatus === 'running' ? 'En progreso' : 'Pendiente'}
                </Badge>
              </div>
            </div>

            {/* Estadísticas */}
            {syncStats?.lastSyncStats && (
              <div className="space-y-2">
                <h4 className="font-medium">Última Sincronización</h4>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">Procesadas:</span>
                    <span className="ml-2 font-medium">
                      {syncStats.lastSyncStats.reservationsProcessed?.toString() || '0'}
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Nuevas:</span>
                    <span className="ml-2 font-medium text-green-600">
                      {syncStats.lastSyncStats.newReservations?.toString() || '0'}
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Actualizadas:</span>
                    <span className="ml-2 font-medium text-blue-600">
                      {syncStats.lastSyncStats.updatedReservations?.toString() || '0'}
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Canceladas:</span>
                    <span className="ml-2 font-medium text-red-600">
                      {syncStats.lastSyncStats.cancelledReservations?.toString() || '0'}
                    </span>
                  </div>
                </div>
              </div>
            )}

            <Separator />

            {/* Totales */}
            <div className="space-y-2">
              <h4 className="font-medium">Totales</h4>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Reservas totales:</span>
                  <span className="ml-2 font-medium">
                    {syncStats?.totalReservations?.toString() || '0'}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground">Tareas activas:</span>
                  <span className="ml-2 font-medium">
                    {syncStats?.activeTasks?.toString() || '0'}
                  </span>
                </div>
              </div>
            </div>

            {/* Sincronización manual */}
            <Button
              onClick={() => syncMutation.mutate()}
              disabled={syncMutation.isPending}
              className="w-full"
            >
              <RotateCw className="mr-2 h-4 w-4" />
              {syncMutation.isPending ? 'Sincronizando...' : 'Sincronizar Ahora'}
            </Button>

            <div className="text-xs text-muted-foreground space-y-1">
              <p>• La sincronización automática se ejecuta cada 2 horas</p>
              <p>• Las nuevas reservas crean tareas automáticamente</p>
              <p>• Las cancelaciones eliminan las tareas correspondientes</p>
            </div>
          </div>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}
