
import { useState, useEffect } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { useClients } from '@/hooks/useClients';
import { useProperties } from '@/hooks/useProperties';

interface ClientPropertySelectorProps {
  onClientChange: (client: any) => void;
  onPropertyChange: (property: any) => void;
  showPropertySelector?: boolean;
  selectedClientId?: string;
  selectedPropertyId?: string;
}

export const ClientPropertySelector = ({ 
  onClientChange, 
  onPropertyChange, 
  showPropertySelector = true,
  selectedClientId: externalSelectedClientId,
  selectedPropertyId: externalSelectedPropertyId
}: ClientPropertySelectorProps) => {
  const [internalSelectedClientId, setInternalSelectedClientId] = useState<string>('');
  const [internalSelectedPropertyId, setInternalSelectedPropertyId] = useState<string>('');
  
  const { data: clients = [], isLoading: clientsLoading } = useClients();
  const { data: properties = [], isLoading: propertiesLoading } = useProperties();

  // Use external props if provided, otherwise use internal state
  const selectedClientId = externalSelectedClientId !== undefined ? externalSelectedClientId : internalSelectedClientId;
  const selectedPropertyId = externalSelectedPropertyId !== undefined ? externalSelectedPropertyId : internalSelectedPropertyId;

  // Convert empty strings to undefined for Select component
  const clientSelectValue = selectedClientId || undefined;
  const propertySelectValue = selectedPropertyId || undefined;

  // Filter and sort properties by selected client
  const availableProperties = selectedClientId 
    ? properties
        .filter(property => property.clienteId === selectedClientId)
        .sort((a, b) => a.nombre.localeCompare(b.nombre))
    : [];

  // Sort clients alphabetically
  const sortedClients = clients.sort((a, b) => a.nombre.localeCompare(b.nombre));

  const handleClientSelect = (clientId: string) => {
    if (!clientId) return;
    
    if (externalSelectedClientId === undefined) {
      setInternalSelectedClientId(clientId);
    }
    if (externalSelectedPropertyId === undefined) {
      setInternalSelectedPropertyId(''); // Reset property selection
    }
    
    const client = clients.find(c => c.id === clientId);
    if (client) {
      onClientChange(client);
      
      if (showPropertySelector) {
        onPropertyChange(null); // Reset property in parent
      }
    }
  };

  const handlePropertySelect = (propertyId: string) => {
    if (!propertyId) return;
    
    if (externalSelectedPropertyId === undefined) {
      setInternalSelectedPropertyId(propertyId);
    }
    const property = properties.find(p => p.id === propertyId);
    if (property) {
      onPropertyChange(property);
    }
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="client">Cliente</Label>
        <Select value={clientSelectValue} onValueChange={handleClientSelect}>
          <SelectTrigger>
            <SelectValue placeholder={clientsLoading ? "Cargando..." : "Selecciona un cliente"} />
          </SelectTrigger>
          <SelectContent>
            {sortedClients.map((client) => (
              <SelectItem key={client.id} value={client.id}>
                {client.nombre}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {showPropertySelector && (
        <div className="space-y-2">
          <Label htmlFor="property">Propiedad</Label>
          <Select 
            value={propertySelectValue} 
            onValueChange={handlePropertySelect}
            disabled={!selectedClientId || propertiesLoading}
          >
            <SelectTrigger>
              <SelectValue placeholder={
                propertiesLoading ? "Cargando..." :
                selectedClientId ? "Selecciona una propiedad" : "Primero selecciona un cliente"
              } />
            </SelectTrigger>
            <SelectContent>
              {availableProperties.map((property) => (
                <SelectItem key={property.id} value={property.id}>
                  {property.codigo} - {property.nombre}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
    </div>
  );
};
