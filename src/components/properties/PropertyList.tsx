
import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useProperties, useDeleteProperty } from '@/hooks/useProperties';
import { useClients } from '@/hooks/useClients';
import { Property } from '@/types/property';
import { Edit, Trash2, Home, MapPin, Bed, Bath, Clock, Euro } from 'lucide-react';
import { EditPropertyModal } from './EditPropertyModal';

const PropertyCard = ({ property }: { property: Property }) => {
  const [editModalOpen, setEditModalOpen] = useState(false);
  const deleteProperty = useDeleteProperty();
  const { data: clients } = useClients();
  
  const client = clients?.find(c => c.id === property.clienteId);

  const handleDelete = () => {
    if (window.confirm('¿Estás seguro de que quieres eliminar esta propiedad?')) {
      deleteProperty.mutate(property.id);
    }
  };

  return (
    <>
      <Card className="hover:shadow-lg transition-shadow">
        <CardHeader className="pb-3">
          <div className="flex justify-between items-start">
            <div>
              <CardTitle className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <Home className="h-5 w-5" />
                {property.nombre}
              </CardTitle>
              <div className="flex items-center gap-2 mt-1">
                <Badge variant="outline" className="text-sm">
                  {property.codigo}
                </Badge>
                {client && (
                  <Badge className="bg-blue-100 text-blue-800">
                    {client.nombre}
                  </Badge>
                )}
              </div>
            </div>
          </div>
        </CardHeader>
        
        <CardContent className="space-y-4">
          {/* Dirección */}
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <MapPin className="h-4 w-4" />
            {property.direccion}
          </div>

          {/* Características */}
          <div className="grid grid-cols-2 gap-4">
            <div className="flex items-center gap-2 text-sm">
              <Bed className="h-4 w-4 text-gray-500" />
              <span>{property.numeroCamas} cama{property.numeroCamas !== 1 ? 's' : ''}</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <Bath className="h-4 w-4 text-gray-500" />
              <span>{property.numeroBanos} baño{property.numeroBanos !== 1 ? 's' : ''}</span>
            </div>
          </div>

          {/* Servicio */}
          <div className="grid grid-cols-2 gap-4 pt-2 border-t">
            <div className="flex items-center gap-2 text-sm">
              <Clock className="h-4 w-4 text-gray-500" />
              <span>{property.duracionServicio} min</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <Euro className="h-4 w-4 text-gray-500" />
              <span>{property.costeServicio}€</span>
            </div>
          </div>

          {/* Apartado téxtil */}
          <div className="bg-gray-50 p-3 rounded-lg">
            <h4 className="text-sm font-medium text-gray-700 mb-2">🧺 Textil</h4>
            <div className="grid grid-cols-2 gap-2 text-xs text-gray-600">
              <div>Sábanas: {property.numeroSabanas}</div>
              <div>Toallas G: {property.numeroToallasGrandes}</div>
              <div>Toallas P: {property.numeroTotallasPequenas}</div>
              <div>Alfombrines: {property.numeroAlfombrines}</div>
              <div>Fundas: {property.numeroFundasAlmohada}</div>
            </div>
          </div>

          {/* Acciones */}
          <div className="flex justify-end gap-2 pt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setEditModalOpen(true)}
              className="flex items-center gap-1"
            >
              <Edit className="h-3 w-3" />
              Editar
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleDelete}
              disabled={deleteProperty.isPending}
              className="flex items-center gap-1 text-red-600 hover:text-red-700"
            >
              <Trash2 className="h-3 w-3" />
              Eliminar
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Modal de edición */}
      <EditPropertyModal
        property={property}
        open={editModalOpen}
        onOpenChange={setEditModalOpen}
      />
    </>
  );
};

export const PropertyList = () => {
  const { data: properties, isLoading, error } = useProperties();

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-32">
        <div className="text-gray-500">Cargando propiedades...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center text-red-600 p-4">
        Error al cargar las propiedades
      </div>
    );
  }

  if (!properties || properties.length === 0) {
    return (
      <div className="text-center text-gray-500 p-8">
        <Home className="h-12 w-12 mx-auto mb-4 text-gray-300" />
        <p>No hay propiedades registradas</p>
        <p className="text-sm">Crea tu primera propiedad para comenzar</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {properties.map((property) => (
        <PropertyCard key={property.id} property={property} />
      ))}
    </div>
  );
};
