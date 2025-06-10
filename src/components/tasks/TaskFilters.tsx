
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { useCleaners } from '@/hooks/useCleaners';
import { useClients } from '@/hooks/useClients';
import { useProperties } from '@/hooks/useProperties';

interface TaskFiltersProps {
  filters: {
    status: string;
    cleaner: string;
    dateRange: string;
    cliente: string;
    propiedad: string;
  };
  onFiltersChange: (filters: any) => void;
}

export const TaskFilters = ({ filters, onFiltersChange }: TaskFiltersProps) => {
  const { cleaners } = useCleaners();
  const { data: clients = [] } = useClients();
  const { data: properties = [] } = useProperties();

  const handleFilterChange = (key: string, value: string) => {
    const newFilters = { ...filters, [key]: value };
    
    // Si se cambia el cliente, resetear la propiedad
    if (key === 'cliente') {
      newFilters.propiedad = 'all';
    }
    
    onFiltersChange(newFilters);
  };

  // Filtrar propiedades por cliente seleccionado
  const filteredProperties = filters.cliente && filters.cliente !== 'all' 
    ? properties.filter(p => p.clienteId === filters.cliente)
    : properties;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Filtros</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="status">Estado</Label>
          <Select value={filters.status} onValueChange={(value) => handleFilterChange('status', value)}>
            <SelectTrigger>
              <SelectValue placeholder="Todos los estados" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="pending">Pendiente</SelectItem>
              <SelectItem value="in-progress">En Progreso</SelectItem>
              <SelectItem value="completed">Completado</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="cleaner">Limpiador</Label>
          <Select value={filters.cleaner} onValueChange={(value) => handleFilterChange('cleaner', value)}>
            <SelectTrigger>
              <SelectValue placeholder="Todos los limpiadores" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              {cleaners.map((cleaner) => (
                <SelectItem key={cleaner.id} value={cleaner.name}>
                  {cleaner.name}
                </SelectItem>
              ))}
              <SelectItem value="unassigned">Sin asignar</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="cliente">Cliente</Label>
          <Select value={filters.cliente} onValueChange={(value) => handleFilterChange('cliente', value)}>
            <SelectTrigger>
              <SelectValue placeholder="Todos los clientes" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              {clients.map((cliente) => (
                <SelectItem key={cliente.id} value={cliente.id}>
                  {cliente.nombre}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="propiedad">Propiedad</Label>
          <Select 
            value={filters.propiedad} 
            onValueChange={(value) => handleFilterChange('propiedad', value)}
            disabled={filters.cliente === 'all'}
          >
            <SelectTrigger>
              <SelectValue placeholder={filters.cliente === 'all' ? "Selecciona un cliente primero" : "Todas las propiedades"} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
              {filteredProperties.map((propiedad) => (
                <SelectItem key={propiedad.id} value={propiedad.id}>
                  {propiedad.codigo} - {propiedad.nombre}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="dateRange">Período</Label>
          <Select value={filters.dateRange} onValueChange={(value) => handleFilterChange('dateRange', value)}>
            <SelectTrigger>
              <SelectValue placeholder="Todas las fechas" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
              <SelectItem value="today">Hoy</SelectItem>
              <SelectItem value="tomorrow">Mañana</SelectItem>
              <SelectItem value="this-week">Esta semana</SelectItem>
              <SelectItem value="next-week">Próxima semana</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardContent>
    </Card>
  );
};
