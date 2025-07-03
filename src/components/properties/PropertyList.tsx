
import { useState } from 'react';
import { useProperties, useDeleteProperty } from '@/hooks/useProperties';
import { useClientData } from '@/hooks/useClientData';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { EditPropertyModal } from './EditPropertyModal';
import { AssignChecklistModal } from './AssignChecklistModal';
import { Property } from '@/types/property';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  Edit, 
  Trash2, 
  MapPin, 
  Bed, 
  Bath, 
  Clock, 
  Euro,
  FileText,
  CheckSquare,
  ChevronDown,
  ChevronRight,
  User,
  Building
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

export const PropertyList = () => {
  const { data: properties = [], isLoading } = useProperties();
  const { clients, getClientName } = useClientData();
  const deleteProperty = useDeleteProperty();
  const [editingProperty, setEditingProperty] = useState<Property | null>(null);
  const [assigningProperty, setAssigningProperty] = useState<Property | null>(null);
  const [openClients, setOpenClients] = useState<Set<string>>(new Set());
  const { toast } = useToast();

  const handleDelete = async (id: string) => {
    try {
      await deleteProperty.mutateAsync(id);
    } catch (error) {
      console.error('Error deleting property:', error);
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
                            {clientProperties.length} propiedad{clientProperties.length !== 1 ? 'es' : ''}
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
                    <div className="space-y-4">
                      {clientProperties.map((property: Property) => (
                        <Card key={property.id} className="border-l-4 border-l-green-500 hover:shadow-md transition-shadow">
                          <CardHeader className="pb-3">
                            <div className="flex justify-between items-start">
                              <div>
                                <CardTitle className="text-lg">
                                  {property.nombre}
                                </CardTitle>
                                <CardDescription className="flex items-center gap-2 mt-1">
                                  <Badge variant="secondary">{property.codigo}</Badge>
                                  <div className="flex items-center gap-1 text-sm text-gray-500">
                                    <MapPin className="h-3 w-3" />
                                    {property.direccion}
                                  </div>
                                </CardDescription>
                              </div>
                              <div className="flex gap-2">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => setAssigningProperty(property)}
                                  className="flex items-center gap-1"
                                >
                                  <CheckSquare className="h-4 w-4" />
                                  Checklist
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => setEditingProperty(property)}
                                >
                                  <Edit className="h-4 w-4" />
                                </Button>
                                <AlertDialog>
                                  <AlertDialogTrigger asChild>
                                    <Button variant="outline" size="sm">
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </AlertDialogTrigger>
                                  <AlertDialogContent>
                                    <AlertDialogHeader>
                                      <AlertDialogTitle>¿Estás seguro?</AlertDialogTitle>
                                      <AlertDialogDescription>
                                        Esta acción no se puede deshacer. Se eliminará permanentemente
                                        la propiedad "{property.nombre}".
                                      </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                      <AlertDialogAction 
                                        onClick={() => handleDelete(property.id)}
                                        className="bg-red-600 hover:bg-red-700"
                                      >
                                        Eliminar
                                      </AlertDialogAction>
                                    </AlertDialogFooter>
                                  </AlertDialogContent>
                                </AlertDialog>
                              </div>
                            </div>
                          </CardHeader>
                          <CardContent>
                            <div className="space-y-3">
                              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                                <div className="flex items-center gap-2">
                                  <Bed className="h-4 w-4 text-gray-500" />
                                  <span>{property.numeroCamas} camas</span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <Bath className="h-4 w-4 text-gray-500" />
                                  <span>{property.numeroBanos} baños</span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <Clock className="h-4 w-4 text-gray-500" />
                                  <span>{property.duracionServicio} min</span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <Euro className="h-4 w-4 text-gray-500" />
                                  <span>€{property.costeServicio}</span>
                                </div>
                              </div>

                              {property.notas && (
                                <div className="bg-gray-50 p-3 rounded-lg">
                                  <div className="flex items-start gap-2">
                                    <FileText className="h-4 w-4 text-gray-500 mt-0.5" />
                                    <p className="text-sm text-gray-700">{property.notas}</p>
                                  </div>
                                </div>
                              )}
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
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
