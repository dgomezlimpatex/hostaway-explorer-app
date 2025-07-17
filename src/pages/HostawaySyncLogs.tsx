
import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ArrowLeft, Calendar, CheckCircle, XCircle, AlertCircle, RefreshCw, ChevronDown, ChevronRight, FileText, Users, Calendar as CalendarIcon } from 'lucide-react';
import { Link } from 'react-router-dom';
import { hostawaySync } from '@/services/hostawaySync';
import { useProperties } from '@/hooks/useProperties';
import { HostawaySyncLog } from '@/types/hostaway';

const HostawaySyncLogs = () => {
  const { data: logs, isLoading, refetch } = useQuery({
    queryKey: ['hostaway-sync-logs'],
    queryFn: () => hostawaySync.getSyncLogs(50),
    refetchInterval: 30000,
  });

  const { data: properties } = useProperties();

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('es-ES', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  const getPropertyNameFromListingId = (listingId: string | number): string | null => {
    if (!properties) return null;
    
    const numericListingId = typeof listingId === 'string' ? parseInt(listingId) : listingId;
    const property = properties.find(p => p.hostaway_listing_id === numericListingId);
    return property ? property.nombre : null;
  };

  const enhanceErrorMessage = (errorMessage: string): string => {
    // Buscar diferentes patrones de listing IDs en los mensajes de error
    const patterns = [
      /listingMapId[:\s]*(\d+)/gi,
      /listing[:\s]*(\d+)/gi,
      /propiedad[:\s]*(\d+)/gi,
      /property[:\s]*(\d+)/gi
    ];

    let enhancedMessage = errorMessage;

    patterns.forEach(pattern => {
      enhancedMessage = enhancedMessage.replace(pattern, (match, listingId) => {
        const propertyName = getPropertyNameFromListingId(listingId);
        if (propertyName) {
          return `${match} (${propertyName})`;
        }
        return match;
      });
    });

    return enhancedMessage;
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'failed':
        return <XCircle className="h-4 w-4 text-red-600" />;
      case 'running':
        return <RefreshCw className="h-4 w-4 text-blue-600 animate-spin" />;
      default:
        return <AlertCircle className="h-4 w-4 text-yellow-600" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <Badge variant="default" className="bg-green-100 text-green-800">Completada</Badge>;
      case 'failed':
        return <Badge variant="destructive">Fallida</Badge>;
      case 'running':
        return <Badge variant="secondary" className="bg-blue-100 text-blue-800">En progreso</Badge>;
      default:
        return <Badge variant="outline">Desconocido</Badge>;
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900">
        <div className="max-w-7xl mx-auto px-6 py-8">
          <div className="flex items-center gap-4 mb-8">
            <Link to="/">
              <Button variant="outline" size="sm">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Volver
              </Button>
            </Link>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
              Logs de Sincronización Hostaway
            </h1>
          </div>
          <div className="flex justify-center items-center h-64">
            <div className="text-center">
              <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4 text-blue-600" />
              <p className="text-gray-600 dark:text-gray-300">Cargando logs...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900">
      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <Link to="/">
              <Button variant="outline" size="sm">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Volver
              </Button>
            </Link>
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                Logs de Sincronización Hostaway
              </h1>
              <p className="text-gray-600 dark:text-gray-300 mt-1">
                Historial completo de sincronizaciones con información detallada
              </p>
            </div>
          </div>
          <Button onClick={() => refetch()} variant="outline">
            <RefreshCw className="h-4 w-4 mr-2" />
            Actualizar
          </Button>
        </div>

        {/* Logs List */}
        <div className="space-y-6">
          {logs && logs.length > 0 ? (
            logs.map((log: HostawaySyncLog) => (
              <Card key={log.id} className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border-0 shadow-lg">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {getStatusIcon(log.status)}
                      <div>
                        <CardTitle className="text-lg">
                          Sincronización del {formatDate(log.sync_started_at)}
                        </CardTitle>
                        <CardDescription>
                          {log.sync_completed_at ? (
                            <>Duración: {Math.round((new Date(log.sync_completed_at).getTime() - new Date(log.sync_started_at).getTime()) / 1000)} segundos</>
                          ) : (
                            'En progreso...'
                          )}
                        </CardDescription>
                      </div>
                    </div>
                    {getStatusBadge(log.status)}
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
                    <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
                      <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                        {log.reservations_processed || 0}
                      </div>
                      <div className="text-sm text-blue-700 dark:text-blue-300">
                        Reservas procesadas
                      </div>
                    </div>
                    <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg">
                      <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                        {log.new_reservations || 0}
                      </div>
                      <div className="text-sm text-green-700 dark:text-green-300">
                        Nuevas reservas
                      </div>
                    </div>
                    <div className="bg-yellow-50 dark:bg-yellow-900/20 p-4 rounded-lg">
                      <div className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">
                        {log.updated_reservations || 0}
                      </div>
                      <div className="text-sm text-yellow-700 dark:text-yellow-300">
                        Reservas actualizadas
                      </div>
                    </div>
                    <div className="bg-red-50 dark:bg-red-900/20 p-4 rounded-lg">
                      <div className="text-2xl font-bold text-red-600 dark:text-red-400">
                        {log.cancelled_reservations || 0}
                      </div>
                      <div className="text-sm text-red-700 dark:text-red-300">
                        Reservas canceladas
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                    <div className="bg-purple-50 dark:bg-purple-900/20 p-4 rounded-lg">
                      <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                        {log.tasks_created || 0}
                      </div>
                      <div className="text-sm text-purple-700 dark:text-purple-300">
                        Tareas creadas
                      </div>
                    </div>
                    <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
                      <div className="text-2xl font-bold text-gray-600 dark:text-gray-400">
                        {log.errors?.length || 0}
                      </div>
                      <div className="text-sm text-gray-700 dark:text-gray-300">
                        Errores
                      </div>
                    </div>
                  </div>

                  {/* Tareas Creadas - Detalles */}
                  {log.tasks_details && log.tasks_details.length > 0 && (
                    <Collapsible className="mb-4">
                      <CollapsibleTrigger asChild>
                        <Button variant="outline" className="w-full justify-between">
                          <div className="flex items-center gap-2">
                            <CalendarIcon className="h-4 w-4" />
                            Detalles de Tareas Creadas ({log.tasks_details.length})
                          </div>
                          <ChevronDown className="h-4 w-4" />
                        </Button>
                      </CollapsibleTrigger>
                      <CollapsibleContent className="mt-2">
                        <div className="bg-purple-50 dark:bg-purple-900/20 p-4 rounded-lg">
                          <div className="space-y-2 text-sm">
                            {log.tasks_details.map((task, index) => (
                              <div key={index} className="flex justify-between items-center p-2 bg-white dark:bg-gray-800 rounded">
                                <div>
                                  <span className="font-medium">{task.property_name}</span>
                                  <span className="text-gray-600 dark:text-gray-300 ml-2">
                                    ({task.guest_name})
                                  </span>
                                </div>
                                <div className="text-right">
                                  <div className="text-purple-600 dark:text-purple-400 font-medium">
                                    {task.task_date}
                                  </div>
                                  <div className="text-xs text-gray-500">
                                    Reserva: {task.reservation_id}
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </CollapsibleContent>
                    </Collapsible>
                  )}

                  {/* Reservas Procesadas - Detalles */}
                  {log.reservations_details && log.reservations_details.length > 0 && (
                    <Collapsible className="mb-4">
                      <CollapsibleTrigger asChild>
                        <Button variant="outline" className="w-full justify-between">
                          <div className="flex items-center gap-2">
                            <Users className="h-4 w-4" />
                            Detalles de Reservas Procesadas ({log.reservations_details.length})
                          </div>
                          <ChevronDown className="h-4 w-4" />
                        </Button>
                      </CollapsibleTrigger>
                      <CollapsibleContent className="mt-2">
                        <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
                          <div className="space-y-2 text-sm">
                            {log.reservations_details.map((reservation, index) => (
                              <div key={index} className="flex justify-between items-center p-2 bg-white dark:bg-gray-800 rounded">
                                <div>
                                  <span className="font-medium">{reservation.property_name}</span>
                                  <span className="text-gray-600 dark:text-gray-300 ml-2">
                                    ({reservation.guest_name})
                                  </span>
                                  <Badge 
                                    variant={
                                      reservation.action === 'created' ? 'default' :
                                      reservation.action === 'cancelled' ? 'destructive' : 'secondary'
                                    }
                                    className="ml-2"
                                  >
                                    {reservation.action === 'created' ? 'Nueva' :
                                     reservation.action === 'cancelled' ? 'Cancelada' : 'Actualizada'}
                                  </Badge>
                                </div>
                                <div className="text-right">
                                  <div className="text-blue-600 dark:text-blue-400 font-medium">
                                    {reservation.arrival_date} → {reservation.departure_date}
                                  </div>
                                  <div className="text-xs text-gray-500">
                                    {reservation.status} | Reserva: {reservation.reservation_id}
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </CollapsibleContent>
                    </Collapsible>
                  )}

                  {/* Errores */}
                  {log.errors && log.errors.length > 0 && (
                    <Collapsible>
                      <CollapsibleTrigger asChild>
                        <Button variant="outline" className="w-full justify-between text-red-600">
                          <div className="flex items-center gap-2">
                            <XCircle className="h-4 w-4" />
                            Errores Encontrados ({log.errors.length})
                          </div>
                          <ChevronDown className="h-4 w-4" />
                        </Button>
                      </CollapsibleTrigger>
                      <CollapsibleContent className="mt-2">
                        <div className="bg-red-50 dark:bg-red-900/20 p-4 rounded-lg">
                          <h4 className="font-medium text-red-800 dark:text-red-200 mb-2">
                            Errores encontrados:
                          </h4>
                          <ul className="space-y-1 text-sm text-red-700 dark:text-red-300">
                            {log.errors.map((error, index) => (
                              <li key={index} className="list-disc list-inside break-words">
                                {enhanceErrorMessage(error)}
                              </li>
                            ))}
                          </ul>
                        </div>
                      </CollapsibleContent>
                    </Collapsible>
                  )}
                </CardContent>
              </Card>
            ))
          ) : (
            <Card className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border-0 shadow-lg">
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Calendar className="h-12 w-12 text-gray-400 mb-4" />
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                  No hay logs de sincronización
                </h3>
                <p className="text-gray-600 dark:text-gray-300 text-center">
                  Aún no se han realizado sincronizaciones con Hostaway o no hay datos disponibles.
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
};

export default HostawaySyncLogs;
