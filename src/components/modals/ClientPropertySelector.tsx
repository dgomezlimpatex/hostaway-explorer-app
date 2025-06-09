
import { useState, useEffect } from 'react';
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useClients } from '@/hooks/useClients';
import { usePropertiesByClient } from '@/hooks/useProperties';
import { Client } from '@/types/client';
import { Property } from '@/types/property';

interface ClientPropertySelectorProps {
  onClientChange: (client: Client | null) => void;
  onPropertyChange: (property: Property | null) => void;
  selectedClientId?: string;
  selectedPropertyId?: string;
}

export const ClientPropertySelector = ({
  onClientChange,
  onPropertyChange,
  selectedClientId = '',
  selectedPropertyId = ''
}: ClientPropertySelectorProps) => {
  const [clientId, setClientId] = useState(selectedClientId);
  const [propertyId, setPropertyId] = useState(selectedPropertyId);
  const { data: clients = [] } = useClients();
  const { data: properties = [] } = usePropertiesByClient(clientId);

  useEffect(() => {
    const selectedClient = clients.find(c => c.id === clientId);
    onClientChange(selectedClient || null);
  }, [clientId, clients, onClientChange]);

  useEffect(() => {
    const selectedProperty = properties.find(p => p.id === propertyId);
    onPropertyChange(selectedProperty || null);
  }, [propertyId, properties, onPropertyChange]);

  const handleClientChange = (value: string) => {
    setClientId(value);
    setPropertyId(''); // Reset property selection when client changes
    onPropertyChange(null);
  };

  const handlePropertyChange = (value: string) => {
    setPropertyId(value);
    const selectedProperty = properties.find(p => p.id === value);
    onPropertyChange(selectedProperty || null);
  };

  return (
    <div className="grid grid-cols-2 gap-4">
      <div className="space-y-2">
        <Label htmlFor="cliente">Cliente *</Label>
        <Select value={clientId} onValueChange={handleClientChange}>
          <SelectTrigger>
            <SelectValue placeholder="Seleccionar cliente" />
          </SelectTrigger>
          <SelectContent>
            {clients.map((client) => (
              <SelectItem key={client.id} value={client.id}>
                {client.nombre}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="propiedad">Propiedad *</Label>
        <Select 
          value={propertyId} 
          onValueChange={handlePropertyChange}
          disabled={!clientId}
        >
          <SelectTrigger>
            <SelectValue placeholder={clientId ? "Seleccionar propiedad" : "Primero selecciona un cliente"} />
          </SelectTrigger>
          <SelectContent>
            {properties.map((property) => (
              <SelectItem key={property.id} value={property.id}>
                {property.codigo} - {property.nombre}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
};
