
import { useState, useEffect } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { useClients } from '@/hooks/useClients';
import { useProperties } from '@/hooks/useProperties';

interface ClientPropertySelectorProps {
  onClientChange: (client: any) => void;
  onPropertyChange: (property: any) => void;
  showPropertySelector?: boolean;
}

export const ClientPropertySelector = ({ 
  onClientChange, 
  onPropertyChange, 
  showPropertySelector = true 
}: ClientPropertySelectorProps) => {
  const [selectedClientId, setSelectedClientId] = useState<string>('');
  const [selectedPropertyId, setSelectedPropertyId] = useState<string>('');
  
  const { data: clients = [] } = useClients();
  const { data: properties = [] } = useProperties();

  // Filter properties by selected client
  const availableProperties = selectedClientId 
    ? properties.filter(property => property.clienteId === selectedClientId)
    : [];

  const handleClientSelect = (clientId: string) => {
    setSelectedClientId(clientId);
    setSelectedPropertyId(''); // Reset property selection
    
    const client = clients.find(c => c.id === clientId);
    onClientChange(client || null);
    
    if (showPropertySelector) {
      onPropertyChange(null); // Reset property in parent
    }
  };

  const handlePropertySelect = (propertyId: string) => {
    setSelectedPropertyId(propertyId);
    const property = properties.find(p => p.id === propertyId);
    onPropertyChange(property || null);
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="client">Cliente</Label>
        <Select value={selectedClientId} onValueChange={handleClientSelect}>
          <SelectTrigger>
            <SelectValue placeholder="Selecciona un cliente" />
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

      {showPropertySelector && (
        <div className="space-y-2">
          <Label htmlFor="property">Propiedad</Label>
          <Select 
            value={selectedPropertyId} 
            onValueChange={handlePropertySelect}
            disabled={!selectedClientId}
          >
            <SelectTrigger>
              <SelectValue placeholder={
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
