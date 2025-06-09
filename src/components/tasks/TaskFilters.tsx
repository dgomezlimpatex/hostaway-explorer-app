
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { useCleaners } from '@/hooks/useCleaners';

interface TaskFiltersProps {
  filters: {
    status: string;
    cleaner: string;
    dateRange: string;
  };
  onFiltersChange: (filters: any) => void;
}

export const TaskFilters = ({ filters, onFiltersChange }: TaskFiltersProps) => {
  const { cleaners } = useCleaners();

  const handleFilterChange = (key: string, value: string) => {
    onFiltersChange({ ...filters, [key]: value });
  };

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
