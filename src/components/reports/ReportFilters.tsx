
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarIcon } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { ReportFilters } from '@/types/filters';
import { useClients } from '@/hooks/useClients';
import { useCleaners } from '@/hooks/useCleaners';
import { useSedes } from '@/hooks/useSedes';
import { useSede } from '@/contexts/SedeContext';
import { useAuth } from '@/hooks/useAuth';

interface ReportFiltersComponentProps {
  filters: ReportFilters;
  onFiltersChange: (filters: ReportFilters) => void;
}

export const ReportFiltersComponent = ({ filters, onFiltersChange }: ReportFiltersComponentProps) => {
  const { data: clients = [] } = useClients();
  const { cleaners = [] } = useCleaners();
  const { allSedes } = useSedes();
  const { activeSede } = useSede();
  const { user } = useAuth();

  // Verificar si es admin para mostrar selector multi-sede
  const isAdmin = user?.app_metadata?.role === 'admin';

  return (
    <Card>
      <CardContent className="p-3 sm:p-6">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2 sm:gap-4">
          {/* Selector de Sede (solo para admins) */}
          {isAdmin && (
            <div className="space-y-1 sm:space-y-2 col-span-2 md:col-span-1">
              <label className="text-sm font-medium">Sede</label>
              <Select 
                value={filters.sedeId || 'current'} 
                onValueChange={(value) => onFiltersChange({ 
                  ...filters, 
                  sedeId: value === 'current' ? undefined : value === 'all' ? 'all' : value 
                })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="current">📍 Sede Actual ({activeSede?.nombre})</SelectItem>
                  <SelectItem value="all">🏢 Todas las Sedes</SelectItem>
                  {allSedes.map(sede => (
                    <SelectItem key={sede.id} value={sede.id}>
                      🏢 {sede.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Tipo de Reporte */}
          <div className="space-y-1 sm:space-y-2">
            <label className="text-xs sm:text-sm font-medium">Tipo</label>
            <Select 
              value={filters.reportType} 
              onValueChange={(value) => onFiltersChange({ ...filters, reportType: value as any })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="tasks">📋 Tareas</SelectItem>
                <SelectItem value="billing">💰 Facturación</SelectItem>
                <SelectItem value="summary">📊 Resumen</SelectItem>
                <SelectItem value="laundry">🧺 Preparación Lavandería</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Rango de Fechas */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Período</label>
            <Select 
              value={filters.dateRange} 
              onValueChange={(value) => onFiltersChange({ ...filters, dateRange: value as any })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="today">Hoy</SelectItem>
                <SelectItem value="yesterday">Ayer</SelectItem>
                <SelectItem value="week">Esta Semana</SelectItem>
                <SelectItem value="month">Este Mes</SelectItem>
                <SelectItem value="custom">Personalizado</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Cliente */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Cliente</label>
            <Select 
              value={filters.clientId || 'all'} 
              onValueChange={(value) => onFiltersChange({ ...filters, clientId: value === 'all' ? undefined : value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Todos los clientes" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los clientes</SelectItem>
                {clients.map(client => (
                  <SelectItem key={client.id} value={client.id}>
                    {client.nombre}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Trabajador */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Trabajador</label>
            <Select 
              value={filters.cleanerId || 'all'} 
              onValueChange={(value) => onFiltersChange({ ...filters, cleanerId: value === 'all' ? undefined : value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Todos los trabajadores" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los trabajadores</SelectItem>
                {cleaners.map(cleaner => (
                  <SelectItem key={cleaner.id} value={cleaner.name}>
                    {cleaner.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Fechas Personalizadas */}
        {filters.dateRange === 'custom' && (
          <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Fecha Inicio</label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-start text-left font-normal">
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {filters.startDate ? format(filters.startDate, 'PPP', { locale: es }) : 'Seleccionar fecha'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={filters.startDate}
                    onSelect={(date) => onFiltersChange({ ...filters, startDate: date })}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Fecha Fin</label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-start text-left font-normal">
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {filters.endDate ? format(filters.endDate, 'PPP', { locale: es }) : 'Seleccionar fecha'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={filters.endDate}
                    onSelect={(date) => onFiltersChange({ ...filters, endDate: date })}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
