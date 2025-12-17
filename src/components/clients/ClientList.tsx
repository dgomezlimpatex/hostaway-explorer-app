
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useClients, useDeleteClient } from '@/hooks/useClients';
import { Client } from '@/types/client';
import { Edit, Trash2, Users, Phone, Mail, MapPin } from 'lucide-react';
import { EditClientModal } from './EditClientModal';

const ServiceTypeBadge = ({ type }: { type: string }) => {
  const getServiceLabel = (type: string) => {
    switch (type) {
      case 'limpieza-mantenimiento': return 'Limpieza y Mantenimiento';
      case 'mantenimiento-cristaleria': return 'Mantenimiento Cristalería';
      case 'mantenimiento-airbnb': return 'Mantenimiento Airbnb';
      case 'limpieza-puesta-punto': return 'Limpieza Puesta a Punto';
      case 'limpieza-final-obra': return 'Limpieza Final de Obra';
      case 'check-in': return 'Check-in';
      case 'desplazamiento': return 'Desplazamiento';
      case 'limpieza-especial': return 'Limpieza Especial';
      case 'trabajo-extraordinario': return 'Trabajo Extraordinario';
      default: return type;
    }
  };

  const variants = {
    'limpieza-mantenimiento': 'bg-blue-100 text-blue-800',
    'mantenimiento-cristaleria': 'bg-green-100 text-green-800',
    'mantenimiento-airbnb': 'bg-purple-100 text-purple-800',
    'limpieza-puesta-punto': 'bg-orange-100 text-orange-800',
    'limpieza-final-obra': 'bg-red-100 text-red-800',
    'check-in': 'bg-yellow-100 text-yellow-800',
    'desplazamiento': 'bg-pink-100 text-pink-800',
    'limpieza-especial': 'bg-indigo-100 text-indigo-800',
    'trabajo-extraordinario': 'bg-teal-100 text-teal-800'
  };

  return (
    <Badge className={variants[type as keyof typeof variants] || 'bg-gray-100 text-gray-800'}>
      {getServiceLabel(type)}
    </Badge>
  );
};

const PaymentMethodBadge = ({ method }: { method: string }) => {
  const variants = {
    transferencia: 'bg-orange-100 text-orange-800',
    efectivo: 'bg-yellow-100 text-yellow-800',
    bizum: 'bg-pink-100 text-pink-800'
  };

  return (
    <Badge className={variants[method as keyof typeof variants] || variants.transferencia}>
      {method}
    </Badge>
  );
};

const ClientCard = ({ client }: { client: Client }) => {
  const deleteClient = useDeleteClient();

  const handleDelete = () => {
    if (window.confirm('¿Estás seguro de que quieres eliminar este cliente?')) {
      deleteClient.mutate(client.id);
    }
  };

  return (
    <Card className={`hover:shadow-lg transition-shadow ${client.isActive === false ? 'opacity-60' : ''}`}>
      <CardHeader className="pb-3">
        <div className="flex justify-between items-start">
          <div>
            <CardTitle className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              {client.nombre}
              {client.isActive === false && (
                <Badge variant="destructive" className="text-xs">
                  Inactivo
                </Badge>
              )}
            </CardTitle>
            <p className="text-sm text-gray-600 mt-1">
              {client.cifNif}
            </p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <ServiceTypeBadge type={client.tipoServicio} />
            {client.factura && (
              <Badge className="bg-green-100 text-green-800">
                📄 Factura
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Información de contacto */}
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <Phone className="h-4 w-4" />
            {client.telefono}
          </div>
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <Mail className="h-4 w-4" />
            {client.email}
          </div>
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <MapPin className="h-4 w-4" />
            {client.ciudad}
          </div>
        </div>

        {/* Información de servicio */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-gray-500" />
            <span className="text-sm text-gray-600">
              Supervisor: {client.supervisor}
            </span>
          </div>
          <PaymentMethodBadge method={client.metodoPago} />
        </div>

        {/* Direccion */}
        <div className="text-xs text-gray-500 border-t pt-2">
          <p>{client.direccionFacturacion}</p>
          <p>{client.codigoPostal} - {client.ciudad}</p>
        </div>

        {/* Acciones */}
        <div className="flex justify-end gap-2 pt-2">
          <EditClientModal
            client={client}
            trigger={
              <Button
                variant="outline"
                size="sm"
                className="flex items-center gap-1"
              >
                <Edit className="h-3 w-3" />
                Editar
              </Button>
            }
          />
          <Button
            variant="outline"
            size="sm"
            onClick={handleDelete}
            disabled={deleteClient.isPending}
            className="flex items-center gap-1 text-red-600 hover:text-red-700"
          >
            <Trash2 className="h-3 w-3" />
            Eliminar
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export const ClientList = () => {
  const { data: clients, isLoading, error } = useClients();

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-32">
        <div className="text-gray-500">Cargando clientes...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center text-red-600 p-4">
        Error al cargar los clientes
      </div>
    );
  }

  if (!clients || clients.length === 0) {
    return (
      <div className="text-center text-gray-500 p-8">
        <Users className="h-12 w-12 mx-auto mb-4 text-gray-300" />
        <p>No hay clientes registrados</p>
        <p className="text-sm">Crea tu primer cliente para comenzar</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {clients.map((client) => (
        <ClientCard key={client.id} client={client} />
      ))}
    </div>
  );
};
