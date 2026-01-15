
import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Calendar, History, Users, Building2, Search } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useAllClientReservations, useClientReservationLogs, useAllClientPortalAccess } from '@/hooks/useClientPortal';
import { useClients } from '@/hooks/useClients';

const ClientReservationsAdmin = () => {
  const [clientFilter, setClientFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');

  const { data: clients = [] } = useClients();
  const { data: portalAccess = [] } = useAllClientPortalAccess();
  const { data: reservations = [], isLoading: loadingReservations } = useAllClientReservations({
    clientId: clientFilter !== 'all' ? clientFilter : undefined,
    status: statusFilter !== 'all' ? statusFilter as 'active' | 'cancelled' | 'completed' : undefined,
  });
  const { data: logs = [], isLoading: loadingLogs } = useClientReservationLogs({
    clientId: clientFilter !== 'all' ? clientFilter : undefined,
  });

  // Stats
  const activePortals = portalAccess.filter(p => p.isActive).length;
  const activeReservations = reservations.filter(r => r.status === 'active').length;
  const totalReservations = reservations.length;

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <Badge className="bg-green-100 text-green-800">Activa</Badge>;
      case 'cancelled':
        return <Badge variant="destructive">Cancelada</Badge>;
      case 'completed':
        return <Badge variant="secondary">Completada</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  const getActionBadge = (action: string) => {
    switch (action) {
      case 'created':
        return <Badge className="bg-blue-100 text-blue-800">Creada</Badge>;
      case 'updated':
        return <Badge className="bg-yellow-100 text-yellow-800">Modificada</Badge>;
      case 'cancelled':
        return <Badge variant="destructive">Cancelada</Badge>;
      default:
        return <Badge>{action}</Badge>;
    }
  };

  const filteredReservations = reservations.filter(r => {
    if (!searchTerm) return true;
    const client = clients.find(c => c.id === r.clientId);
    const searchLower = searchTerm.toLowerCase();
    return (
      client?.nombre.toLowerCase().includes(searchLower) ||
      r.property?.nombre?.toLowerCase().includes(searchLower) ||
      r.property?.codigo?.toLowerCase().includes(searchLower)
    );
  });

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="container mx-auto px-4 py-6 space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
          <div className="flex items-center gap-4">
            <Link to="/clients">
              <Button variant="outline" size="sm" className="flex items-center gap-2">
                <ArrowLeft className="h-4 w-4" />
                Volver a Clientes
              </Button>
            </Link>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">
                Reservas de Clientes
              </h1>
              <p className="text-gray-600 mt-1">
                Gestión y seguimiento de reservas del portal de clientes
              </p>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-primary/10 rounded-lg">
                  <Users className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{activePortals}</p>
                  <p className="text-sm text-muted-foreground">Portales Activos</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-100 rounded-lg">
                  <Calendar className="h-5 w-5 text-green-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{activeReservations}</p>
                  <p className="text-sm text-muted-foreground">Reservas Activas</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <Building2 className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{totalReservations}</p>
                  <p className="text-sm text-muted-foreground">Total Reservas</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-purple-100 rounded-lg">
                  <History className="h-5 w-5 text-purple-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{logs.length}</p>
                  <p className="text-sm text-muted-foreground">Acciones Registradas</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-wrap gap-4">
              <div className="flex-1 min-w-[200px]">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar por cliente o propiedad..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
              <Select value={clientFilter} onValueChange={setClientFilter}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="Filtrar por cliente" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los clientes</SelectItem>
                  {clients.map((client) => (
                    <SelectItem key={client.id} value={client.id}>
                      {client.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Estado" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los estados</SelectItem>
                  <SelectItem value="active">Activas</SelectItem>
                  <SelectItem value="cancelled">Canceladas</SelectItem>
                  <SelectItem value="completed">Completadas</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Content Tabs */}
        <Tabs defaultValue="reservations" className="space-y-4">
          <TabsList>
            <TabsTrigger value="reservations" className="flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              Reservas
            </TabsTrigger>
            <TabsTrigger value="logs" className="flex items-center gap-2">
              <History className="h-4 w-4" />
              Historial
            </TabsTrigger>
          </TabsList>

          <TabsContent value="reservations">
            <Card>
              <CardHeader>
                <CardTitle>Lista de Reservas</CardTitle>
              </CardHeader>
              <CardContent>
                {loadingReservations ? (
                  <div className="flex justify-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                  </div>
                ) : filteredReservations.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    No hay reservas que mostrar
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Cliente</TableHead>
                          <TableHead>Propiedad</TableHead>
                          <TableHead>Check-in</TableHead>
                          <TableHead>Check-out</TableHead>
                          <TableHead>Huéspedes</TableHead>
                          <TableHead>Estado</TableHead>
                          <TableHead>Creada</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredReservations.map((reservation) => {
                          const client = clients.find(c => c.id === reservation.clientId);
                          return (
                            <TableRow key={reservation.id}>
                              <TableCell className="font-medium">
                                {client?.nombre || 'Cliente desconocido'}
                              </TableCell>
                              <TableCell>
                                <div>
                                  <div className="font-medium">{reservation.property?.nombre}</div>
                                  <div className="text-xs text-muted-foreground">{reservation.property?.codigo}</div>
                                </div>
                              </TableCell>
                              <TableCell>
                                {format(new Date(reservation.checkInDate), 'dd MMM yyyy', { locale: es })}
                              </TableCell>
                              <TableCell>
                                {format(new Date(reservation.checkOutDate), 'dd MMM yyyy', { locale: es })}
                              </TableCell>
                              <TableCell>{reservation.guestCount || '-'}</TableCell>
                              <TableCell>{getStatusBadge(reservation.status)}</TableCell>
                              <TableCell className="text-sm text-muted-foreground">
                                {format(new Date(reservation.createdAt), 'dd/MM/yy HH:mm', { locale: es })}
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="logs">
            <Card>
              <CardHeader>
                <CardTitle>Historial de Acciones</CardTitle>
              </CardHeader>
              <CardContent>
                {loadingLogs ? (
                  <div className="flex justify-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                  </div>
                ) : logs.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    No hay acciones registradas
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Fecha</TableHead>
                          <TableHead>Cliente</TableHead>
                          <TableHead>Acción</TableHead>
                          <TableHead>Detalles</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {logs.map((log) => {
                          const client = clients.find(c => c.id === log.clientId);
                          return (
                            <TableRow key={log.id}>
                              <TableCell className="text-sm">
                                {format(new Date(log.createdAt), 'dd/MM/yy HH:mm', { locale: es })}
                              </TableCell>
                              <TableCell className="font-medium">
                                {client?.nombre || 'Cliente desconocido'}
                              </TableCell>
                              <TableCell>{getActionBadge(log.action)}</TableCell>
                              <TableCell className="max-w-xs truncate text-sm text-muted-foreground">
                                {log.newData?.property_name || log.oldData?.property_name || '-'}
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default ClientReservationsAdmin;
