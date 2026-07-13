
import { useState } from 'react';
import { PropertyCleaningScheduleItem, useProperties, useDeleteProperty, useCreateProperty, usePropertyCleaningSchedule } from '@/hooks/useProperties';
import { useClientData } from '@/hooks/useClientData';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { EditPropertyModal } from './EditPropertyModal';
import { AssignChecklistModal } from './AssignChecklistModal';
import { PropertyChecklistInfo } from './PropertyChecklistInfo';
import { Property } from '@/types/property';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  Edit, 
  Trash2, 
  MapPin, 
  Clock, 
  CheckSquare,
  ChevronDown,
  ChevronRight,
  User,
  Building,
  Copy,
  CalendarDays
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface PropertyListProps {
  searchTerm?: string;
}

const formatCleaningDate = (item?: PropertyCleaningScheduleItem | null) => {
  if (!item?.date) return '—';
  const [year, month, day] = item.date.split('-');
  const formattedDate = `${day}/${month}/${year}`;
  return item.startTime ? `${formattedDate} · ${item.startTime.slice(0, 5)}` : formattedDate;
};

const formatCapacity = (property: Property) => {
  const totalBeds =
    (property.numeroCamas || 0) +
    (property.numeroCamasPequenas || 0) +
    (property.numeroCamasSuite || 0) +
    (property.numeroSofasCama || 0);
  const bathrooms = property.numeroBanos || 0;
  return `${totalBeds} cama${totalBeds !== 1 ? 's' : ''} · ${bathrooms} baño${bathrooms !== 1 ? 's' : ''}`;
};

const formatServiceDuration = (minutes?: number | null) => {
  const totalMinutes = minutes || 0;
  if (totalMinutes === 0) return '0 h';
  const hours = totalMinutes / 60;
  return `${Number.isInteger(hours) ? hours.toString() : hours.toFixed(1).replace('.', ',')} h`;
};


interface ClientPropertiesPanelProps {
  properties: Property[];
  clients: Array<{ id: string; isActive?: boolean | null }>;
  setAssigningProperty: (property: Property) => void;
  setEditingProperty: (property: Property) => void;
  handleDuplicate: (property: Property) => void;
  handleDelete: (propertyId: string) => void;
}

const PropertyActions = ({
  property,
  setAssigningProperty,
  setEditingProperty,
  handleDuplicate,
  handleDelete,
}: Omit<ClientPropertiesPanelProps, 'properties' | 'clients'> & { property: Property }) => (
  <div className="flex justify-end gap-1">
    <Button variant="outline" size="sm" onClick={() => setAssigningProperty(property)} className="h-8 px-2">
      <CheckSquare className="h-3.5 w-3.5 lg:mr-1" />
      <span className="hidden lg:inline text-xs">Checklist</span>
    </Button>
    <Button variant="outline" size="sm" onClick={() => handleDuplicate(property)} title="Duplicar" className="h-8 px-2"><Copy className="h-3.5 w-3.5" /></Button>
    <Button variant="outline" size="sm" onClick={() => setEditingProperty(property)} title="Editar" className="h-8 px-2"><Edit className="h-3.5 w-3.5" /></Button>
    <AlertDialog>
      <AlertDialogTrigger asChild><Button variant="outline" size="sm" title="Eliminar" className="h-8 px-2 text-red-600 hover:text-red-700"><Trash2 className="h-3.5 w-3.5" /></Button></AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>¿Estás seguro?</AlertDialogTitle>
          <AlertDialogDescription>Esta acción no se puede deshacer. Se eliminará permanentemente la propiedad "{property.nombre}".</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction onClick={() => handleDelete(property.id)} className="bg-red-600 hover:bg-red-700">Eliminar</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </div>
);

const ClientPropertiesPanel = ({ properties, clients, ...actionProps }: ClientPropertiesPanelProps) => {
  const propertyIds = properties.map((property) => property.id);
  const { data: scheduleByProperty = {}, isLoading: isScheduleLoading, isError: hasScheduleError } = usePropertyCleaningSchedule(propertyIds);
  const isPropertyActive = (property: Property) => {
    const client = clients.find(c => c.id === property.clienteId);
    const clientIsActive = client?.isActive !== false;
    return property.isActive !== null ? property.isActive : clientIsActive;
  };
  const getLastCleaning = (propertyId: string) => isScheduleLoading ? 'Cargando…' : hasScheduleError ? '—' : formatCleaningDate(scheduleByProperty[propertyId]?.lastCleaning);
  const getNextCleaning = (propertyId: string) => isScheduleLoading ? 'Cargando…' : hasScheduleError ? '—' : formatCleaningDate(scheduleByProperty[propertyId]?.nextCleaning);

  return (
    <div className="space-y-4">
      {hasScheduleError && <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">No se pudieron cargar las fechas de limpieza. Se muestran como “—”.</div>}
      <div className="hidden lg:block rounded-lg border overflow-hidden">
        <Table className="table-fixed min-w-[1240px]">
          <TableHeader>
            <TableRow className="bg-muted/40">
              <TableHead className="w-[80px] px-2">Código</TableHead>
              <TableHead className="w-[260px] px-2">Nombre comercial</TableHead>
              <TableHead className="w-[300px] px-2">Dirección</TableHead>
              <TableHead className="w-[85px] px-2">Duración</TableHead>
              <TableHead className="w-[300px] px-2">Checklist</TableHead>
              <TableHead className="w-[120px] px-2">Última limpieza</TableHead>
              <TableHead className="w-[120px] px-2">Próxima limpieza</TableHead>
              <TableHead className="sticky right-0 z-20 w-[220px] bg-muted/95 px-2 text-right shadow-[-12px_0_18px_-18px_rgba(15,23,42,0.75)]">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {properties.map((property) => {
              const isEffectivelyActive = isPropertyActive(property);
              return (
                <TableRow key={property.id} className={!isEffectivelyActive ? 'opacity-60' : undefined}>
                  <TableCell className="px-2 py-3 align-top"><Badge variant="secondary" className="text-xs">{property.codigo || '—'}</Badge></TableCell>
                  <TableCell className="px-2 py-3 align-top"><div className="font-medium truncate" title={property.nombre}>{property.nombre}</div></TableCell>
                  <TableCell className="px-2 py-3 align-top"><div className="flex items-start gap-1.5 text-sm text-muted-foreground"><MapPin className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" /><span className="line-clamp-2" title={property.direccion}>{property.direccion || '—'}</span></div></TableCell>
                  <TableCell className="px-2 py-3 align-top text-sm"><div className="flex items-center gap-1.5"><Clock className="h-3.5 w-3.5 text-muted-foreground" /><span>{formatServiceDuration(property.duracionServicio)}</span></div></TableCell>
                  <TableCell className="px-2 py-3 align-top"><PropertyChecklistInfo propertyId={property.id} /></TableCell>
                  <TableCell className="px-2 py-3 align-top text-sm text-muted-foreground">{getLastCleaning(property.id)}</TableCell>
                  <TableCell className="px-2 py-3 align-top text-sm text-muted-foreground">{getNextCleaning(property.id)}</TableCell>
                  <TableCell className="sticky right-0 z-10 bg-background px-2 py-3 align-top text-right shadow-[-12px_0_18px_-18px_rgba(15,23,42,0.75)]"><PropertyActions property={property} {...actionProps} /></TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
      <div className="space-y-3 lg:hidden">
        {properties.map((property) => <Card key={property.id} className={`border-l-4 ${isPropertyActive(property) ? 'border-l-green-500' : 'border-l-red-500 opacity-60'}`}><CardHeader className="pb-3 px-3"><CardTitle className="text-base truncate">{property.nombre}</CardTitle><CardDescription>{property.codigo || '—'} · {property.direccion || '—'}</CardDescription></CardHeader><CardContent className="space-y-3 px-3"><div className="grid grid-cols-2 gap-3 text-sm"><div><p className="text-xs text-muted-foreground">Tiempo estimado</p><p className="font-medium">{formatServiceDuration(property.duracionServicio)}</p></div><div><p className="text-xs text-muted-foreground">Capacidad</p><p className="font-medium">{formatCapacity(property)}</p></div><div><p className="text-xs text-muted-foreground">Última limpieza</p><p className="font-medium">{getLastCleaning(property.id)}</p></div><div><p className="text-xs text-muted-foreground">Próxima limpieza</p><p className="font-medium">{getNextCleaning(property.id)}</p></div></div><div className="pt-2 border-t border-gray-100"><PropertyChecklistInfo propertyId={property.id} /></div><PropertyActions property={property} {...actionProps} /></CardContent></Card>)}
      </div>
    </div>
  );
};

export const PropertyList = ({ searchTerm = '' }: PropertyListProps) => {
  const { data: allProperties = [], isLoading } = useProperties();
  const { clients, getClientName } = useClientData();
  const deleteProperty = useDeleteProperty();
  const createProperty = useCreateProperty();
  const [editingProperty, setEditingProperty] = useState<Property | null>(null);
  const [assigningProperty, setAssigningProperty] = useState<Property | null>(null);
  const [openClients, setOpenClients] = useState<Set<string>>(new Set());
  const { toast } = useToast();

  const normalizedSearch = searchTerm.toLowerCase().trim();
  const properties = normalizedSearch
    ? allProperties.filter((p) => {
        const clientName = getClientName(p.clienteId)?.toLowerCase() || '';
        return (
          p.nombre.toLowerCase().includes(normalizedSearch) ||
          p.codigo.toLowerCase().includes(normalizedSearch) ||
          p.direccion.toLowerCase().includes(normalizedSearch) ||
          clientName.includes(normalizedSearch)
        );
      })
    : allProperties;

  const handleDelete = async (id: string) => {
    try {
      await deleteProperty.mutateAsync(id);
    } catch (error) {
      console.error('Error deleting property:', error);
    }
  };

  const handleDuplicate = async (property: Property) => {
    try {
      const duplicatedData = {
        codigo: property.codigo ? `${property.codigo}-copia` : '',
        nombre: `${property.nombre} (copia)`,
        direccion: property.direccion,
        numeroCamas: property.numeroCamas,
        numeroCamasPequenas: property.numeroCamasPequenas,
        numeroCamasSuite: property.numeroCamasSuite,
        numeroSofasCama: property.numeroSofasCama,
        numeroBanos: property.numeroBanos,
        numeroCocinas: property.numeroCocinas ?? 1,
        duracionServicio: property.duracionServicio,
        costeServicio: property.costeServicio,
        checkInPredeterminado: property.checkInPredeterminado,
        checkOutPredeterminado: property.checkOutPredeterminado,
        numeroSabanas: property.numeroSabanas,
        numeroSabanasRequenas: property.numeroSabanasRequenas,
        numeroSabanasSuite: property.numeroSabanasSuite,
        numeroToallasGrandes: property.numeroToallasGrandes,
        numeroTotallasPequenas: property.numeroTotallasPequenas,
        numeroAlfombrines: property.numeroAlfombrines,
        numeroFundasAlmohada: property.numeroFundasAlmohada,
        kitAlimentario: property.kitAlimentario,
        amenitiesBano: property.amenitiesBano,
        amenitiesCocina: property.amenitiesCocina,
        cantidadRollosPapelHigienico: property.cantidadRollosPapelHigienico,
        cantidadRollosPapelCocina: property.cantidadRollosPapelCocina,
        bayetasCocina: property.bayetasCocina,
        bolsasBasura: property.bolsasBasura,
        notas: property.notas,
        clienteId: property.clienteId,
      };
      await createProperty.mutateAsync(duplicatedData);
      toast({
        title: "Propiedad duplicada",
        description: `Se ha creado una copia de "${property.nombre}"`,
      });
    } catch (error) {
      console.error('Error duplicating property:', error);
    }
  };

  const toggleClient = (clientId: string) => {
    const newOpenClients = new Set(openClients);
    if (newOpenClients.has(clientId)) {
      newOpenClients.delete(clientId);
    } else {
      newOpenClients.add(clientId);
    }
    setOpenClients(newOpenClients);
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <Card key={i}>
            <CardHeader>
              <Skeleton className="h-6 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-full" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (properties.length === 0) {
    return (
      <div className="text-center py-12">
        <Building className="h-12 w-12 mx-auto text-gray-400 mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">
          No hay propiedades registradas
        </h3>
        <p className="text-gray-500">
          Comienza agregando tu primera propiedad
        </p>
      </div>
    );
  }

  // Group properties by client
  const propertiesByClient = properties.reduce((acc, property) => {
    const clientId = property.clienteId || 'sin-cliente';
    if (!acc[clientId]) {
      acc[clientId] = [];
    }
    acc[clientId].push(property);
    return acc;
  }, {} as Record<string, Property[]>);

  // Sort properties alphabetically within each client
  Object.keys(propertiesByClient).forEach(clientId => {
    propertiesByClient[clientId].sort((a, b) => a.nombre.localeCompare(b.nombre));
  });

  return (
    <>
      <div className="space-y-6">
        {Object.entries(propertiesByClient).map(([clientId, clientProperties]) => {
          const clientName = clientId === 'sin-cliente' ? 'Sin Cliente Asignado' : getClientName(clientId);
          const isOpen = openClients.has(clientId);
          
          return (
            <Card key={clientId} className="overflow-hidden">
              <Collapsible open={isOpen} onOpenChange={() => toggleClient(clientId)}>
                <CollapsibleTrigger asChild>
                  <CardHeader className="cursor-pointer hover:bg-gray-50 transition-colors">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <User className="h-5 w-5 text-blue-600" />
                        <div>
                          <CardTitle className="text-lg">
                            {clientName || `Cliente ${clientId}`}
                          </CardTitle>
                          <CardDescription>
                            {(() => {
                              const client = clients.find(c => c.id === clientId);
                              const clientIsActive = client?.isActive !== false;
                              const activeCount = clientProperties.filter(p => 
                                p.isActive !== null ? p.isActive : clientIsActive
                              ).length;
                              return `${clientProperties.length} propiedad${clientProperties.length !== 1 ? 'es' : ''} · ${activeCount} activa${activeCount !== 1 ? 's' : ''}`;
                            })()}
                          </CardDescription>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="bg-blue-50 text-blue-700">
                          {clientProperties.length}
                        </Badge>
                        {isOpen ? (
                          <ChevronDown className="h-4 w-4" />
                        ) : (
                          <ChevronRight className="h-4 w-4" />
                        )}
                      </div>
                    </div>
                  </CardHeader>
                </CollapsibleTrigger>
                
                <CollapsibleContent>
                  <CardContent className="pt-0">
                    <div className="mb-3 flex items-center gap-2 text-sm text-muted-foreground">
                      <CalendarDays className="h-4 w-4" />
                      Vista operativa: planificación, capacidad y checklist por propiedad.
                    </div>
                    <ClientPropertiesPanel
                      properties={clientProperties}
                      clients={clients}
                      setAssigningProperty={setAssigningProperty}
                      setEditingProperty={setEditingProperty}
                      handleDuplicate={handleDuplicate}
                      handleDelete={handleDelete}
                    />
                  </CardContent>
                </CollapsibleContent>
              </Collapsible>
            </Card>
          );
        })}
      </div>

      <EditPropertyModal
        property={editingProperty}
        open={!!editingProperty}
        onOpenChange={(open) => !open && setEditingProperty(null)}
      />

      <AssignChecklistModal
        property={assigningProperty}
        open={!!assigningProperty}
        onOpenChange={(open) => !open && setAssigningProperty(null)}
      />
    </>
  );
};
