import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { useCleaners } from '@/hooks/useCleaners';
import { useProperties } from '@/hooks/useProperties';

interface CleaningReportsFiltersProps {
  filters: {
    dateRange: string;
    cleaner: string;
    status: string;
    property: string;
    hasIncidents: string;
  };
  onFiltersChange: (filters: any) => void;
}

export const CleaningReportsFilters: React.FC<CleaningReportsFiltersProps> = ({
  filters,
  onFiltersChange,
}) => {
  const { cleaners } = useCleaners();
  const { data: properties = [] } = useProperties();

  const handleFilterChange = (key: string, value: string) => {
    onFiltersChange({
      ...filters,
      [key]: value,
    });
  };

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
          <div className="space-y-2">
            <Label htmlFor="dateRange">Período</Label>
            <Select
              value={filters.dateRange}
              onValueChange={(value) => handleFilterChange('dateRange', value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Seleccionar período" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="today">Hoy</SelectItem>
                <SelectItem value="yesterday">Ayer</SelectItem>
                <SelectItem value="week">Esta semana</SelectItem>
                <SelectItem value="month">Este mes</SelectItem>
                <SelectItem value="quarter">Último trimestre</SelectItem>
                <SelectItem value="all">Todo el tiempo</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="cleaner">Limpiador</Label>
            <Select
              value={filters.cleaner}
              onValueChange={(value) => handleFilterChange('cleaner', value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Todos los limpiadores" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los limpiadores</SelectItem>
                {cleaners.map((cleaner) => (
                  <SelectItem key={cleaner.id} value={cleaner.id}>
                    {cleaner.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="status">Estado</Label>
            <Select
              value={filters.status}
              onValueChange={(value) => handleFilterChange('status', value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Todos los estados" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los estados</SelectItem>
                <SelectItem value="pending">Pendiente</SelectItem>
                <SelectItem value="in_progress">En progreso</SelectItem>
                <SelectItem value="completed">Completado</SelectItem>
                <SelectItem value="needs_review">Necesita revisión</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="property">Propiedad</Label>
            <Select
              value={filters.property}
              onValueChange={(value) => handleFilterChange('property', value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Todas las propiedades" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas las propiedades</SelectItem>
                {properties.map((property) => (
                  <SelectItem key={property.id} value={property.id}>
                    {property.nombre}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="hasIncidents">Incidencias</Label>
            <Select
              value={filters.hasIncidents}
              onValueChange={(value) => handleFilterChange('hasIncidents', value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Filtrar incidencias" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Con y sin incidencias</SelectItem>
                <SelectItem value="yes">Solo con incidencias</SelectItem>
                <SelectItem value="no">Sin incidencias</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};