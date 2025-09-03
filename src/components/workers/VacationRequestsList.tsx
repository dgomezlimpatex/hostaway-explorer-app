import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { 
  Calendar, 
  Clock, 
  Check, 
  X, 
  Plus, 
  Eye,
  FileText,
  AlertCircle,
  CheckCircle2,
  XCircle 
} from 'lucide-react';
import { useVacationRequests, useUpdateVacationRequest } from '@/hooks/useVacationRequests';
import { VacationRequest } from '@/types/calendar';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { VacationRequestForm } from './VacationRequestForm';
import { VacationRequestDetail } from './VacationRequestDetail';

interface VacationRequestsListProps {
  cleanerId: string;
  cleanerName: string;
  isManager?: boolean;
}

export const VacationRequestsList: React.FC<VacationRequestsListProps> = ({ 
  cleanerId, 
  cleanerName,
  isManager = false 
}) => {
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<VacationRequest | null>(null);
  const [editingRequest, setEditingRequest] = useState<VacationRequest | null>(null);

  const { data: requests = [], isLoading } = useVacationRequests();
  const updateRequest = useUpdateVacationRequest();

  // Filter requests for this cleaner
  const cleanerRequests = requests.filter(req => req.cleanerId === cleanerId);
  
  // Separate by status
  const pendingRequests = cleanerRequests.filter(req => req.status === 'pending');
  const approvedRequests = cleanerRequests.filter(req => req.status === 'approved');
  const rejectedRequests = cleanerRequests.filter(req => req.status === 'rejected');

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending':
        return <Clock className="h-4 w-4" />;
      case 'approved':
        return <CheckCircle2 className="h-4 w-4" />;
      case 'rejected':
        return <XCircle className="h-4 w-4" />;
      default:
        return <AlertCircle className="h-4 w-4" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return 'bg-warning/10 text-warning-foreground border-warning/20';
      case 'approved':
        return 'bg-success/10 text-success-foreground border-success/20';
      case 'rejected':
        return 'bg-destructive/10 text-destructive-foreground border-destructive/20';
      default:
        return 'bg-muted/10 text-muted-foreground border-muted/20';
    }
  };

  const getRequestTypeLabel = (type: string) => {
    switch (type) {
      case 'vacation':
        return 'Vacaciones';
      case 'sick':
        return 'Baja Médica';
      case 'personal':
        return 'Asunto Personal';
      default:
        return type;
    }
  };

  const handleApprove = async (requestId: string) => {
    try {
      await updateRequest.mutateAsync({
        id: requestId,
        updates: {
          status: 'approved',
          reviewedBy: 'current-user', // TODO: Get from auth
          reviewNotes: 'Solicitud aprobada'
        }
      });
    } catch (error) {
      console.error('Error approving request:', error);
    }
  };

  const handleReject = async (requestId: string) => {
    try {
      await updateRequest.mutateAsync({
        id: requestId,
        updates: {
          status: 'rejected',
          reviewedBy: 'current-user', // TODO: Get from auth
          reviewNotes: 'Solicitud rechazada'
        }
      });
    } catch (error) {
      console.error('Error rejecting request:', error);
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-center">
            <Clock className="h-6 w-6 animate-spin mr-2" />
            Cargando solicitudes...
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with Actions */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Solicitudes de Vacaciones</h3>
          <p className="text-sm text-muted-foreground">
            Gestión de vacaciones para {cleanerName}
          </p>
        </div>
        <Button onClick={() => setIsFormOpen(true)} className="flex items-center gap-2">
          <Plus className="h-4 w-4" />
          Nueva Solicitud
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-warning-foreground">Pendientes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{pendingRequests.length}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-success-foreground">Aprobadas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{approvedRequests.length}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-destructive-foreground">Rechazadas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{rejectedRequests.length}</div>
          </CardContent>
        </Card>
      </div>

      {/* Requests Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Historial de Solicitudes ({cleanerRequests.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {cleanerRequests.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Calendar className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No hay solicitudes de vacaciones</p>
              <p className="text-sm">Cree la primera solicitud usando el botón de arriba</p>
            </div>
          ) : (
            <ScrollArea className="h-[400px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Fechas</TableHead>
                    <TableHead>Días</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>Solicitado</TableHead>
                    <TableHead>Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {cleanerRequests.map((request) => (
                    <TableRow key={request.id}>
                      <TableCell>
                        <Badge variant="outline">
                          {getRequestTypeLabel(request.requestType)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          <div>{format(new Date(request.startDate), 'dd MMM yyyy', { locale: es })}</div>
                          <div className="text-muted-foreground">
                            {format(new Date(request.endDate), 'dd MMM yyyy', { locale: es })}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="font-medium">{request.daysRequested}</span>
                      </TableCell>
                      <TableCell>
                        <Badge className={getStatusColor(request.status)}>
                          {getStatusIcon(request.status)}
                          <span className="ml-1 capitalize">{request.status}</span>
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {format(new Date(request.requestedAt), 'dd MMM yyyy', { locale: es })}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setSelectedRequest(request)}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          
                          {isManager && request.status === 'pending' && (
                            <>
                               <Button
                                 variant="ghost"
                                 size="sm"
                                 onClick={() => handleApprove(request.id)}
                                 disabled={updateRequest.isPending}
                               >
                                 <Check className="h-4 w-4 text-success-foreground" />
                               </Button>
                               <Button
                                 variant="ghost"
                                 size="sm"
                                 onClick={() => handleReject(request.id)}
                                 disabled={updateRequest.isPending}
                               >
                                 <X className="h-4 w-4 text-destructive-foreground" />
                               </Button>
                            </>
                          )}
                          
                          {request.status === 'pending' && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setEditingRequest(request)}
                            >
                              Editar
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      {/* Modals */}
      <VacationRequestForm
        cleanerId={cleanerId}
        request={editingRequest}
        open={isFormOpen || !!editingRequest}
        onOpenChange={(open) => {
          if (!open) {
            setIsFormOpen(false);
            setEditingRequest(null);
          }
        }}
      />

      <VacationRequestDetail
        request={selectedRequest}
        open={!!selectedRequest}
        onOpenChange={(open) => !open && setSelectedRequest(null)}
        isManager={isManager}
        onApprove={handleApprove}
        onReject={handleReject}
      />
    </div>
  );
};