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
  FileText,
  Plus,
  Eye,
  Edit,
  Download,
  Upload,
  Calendar,
  Clock,
  DollarSign,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Building2,
  User
} from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { ContractForm } from './ContractForm';
import { ContractDetail } from './ContractDetail';
import { useCleanerContracts } from '@/hooks/useWorkerContracts';

interface ContractManagementProps {
  cleanerId: string;
  cleanerName: string;
  isManager?: boolean;
}

export const ContractManagement: React.FC<ContractManagementProps> = ({ 
  cleanerId, 
  cleanerName,
  isManager = false 
}) => {
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [selectedContract, setSelectedContract] = useState<any>(null);
  const [editingContract, setEditingContract] = useState<any>(null);

  const { data: contracts = [], isLoading } = useCleanerContracts(cleanerId);
  
  // Separate by status - Using isActive and endDate to determine status
  const activeContracts = contracts.filter(c => c.isActive);
  const expiredContracts = contracts.filter(c => !c.isActive && c.endDate && new Date(c.endDate) < new Date());
  const draftContracts = contracts.filter(c => !c.isActive && (!c.endDate || new Date(c.endDate) >= new Date()));

  const getStatusIcon = (isActive: boolean, endDate?: string) => {
    if (isActive) return <CheckCircle2 className="h-4 w-4" />;
    if (endDate && new Date(endDate) < new Date()) return <XCircle className="h-4 w-4" />;
    return <Clock className="h-4 w-4" />;
  };

  const getStatusColor = (isActive: boolean, endDate?: string) => {
    if (isActive) return 'bg-success/10 text-success-foreground border-success/20';
    if (endDate && new Date(endDate) < new Date()) return 'bg-destructive/10 text-destructive-foreground border-destructive/20';
    return 'bg-warning/10 text-warning-foreground border-warning/20';
  };

  const getStatusLabel = (isActive: boolean, endDate?: string) => {
    if (isActive) return 'Activo';
    if (endDate && new Date(endDate) < new Date()) return 'Vencido';
    return 'Borrador';
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

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-center">
            <Clock className="h-6 w-6 animate-spin mr-2" />
            Cargando contratos...
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
          <h3 className="text-lg font-semibold">Gestión de Contratos</h3>
          <p className="text-sm text-muted-foreground">
            Administración contractual para {cleanerName}
          </p>
        </div>
        {isManager && (
          <Button onClick={() => setIsFormOpen(true)} className="flex items-center gap-2">
            <Plus className="h-4 w-4" />
            Nuevo Contrato
          </Button>
        )}
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-success-foreground">Activos</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activeContracts.length}</div>
            <div className="text-xs text-muted-foreground">contratos vigentes</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-destructive-foreground">Vencidos</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{expiredContracts.length}</div>
            <div className="text-xs text-muted-foreground">requieren renovación</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-warning-foreground">Borradores</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{draftContracts.length}</div>
            <div className="text-xs text-muted-foreground">pendientes firma</div>
          </CardContent>
        </Card>
      </div>

      {/* Current Active Contract Highlight */}
      {activeContracts.length > 0 && (
        <Card className="border-primary/20 bg-primary/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-success-foreground" />
              Contrato Activo
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Tipo</p>
                <Badge className={getContractTypeColor(activeContracts[0].contractType)}>
                  {getContractTypeLabel(activeContracts[0].contractType)}
                </Badge>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Tarifa</p>
                <p className="font-medium">€{activeContracts[0].hourlyRate}/hora</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Horas Semanales</p>
                <p className="font-medium">{activeContracts[0].contractHoursPerWeek}h</p>
              </div>
            </div>
            <div className="mt-4 flex items-center justify-between">
              <div className="text-sm text-muted-foreground">
                Desde: {format(new Date(activeContracts[0].startDate), 'dd MMM yyyy', { locale: es })}
                {activeContracts[0].endDate && (
                  <span className="ml-4">
                    Hasta: {format(new Date(activeContracts[0].endDate), 'dd MMM yyyy', { locale: es })}
                  </span>
                )}
              </div>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => setSelectedContract(activeContracts[0])}
              >
                Ver Detalles
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Contracts History Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Historial de Contratos ({contracts.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {contracts.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No hay contratos registrados</p>
              <p className="text-sm">Cree el primer contrato usando el botón de arriba</p>
            </div>
          ) : (
            <ScrollArea className="h-[400px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Período</TableHead>
                    <TableHead>Tarifa</TableHead>
                    <TableHead>Horas</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {contracts.map((contract) => (
                    <TableRow key={contract.id}>
                      <TableCell>
                        <Badge className={getContractTypeColor(contract.contractType)}>
                          {getContractTypeLabel(contract.contractType)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          <div>{format(new Date(contract.startDate), 'dd MMM yyyy', { locale: es })}</div>
                          <div className="text-muted-foreground">
                            {contract.endDate 
                              ? format(new Date(contract.endDate), 'dd MMM yyyy', { locale: es })
                              : 'Indefinido'
                            }
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="font-medium">€{contract.hourlyRate}</span>
                        <div className="text-xs text-muted-foreground">por hora</div>
                      </TableCell>
                      <TableCell>
                        <span className="font-medium">{contract.contractHoursPerWeek}h</span>
                        <div className="text-xs text-muted-foreground">semanales</div>
                      </TableCell>
                      <TableCell>
                        <Badge className={getStatusColor(contract.isActive, contract.endDate)}>
                          {getStatusIcon(contract.isActive, contract.endDate)}
                          <span className="ml-1">{getStatusLabel(contract.isActive, contract.endDate)}</span>
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setSelectedContract(contract)}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          
                          {isManager && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setEditingContract(contract)}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                          )}
                          
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              // Download contract logic
                              console.log('Download contract', contract.id);
                            }}
                          >
                            <Download className="h-4 w-4" />
                          </Button>
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
      <ContractForm
        cleanerId={cleanerId}
        contract={editingContract}
        open={isFormOpen || !!editingContract}
        onOpenChange={(open) => {
          if (!open) {
            setIsFormOpen(false);
            setEditingContract(null);
          }
        }}
      />

      <ContractDetail
        contract={selectedContract}
        open={!!selectedContract}
        onOpenChange={(open) => !open && setSelectedContract(null)}
        isManager={isManager}
      />
    </div>
  );
};