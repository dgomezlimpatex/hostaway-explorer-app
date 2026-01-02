
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Calendar, Filter } from 'lucide-react';
import { useClients } from '@/hooks/useClients';
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek } from 'date-fns';
import { es } from 'date-fns/locale';

interface ClientBillingFiltersProps {
  filters: {
    dateRange: 'today' | 'week' | 'month' | 'custom' | 'all';
    startDate?: Date;
    endDate?: Date;
    clientId?: string;
  };
  onFiltersChange: (filters: ClientBillingFiltersProps['filters']) => void;
}

export const ClientBillingFilters = ({ filters, onFiltersChange }: ClientBillingFiltersProps) => {
  const { data: clients = [] } = useClients();
  const [showCustomDates, setShowCustomDates] = useState(filters.dateRange === 'custom');

  const handleDateRangeChange = (value: string) => {
    const dateRange = value as ClientBillingFiltersProps['filters']['dateRange'];
    let startDate: Date | undefined;
    let endDate: Date | undefined;
    const today = new Date();

    switch (dateRange) {
      case 'today':
        startDate = today;
        endDate = today;
        break;
      case 'week':
        startDate = startOfWeek(today, { weekStartsOn: 1 });
        endDate = endOfWeek(today, { weekStartsOn: 1 });
        break;
      case 'month':
        startDate = startOfMonth(today);
        endDate = endOfMonth(today);
        break;
      case 'all':
        startDate = undefined;
        endDate = undefined;
        break;
      case 'custom':
        setShowCustomDates(true);
        onFiltersChange({ ...filters, dateRange });
        return;
    }

    setShowCustomDates(false);
    onFiltersChange({ ...filters, dateRange, startDate, endDate });
  };

  const handleClientChange = (value: string) => {
    onFiltersChange({ 
      ...filters, 
      clientId: value === 'all' ? undefined : value 
    });
  };

  const handleCustomDateChange = (field: 'startDate' | 'endDate', value: string) => {
    onFiltersChange({
      ...filters,
      [field]: value ? new Date(value) : undefined,
    });
  };

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex flex-wrap gap-4 items-end">
          {/* Date Range */}
          <div className="space-y-2 min-w-[180px]">
            <Label className="flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              Período
            </Label>
            <Select value={filters.dateRange} onValueChange={handleDateRangeChange}>
              <SelectTrigger>
                <SelectValue placeholder="Seleccionar período" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="today">Hoy</SelectItem>
                <SelectItem value="week">Esta semana</SelectItem>
                <SelectItem value="month">Este mes</SelectItem>
                <SelectItem value="custom">Personalizado</SelectItem>
                <SelectItem value="all">Todo</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Custom Date Range */}
          {showCustomDates && (
            <>
              <div className="space-y-2">
                <Label>Desde</Label>
                <Input
                  type="date"
                  value={filters.startDate ? format(filters.startDate, 'yyyy-MM-dd') : ''}
                  onChange={(e) => handleCustomDateChange('startDate', e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Hasta</Label>
                <Input
                  type="date"
                  value={filters.endDate ? format(filters.endDate, 'yyyy-MM-dd') : ''}
                  onChange={(e) => handleCustomDateChange('endDate', e.target.value)}
                />
              </div>
            </>
          )}

          {/* Client Filter */}
          <div className="space-y-2 min-w-[200px]">
            <Label className="flex items-center gap-2">
              <Filter className="h-4 w-4" />
              Cliente
            </Label>
            <Select value={filters.clientId || 'all'} onValueChange={handleClientChange}>
              <SelectTrigger>
                <SelectValue placeholder="Todos los clientes" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los clientes</SelectItem>
                {clients.map((client) => (
                  <SelectItem key={client.id} value={client.id}>
                    {client.nombre}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
