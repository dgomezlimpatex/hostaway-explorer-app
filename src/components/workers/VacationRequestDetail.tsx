import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Calendar,
  User,
  Clock,
  FileText,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Check,
  X,
} from 'lucide-react';
import { VacationRequest } from '@/types/calendar';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface VacationRequestDetailProps {
  request: VacationRequest | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isManager?: boolean;
  onApprove?: (requestId: string) => void;
  onReject?: (requestId: string) => void;
}

export const VacationRequestDetail: React.FC<VacationRequestDetailProps> = ({
  request,
  open,
  onOpenChange,
  isManager = false,
  onApprove,
  onReject,
}) => {
  if (!request) return null;

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending':
        return <Clock className="h-5 w-5 text-yellow-500" />;
      case 'approved':
        return <CheckCircle2 className="h-5 w-5 text-green-500" />;
      case 'rejected':
        return <XCircle className="h-5 w-5 text-red-500" />;
      default:
        return <AlertTriangle className="h-5 w-5 text-gray-500" />;
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

  const getRequestTypeColor = (type: string) => {
    switch (type) {
      case 'vacation':
        return 'bg-primary/10 text-primary-foreground border-primary/20';
      case 'sick':
        return 'bg-destructive/10 text-destructive-foreground border-destructive/20';
      case 'personal':
        return 'bg-secondary/10 text-secondary-foreground border-secondary/20';
      default:
        return 'bg-muted/10 text-muted-foreground border-muted/20';
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Detalle de Solicitud
          </DialogTitle>
          <DialogDescription>
            Información completa de la solicitud de vacaciones
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Status and Type */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Badge className={getStatusColor(request.status)}>
                {getStatusIcon(request.status)}
                <span className="ml-2 capitalize">{request.status}</span>
              </Badge>
              <Badge className={getRequestTypeColor(request.requestType)}>
                {getRequestTypeLabel(request.requestType)}
              </Badge>
            </div>
            <div className="text-sm text-muted-foreground">
              ID: {request.id.slice(0, 8)}
            </div>
          </div>

          {/* Date Information */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Calendar className="h-4 w-4" />
                Período Solicitado
              </div>
              
              <div className="space-y-2 pl-6">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Fecha Inicio:</span>
                  <span className="font-medium">
                    {format(new Date(request.startDate), 'dd MMM yyyy', { locale: es })}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Fecha Fin:</span>
                  <span className="font-medium">
                    {format(new Date(request.endDate), 'dd MMM yyyy', { locale: es })}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Días Solicitados:</span>
                  <span className="font-bold text-primary">{request.daysRequested} días</span>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Clock className="h-4 w-4" />
                Fechas del Proceso
              </div>
              
              <div className="space-y-2 pl-6">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Solicitado:</span>
                  <span>
                    {format(new Date(request.requestedAt), 'dd MMM yyyy HH:mm', { locale: es })}
                  </span>
                </div>
                {request.reviewedAt && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Revisado:</span>
                    <span>
                      {format(new Date(request.reviewedAt), 'dd MMM yyyy HH:mm', { locale: es })}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>

          <Separator />

          {/* Reason and Notes */}
          <div className="space-y-4">
            {request.reason && (
              <div>
                <h4 className="text-sm font-medium mb-2">Motivo</h4>
                <p className="text-sm text-muted-foreground bg-muted/50 p-3 rounded-lg">
                  {request.reason}
                </p>
              </div>
            )}

            {request.notes && (
              <div>
                <h4 className="text-sm font-medium mb-2">Notas Adicionales</h4>
                <p className="text-sm text-muted-foreground bg-muted/50 p-3 rounded-lg">
                  {request.notes}
                </p>
              </div>
            )}

            {request.reviewNotes && (
              <div>
                <h4 className="text-sm font-medium mb-2">Notas de Revisión</h4>
                <p className="text-sm text-muted-foreground bg-muted/50 p-3 rounded-lg">
                  {request.reviewNotes}
                </p>
              </div>
            )}
          </div>

          {/* Manager Actions */}
          {isManager && request.status === 'pending' && (
            <>
              <Separator />
              <div className="space-y-3">
                <h4 className="text-sm font-medium">Acciones de Revisión</h4>
                <div className="flex gap-3">
                  <Button
                    onClick={() => onApprove?.(request.id)}
                    className="flex items-center gap-2"
                    variant="default"
                  >
                    <Check className="h-4 w-4" />
                    Aprobar Solicitud
                  </Button>
                  <Button
                    onClick={() => onReject?.(request.id)}
                    variant="destructive"
                    className="flex items-center gap-2"
                  >
                    <X className="h-4 w-4" />
                    Rechazar Solicitud
                  </Button>
                </div>
              </div>
            </>
          )}

          {/* Close Button */}
          <div className="flex justify-end pt-4">
            <Button onClick={() => onOpenChange(false)}>
              Cerrar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};