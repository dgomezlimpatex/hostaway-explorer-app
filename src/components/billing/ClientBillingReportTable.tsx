
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { ChevronDown, ChevronRight, Download, Building2, MapPin, Euro, CalendarDays } from 'lucide-react';
import { ClientBillingReport, PropertyBillingDetail } from '@/types/reports';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface ClientBillingReportTableProps {
  data: ClientBillingReport[];
  onExportClient: (client: ClientBillingReport) => void;
}

const PropertySection = ({ property }: { property: PropertyBillingDetail }) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger asChild>
        <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg cursor-pointer hover:bg-muted transition-colors">
          <div className="flex items-center gap-3">
            <div className="p-1.5 bg-primary/10 rounded">
              {isOpen ? (
                <ChevronDown className="h-4 w-4 text-primary" />
              ) : (
                <ChevronRight className="h-4 w-4 text-primary" />
              )}
            </div>
            <MapPin className="h-4 w-4 text-muted-foreground" />
            <div>
              <span className="font-medium">{property.propertyName}</span>
              <span className="text-sm text-muted-foreground ml-2">({property.propertyCode})</span>
            </div>
          </div>
          <div className="flex items-center gap-4 text-sm">
            <Badge variant="secondary">{property.totalCleanings} limpiezas</Badge>
            <span className="font-semibold text-green-600">€{property.totalCost.toFixed(2)}</span>
          </div>
        </div>
      </CollapsibleTrigger>
      <CollapsibleContent className="mt-2 ml-8">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Fecha</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Check-in</TableHead>
              <TableHead>Check-out</TableHead>
              <TableHead>Duración</TableHead>
              <TableHead>Trabajador</TableHead>
              <TableHead className="text-right">Coste</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {property.tasks.map((task) => (
              <TableRow key={task.taskId}>
                <TableCell>
                  {format(new Date(task.date), 'dd/MM/yyyy', { locale: es })}
                </TableCell>
                <TableCell>{task.type}</TableCell>
                <TableCell>{task.checkIn || '-'}</TableCell>
                <TableCell>{task.checkOut || '-'}</TableCell>
                <TableCell>{task.duration} min</TableCell>
                <TableCell>{task.cleaner}</TableCell>
                <TableCell className="text-right font-medium">€{task.cost.toFixed(2)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CollapsibleContent>
    </Collapsible>
  );
};

const ClientSection = ({ 
  client, 
  onExport 
}: { 
  client: ClientBillingReport;
  onExport: () => void;
}) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <Card className="overflow-hidden">
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer hover:bg-muted/30 transition-colors">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-primary/10 rounded-lg">
                  {isOpen ? (
                    <ChevronDown className="h-5 w-5 text-primary" />
                  ) : (
                    <ChevronRight className="h-5 w-5 text-primary" />
                  )}
                </div>
                <Building2 className="h-5 w-5 text-muted-foreground" />
                <div>
                  <CardTitle className="text-lg">{client.clientName}</CardTitle>
                  <p className="text-sm text-muted-foreground">
                    CIF/NIF: {client.cifNif || 'N/A'} | {client.metodoPago || 'Sin método de pago'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="text-right">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <CalendarDays className="h-4 w-4" />
                    <span>{client.totalServices} servicios</span>
                  </div>
                  <div className="flex items-center gap-2 text-lg font-bold text-green-600">
                    <Euro className="h-4 w-4" />
                    <span>{client.totalCost.toFixed(2)}</span>
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    onExport();
                  }}
                >
                  <Download className="h-4 w-4 mr-1" />
                  CSV
                </Button>
              </div>
            </div>
          </CardHeader>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="space-y-3 pt-0">
            {client.properties.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                No hay propiedades con servicios completados
              </p>
            ) : (
              client.properties.map((property) => (
                <PropertySection key={property.propertyId} property={property} />
              ))
            )}
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
};

export const ClientBillingReportTable = ({ data, onExportClient }: ClientBillingReportTableProps) => {
  if (data.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <Building2 className="h-12 w-12 text-muted-foreground mb-4" />
          <p className="text-lg font-medium text-muted-foreground">
            No hay datos de facturación para el período seleccionado
          </p>
          <p className="text-sm text-muted-foreground">
            Ajusta los filtros para ver resultados
          </p>
        </CardContent>
      </Card>
    );
  }

  // Calculate totals
  const totalServices = data.reduce((sum, c) => sum + c.totalServices, 0);
  const totalAmount = data.reduce((sum, c) => sum + c.totalCost, 0);

  return (
    <div className="space-y-4">
      {/* Summary Card */}
      <Card className="bg-gradient-to-r from-primary/5 to-primary/10 border-primary/20">
        <CardContent className="py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-6">
              <div>
                <p className="text-sm text-muted-foreground">Clientes</p>
                <p className="text-2xl font-bold">{data.length}</p>
              </div>
              <div className="h-10 w-px bg-border" />
              <div>
                <p className="text-sm text-muted-foreground">Total Servicios</p>
                <p className="text-2xl font-bold">{totalServices}</p>
              </div>
              <div className="h-10 w-px bg-border" />
              <div>
                <p className="text-sm text-muted-foreground">Total Facturación</p>
                <p className="text-2xl font-bold text-green-600">€{totalAmount.toFixed(2)}</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Client Cards */}
      {data.map((client) => (
        <ClientSection 
          key={client.clientId} 
          client={client} 
          onExport={() => onExportClient(client)}
        />
      ))}
    </div>
  );
};
