import { useCallback, useEffect, memo } from 'react';
import { cn } from "@/lib/utils";

interface Property {
  id: string;
  codigo: string;
  nombre: string;
  costeServicio: number;
  duracionServicio: number;
}

interface PropertyGridSelectorProps {
  properties: Property[];
  selectedIds: string[];
  onSelectionChange: (ids: string[]) => void;
  onSelectAll: () => void;
  onDeselectAll: () => void;
}

const PropertyButton = memo(({ 
  property, 
  isSelected, 
  onToggle 
}: { 
  property: Property; 
  isSelected: boolean; 
  onToggle: () => void;
}) => {
  // Extract the numeric part of the code for display
  const displayCode = property.codigo || property.nombre;

  return (
    <button
      type="button"
      onClick={onToggle}
      className={cn(
        "flex flex-col items-center justify-center",
        "min-h-[80px] p-3 rounded-lg border-2",
        "transition-all duration-150 ease-in-out",
        "focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2",
        isSelected 
          ? "border-primary bg-primary/10 text-primary shadow-sm" 
          : "border-border bg-background hover:border-muted-foreground/50 hover:bg-muted/50"
      )}
    >
      <span className={cn(
        "text-2xl font-bold leading-none",
        isSelected ? "text-primary" : "text-foreground"
      )}>
        {displayCode}
      </span>
      <span className={cn(
        "text-xs mt-1",
        isSelected ? "text-primary/80" : "text-muted-foreground"
      )}>
        {property.costeServicio}€ · {property.duracionServicio}min
      </span>
    </button>
  );
});

PropertyButton.displayName = 'PropertyButton';

export const PropertyGridSelector = ({
  properties,
  selectedIds,
  onSelectionChange,
  onSelectAll,
  onDeselectAll,
}: PropertyGridSelectorProps) => {
  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl+A or Cmd+A to select all
      if ((e.ctrlKey || e.metaKey) && e.key === 'a') {
        // Only if focus is within the grid area
        const activeElement = document.activeElement;
        const gridContainer = document.getElementById('property-grid-container');
        if (gridContainer?.contains(activeElement) || activeElement === document.body) {
          e.preventDefault();
          onSelectAll();
        }
      }
      
      // Escape to clear selection
      if (e.key === 'Escape') {
        onDeselectAll();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onSelectAll, onDeselectAll]);

  const handleToggle = useCallback((propertyId: string) => {
    const newSelection = selectedIds.includes(propertyId)
      ? selectedIds.filter(id => id !== propertyId)
      : [...selectedIds, propertyId];
    onSelectionChange(newSelection);
  }, [selectedIds, onSelectionChange]);

  if (properties.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        No hay propiedades disponibles para este cliente
      </div>
    );
  }

  return (
    <div 
      id="property-grid-container"
      className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-2 max-h-[50vh] overflow-y-auto p-1"
      tabIndex={0}
    >
      {properties.map((property) => (
        <PropertyButton
          key={property.id}
          property={property}
          isSelected={selectedIds.includes(property.id)}
          onToggle={() => handleToggle(property.id)}
        />
      ))}
    </div>
  );
};
