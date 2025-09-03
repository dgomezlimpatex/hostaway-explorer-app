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

interface ContractManagementProps {
  cleanerId: string;
  cleanerName: string;
  isManager?: boolean;
}

// Mock data - En una aplicación real, esto vendría de una API
const mockContracts = [
  {
    id: '1',
    type: 'full-time',
    startDate: '2024-01-15',
    endDate: null,
    status: 'active',
    hourlyRate: 12.50,
    contractHoursPerWeek: 40,
    position: 'Limpiador Senior',
    department: 'Limpieza Residencial',
    benefits: ['Seguro médico', 'Vacaciones pagadas', 'Bonificación anual'],
    documents: [
      { name: 'Contrato Principal', url: '#', uploadDate: '2024-01-15' },
      { name: 'Anexo Horarios', url: '#', uploadDate: '2024-01-20' }
    ],
    notes: 'Contrato principal con todas las prestaciones incluidas',
    createdAt: '2024-01-15T09:00:00Z',
    renewalDate: '2025-01-15'
  },
  {
    id: '2',
    type: 'part-time',
    startDate: '2023-06-01',
    endDate: '2023-12-31',
    status: 'expired',
    hourlyRate: 11.00,
    contractHoursPerWeek: 20,
    position: 'Limpiador',
    department: 'Limpieza Comercial',
    benefits: ['Vacaciones proporcionales'],
    documents: [
      { name: 'Contrato Temporal', url: '#', uploadDate: '2023-06-01' }
    ],
    notes: 'Contrato temporal de 6 meses',
    createdAt: '2023-06-01T09:00:00Z',
    renewalDate: null
  }
];

export const ContractManagement: React.FC<ContractManagementProps> = ({ 
  cleanerId, 
  cleanerName,
  isManager = false 
}) => {
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [selectedContract, setSelectedContract] = useState<any>(null);
  const [editingContract, setEditingContract] = useState<any>(null);

  // Filter contracts for this cleaner (in real app, fetch by cleanerId)
  const contracts = mockContracts;
  
  // Separate by status
  const activeContracts = contracts.filter(contract => contract.status === 'active');
  const expiredContracts = contracts.filter(contract => contract.status === 'expired');
  const draftContracts = contracts.filter(contract => contract.status === 'draft');

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active':
        return <CheckCircle2 className="h-4 w-4" />;
      case 'expired':
        return <XCircle className="h-4 w-4" />;
      case 'draft':
        return <Clock className="h-4 w-4" />;
      default:
        return <AlertTriangle className="h-4 w-4" />;
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
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Posición</p>
                <p className="font-medium">{activeContracts[0].position}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Tipo</p>
                <Badge className={getContractTypeColor(activeContracts[0].type)}>
                  {getContractTypeLabel(activeContracts[0].type)}
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
                {activeContracts[0].renewalDate && (
                  <span className="ml-4">
                    Renovación: {format(new Date(activeContracts[0].renewalDate), 'dd MMM yyyy', { locale: es })}
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
                    <TableHead>Posición</TableHead>
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
                        <Badge className={getContractTypeColor(contract.type)}>
                          {getContractTypeLabel(contract.type)}
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
                        <div className="text-sm">
                          <div className="font-medium">{contract.position}</div>
                          <div className="text-muted-foreground">{contract.department}</div>
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
                        <Badge className={getStatusColor(contract.status)}>
                          {getStatusIcon(contract.status)}
                          <span className="ml-1 capitalize">{contract.status}</span>
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