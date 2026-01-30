import { useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Building } from "lucide-react";
import { useClients } from '@/hooks/useClients';
import { useProperties } from '@/hooks/useProperties';
import { ClientPropertySelector } from '../ClientPropertySelector';
import { PropertyGridSelector } from './PropertyGridSelector';
import { PropertyGridToolbar } from './PropertyGridToolbar';

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

  // Find selected client and check if it's active
  const selectedClient = clients.find(c => c.id === selectedClientId);
  const clientIsActive = selectedClient?.isActive !== false;

  // Filtrar propiedades por cliente seleccionado, solo activas, y ordenar numéricamente
  const availableProperties = selectedClientId 
    ? allProperties
        .filter(p => {
          if (p.clienteId !== selectedClientId) return false;
          // Check if property is effectively active (inherit from client if null)
          const isEffectivelyActive = p.isActive !== null ? p.isActive : clientIsActive;
          return isEffectivelyActive;
        })
        .sort((a, b) => {
          const getNumericPart = (str: string) => {
            const match = str.match(/(\d+)/);
            return match ? parseInt(match[1], 10) : 0;
          };
          const aKey = a.codigo || a.nombre;
          const bKey = b.codigo || b.nombre;
          const aNum = getNumericPart(aKey);
          const bNum = getNumericPart(bKey);
          if (aNum !== bNum) return aNum - bNum;
          return aKey.localeCompare(bKey, 'es');
        })
    : [];

  const handleClientChange = (client: any) => {
    setSelectedClientId(client?.id || null);
    onPropertiesChange([]); // Limpiar propiedades seleccionadas
    onClientChange?.(client?.id || null);
  };

  const handleSelectAll = useCallback(() => {
    onPropertiesChange(availableProperties.map(p => p.id));
  }, [availableProperties, onPropertiesChange]);

  const handleDeselectAll = useCallback(() => {
    onPropertiesChange([]);
  }, [onPropertiesChange]);

  const handleInvertSelection = useCallback(() => {
    const currentSet = new Set(selectedProperties);
    const inverted = availableProperties
      .filter(p => !currentSet.has(p.id))
      .map(p => p.id);
    onPropertiesChange(inverted);
  }, [availableProperties, selectedProperties, onPropertiesChange]);

  const handleSelectRange = useCallback((start: number, end: number) => {
    // Find properties whose numeric code falls within the range
    const inRange = availableProperties.filter(p => {
      const code = p.codigo || p.nombre;
      const match = code.match(/(\d+)/);
      if (!match) return false;
      const num = parseInt(match[1], 10);
      return num >= start && num <= end;
    });
    
    // Add to current selection (union)
    const currentSet = new Set(selectedProperties);
    inRange.forEach(p => currentSet.add(p.id));
    onPropertiesChange(Array.from(currentSet));
  }, [availableProperties, selectedProperties, onPropertiesChange]);

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

      {/* Lista de Propiedades con Grid */}
      {selectedClientId && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Building className="h-4 w-4" />
              Propiedades de {selectedClient?.nombre}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {/* Toolbar with quick actions */}
            <PropertyGridToolbar
              selectedCount={selectedProperties.length}
              totalCount={availableProperties.length}
              onSelectAll={handleSelectAll}
              onDeselectAll={handleDeselectAll}
              onInvertSelection={handleInvertSelection}
              onSelectRange={handleSelectRange}
            />
            
            {/* Grid de propiedades */}
            <PropertyGridSelector
              properties={availableProperties}
              selectedIds={selectedProperties}
              onSelectionChange={onPropertiesChange}
              onSelectAll={handleSelectAll}
              onDeselectAll={handleDeselectAll}
            />
          </CardContent>
        </Card>
      )}
    </div>
  );
};
