
import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Building, MapPin } from "lucide-react";
import { useClients } from '@/hooks/useClients';
import { useProperties } from '@/hooks/useProperties';
import { ClientPropertySelector } from '../ClientPropertySelector';

interface MultiPropertySelectorProps {
  selectedProperties: string[];
  onPropertiesChange: (propertyIds: string[]) => void;
  onClientChange?: (clientId: string | null) => void;
}

export const MultiPropertySelector = ({
  selectedProperties,
  onPropertiesChange,
  onClientChange
}: MultiPropertySelectorProps) => {
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const { data: clients = [] } = useClients();
  const { data: allProperties = [] } = useProperties();

  // Filtrar propiedades por cliente seleccionado
  const availableProperties = selectedClientId 
    ? allProperties.filter(p => p.clienteId === selectedClientId)
    : [];

  const selectedClient = clients.find(c => c.id === selectedClientId);

  const handleClientChange = (client: any) => {
    setSelectedClientId(client?.id || null);
    onPropertiesChange([]); // Limpiar propiedades seleccionadas
    onClientChange?.(client?.id || null);
  };

  const handlePropertyToggle = (propertyId: string) => {
    const newSelection = selectedProperties.includes(propertyId)
      ? selectedProperties.filter(id => id !== propertyId)
      : [...selectedProperties, propertyId];
    
    onPropertiesChange(newSelection);
  };

  const handleSelectAll = () => {
    if (selectedProperties.length === availableProperties.length) {
      onPropertiesChange([]);
    } else {
      onPropertiesChange(availableProperties.map(p => p.id));
    }
  };

  return (
    <div className="space-y-4">
      {/* Selector de Cliente */}
      <div>
        <label className="text-sm font-medium mb-2 block">
          Cliente/Edificio
        </label>
        <ClientPropertySelector
          onClientChange={handleClientChange}
          onPropertyChange={() => {}} // No usado en este contexto
          showPropertySelector={false}
        />
      </div>

      {/* Lista de Propiedades */}
      {selectedClientId && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <Building className="h-4 w-4" />
                Propiedades de {selectedClient?.nombre}
              </CardTitle>
              <div className="flex items-center gap-2">
                <Badge variant="secondary">
                  {selectedProperties.length} / {availableProperties.length} seleccionadas
                </Badge>
                <button
                  type="button"
                  onClick={handleSelectAll}
                  className="text-sm text-blue-600 hover:text-blue-800"
                >
                  {selectedProperties.length === availableProperties.length ? 'Deseleccionar todas' : 'Seleccionar todas'}
                </button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="max-h-[50vh] overflow-y-auto">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {availableProperties.map((property) => (
                <div
                  key={property.id}
                  className="flex items-center space-x-3 p-2 rounded-lg hover:bg-muted/50 border border-border"
                >
                  <Checkbox
                    checked={selectedProperties.includes(property.id)}
                    onCheckedChange={() => handlePropertyToggle(property.id)}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm">{property.codigo}</span>
                      <span className="text-muted-foreground text-sm">-</span>
                      <span className="text-foreground text-sm truncate">{property.nombre}</span>
                    </div>
                    <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                      <MapPin className="h-3 w-3" />
                      <span className="truncate">{property.direccion}</span>
                    </div>
                  </div>
                  <div className="text-right text-xs text-muted-foreground">
                    <div>{property.costeServicio}€</div>
                    <div>{property.duracionServicio}min</div>
                  </div>
                </div>
              ))}
            </div>
            
            {availableProperties.length === 0 && (
              <div className="text-center py-4 text-gray-500 text-sm">
                No hay propiedades disponibles para este cliente
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
};
