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
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Calendar,
  User,
  Clock,
  FileText,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Download,
  Building2,
  DollarSign,
  Award,
  Edit,
  RefreshCw
} from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface ContractDetailProps {
  contract: any | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isManager?: boolean;
}

export const ContractDetail: React.FC<ContractDetailProps> = ({
  contract,
  open,
  onOpenChange,
  isManager = false,
}) => {
  if (!contract) return null;

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active':
        return <CheckCircle2 className="h-5 w-5 text-success-foreground" />;
      case 'expired':
        return <XCircle className="h-5 w-5 text-destructive-foreground" />;
      case 'draft':
        return <Clock className="h-5 w-5 text-warning-foreground" />;
      default:
        return <AlertTriangle className="h-5 w-5 text-muted-foreground" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-success/10 text-success-foreground border-success/20';
      case 'expired':
        return 'bg-destructive/10 text-destructive-foreground border-destructive/20';
      case 'draft':
        return 'bg-warning/10 text-warning-foreground border-warning/20';
      default:
        return 'bg-muted/10 text-muted-foreground border-muted/20';
    }
  };

  const getContractTypeLabel = (type: string) => {
    switch (type) {
      case 'full-time':
        return 'Tiempo Completo';
      case 'part-time':
        return 'Tiempo Parcial';
      case 'temporary':
        return 'Temporal';
      case 'freelance':
        return 'Freelance';
      default:
        return type;
    }
  };

  const getContractTypeColor = (type: string) => {
    switch (type) {
      case 'full-time':
        return 'bg-primary/10 text-primary-foreground border-primary/20';
      case 'part-time':
        return 'bg-secondary/10 text-secondary-foreground border-secondary/20';
      case 'temporary':
        return 'bg-warning/10 text-warning-foreground border-warning/20';
      case 'freelance':
        return 'bg-muted/10 text-muted-foreground border-muted/20';
      default:
        return 'bg-muted/10 text-muted-foreground border-muted/20';
    }
  };

  const calculateMonthlySalary = () => {
    return (contract.hourly_rate * contract.contract_hours_per_week * 4.33).toFixed(2);
  };

  const calculateAnnualSalary = () => {
    return (contract.hourly_rate * contract.contract_hours_per_week * 52).toFixed(2);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Detalle del Contrato
          </DialogTitle>
          <DialogDescription>
            Información completa del contrato laboral
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Status and Type */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Badge className={getStatusColor(contract.status)}>
                {getStatusIcon(contract.status)}
                <span className="ml-2 capitalize">{contract.status}</span>
              </Badge>
              <Badge className={getContractTypeColor(contract.contract_type)}>
                {getContractTypeLabel(contract.contract_type)}
              </Badge>
            </div>
            <div className="text-sm text-muted-foreground">
              ID: {contract.id}
            </div>
          </div>

          {/* Main Contract Information */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Basic Information */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <User className="h-4 w-4" />
                  Información del Puesto
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Posición:</span>
                  <span className="font-medium">{contract.position}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Departamento:</span>
                  <span>{contract.department}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Tipo de Contrato:</span>
                  <Badge className={getContractTypeColor(contract.contract_type)} variant="outline">
                    {getContractTypeLabel(contract.contract_type)}
                  </Badge>
                </div>
              </CardContent>
            </Card>

            {/* Compensation */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <DollarSign className="h-4 w-4" />
                  Compensación
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Tarifa por Hora:</span>
                  <span className="font-medium">€{contract.hourly_rate}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Horas Semanales:</span>
                  <span>{contract.contract_hours_per_week}h</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Salario Mensual:</span>
                  <span className="font-bold text-primary">€{calculateMonthlySalary()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Salario Anual:</span>
                  <span className="font-bold text-primary">€{calculateAnnualSalary()}</span>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Dates */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                Fechas del Contrato
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                 <div className="space-y-2">
                   <span className="text-sm text-muted-foreground">Fecha de Inicio</span>
                   <div className="font-medium">
                     {contract.start_date && !isNaN(Date.parse(contract.start_date)) 
                       ? format(new Date(contract.start_date), 'dd MMM yyyy', { locale: es })
                       : 'Fecha no disponible'
                     }
                   </div>
                 </div>
                 
                 <div className="space-y-2">
                   <span className="text-sm text-muted-foreground">Fecha de Fin</span>
                   <div className="font-medium">
                     {contract.end_date && !isNaN(Date.parse(contract.end_date))
                       ? format(new Date(contract.end_date), 'dd MMM yyyy', { locale: es })
                       : 'Contrato Indefinido'
                     }
                   </div>
                 </div>

                 {contract.renewal_date && !isNaN(Date.parse(contract.renewal_date)) && (
                   <div className="space-y-2">
                     <span className="text-sm text-muted-foreground">Renovación</span>
                     <div className="font-medium">
                       {format(new Date(contract.renewal_date), 'dd MMM yyyy', { locale: es })}
                     </div>
                   </div>
                 )}
              </div>
            </CardContent>
          </Card>

          {/* Benefits */}
          {contract.benefits && contract.benefits.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Award className="h-4 w-4" />
                  Beneficios
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {contract.benefits.map((benefit: string, index: number) => (
                    <div key={index} className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-success-foreground" />
                      <span className="text-sm">{benefit}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Documents */}
          {contract.documents && contract.documents.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  Documentos del Contrato
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {contract.documents.map((doc: any, index: number) => (
                    <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex items-center gap-3">
                        <FileText className="h-5 w-5 text-muted-foreground" />
                        <div>
                           <div className="font-medium">{doc.name}</div>
                           <div className="text-sm text-muted-foreground">
                             {doc.uploadDate && !isNaN(Date.parse(doc.uploadDate))
                               ? `Subido el ${format(new Date(doc.uploadDate), 'dd MMM yyyy', { locale: es })}`
                               : 'Fecha de subida no disponible'
                             }
                           </div>
                        </div>
                      </div>
                      <Button variant="ghost" size="sm">
                        <Download className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Notes */}
          {contract.notes && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Notas del Contrato</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground bg-muted/50 p-3 rounded-lg">
                  {contract.notes}
                </p>
              </CardContent>
            </Card>
          )}

          <Separator />

          {/* Manager Actions */}
          {isManager && (
            <div className="space-y-3">
              <h4 className="text-sm font-medium">Acciones de Gestión</h4>
              <div className="flex gap-3 flex-wrap">
                <Button variant="outline" className="flex items-center gap-2">
                  <Edit className="h-4 w-4" />
                  Editar Contrato
                </Button>
                
                {contract.status === 'draft' && (
                  <Button className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4" />
                    Activar Contrato
                  </Button>
                )}
                
                {contract.renewal_date && !isNaN(Date.parse(contract.renewal_date)) && new Date(contract.renewal_date) < new Date() && (
                  <Button variant="outline" className="flex items-center gap-2">
                    <RefreshCw className="h-4 w-4" />
                    Renovar Contrato
                  </Button>
                )}
                
                <Button variant="outline" className="flex items-center gap-2">
                  <Download className="h-4 w-4" />
                  Descargar PDF
                </Button>
              </div>
            </div>
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