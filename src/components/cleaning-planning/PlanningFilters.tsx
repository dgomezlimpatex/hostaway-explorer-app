import { Button } from '@/components/ui/button';
import { CleaningPlanningFilters, PlanningRangePreset, PlanningTaskFilter } from '@/types/cleaningPlanning';
import { Sede } from '@/types/sede';
import { addDays, subDays } from 'date-fns';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface PlanningFiltersProps {
  date: Date;
  preset: PlanningRangePreset;
  filters: CleaningPlanningFilters;
  zones: string[];
  cleaners: Array<{ id: string; name: string }>;
  activeSedeId?: string;
  availableSedes: Sede[];
  onDateChange: (date: Date) => void;
  onPresetChange: (preset: PlanningRangePreset) => void;
  onFiltersChange: (filters: CleaningPlanningFilters) => void;
  onSedeChange: (sede: Sede) => void;
}

const presets: Array<{ value: PlanningRangePreset; label: string }> = [
  { value: 'today', label: 'Hoy' },
  { value: '7d', label: '7 días' },
  { value: '30d', label: '30 días' },
];

const taskFilters: Array<{ value: PlanningTaskFilter; label: string }> = [
  { value: 'all', label: 'Todas' },
  { value: 'unassigned', label: 'Solo sin asignar' },
  { value: 'risks', label: 'Solo riesgos' },
];

export const PlanningFilters = ({
  date,
  preset,
  filters,
  zones,
  cleaners,
  activeSedeId,
  availableSedes,
  onDateChange,
  onPresetChange,
  onFiltersChange,
  onSedeChange,
}: PlanningFiltersProps) => {
  const updateFilter = <K extends keyof CleaningPlanningFilters>(key: K, value: CleaningPlanningFilters[K]) => {
    onFiltersChange({ ...filters, [key]: value });
  };

  return (
    <div className="space-y-3 rounded-lg border bg-white p-4 shadow-sm">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-sm font-medium text-gray-900">Horizonte y sede</p>
          <p className="text-xs text-muted-foreground">Centro = propiedad/edificio. La sede activa limita datos y evita mezclar sedes.</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => onDateChange(subDays(date, 1))}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <input
            className="h-9 rounded-md border border-input bg-background px-3 text-sm"
            type="date"
            value={date.toISOString().slice(0, 10)}
            onChange={(event) => onDateChange(new Date(`${event.target.value}T12:00:00`))}
          />
          <Button variant="outline" size="sm" onClick={() => onDateChange(addDays(date, 1))}>
            <ChevronRight className="h-4 w-4" />
          </Button>

          <div className="flex rounded-md border p-1">
            {presets.map((item) => (
              <Button
                key={item.value}
                size="sm"
                variant={preset === item.value ? 'default' : 'ghost'}
                onClick={() => onPresetChange(item.value)}
              >
                {item.label}
              </Button>
            ))}
          </div>
        </div>
      </div>

      <div className="grid gap-2 md:grid-cols-5">
        <select
          className="h-9 rounded-md border border-input bg-background px-3 text-sm"
          value={activeSedeId || ''}
          onChange={(event) => {
            const sede = availableSedes.find((item) => item.id === event.target.value);
            if (sede) onSedeChange(sede);
          }}
          title="Sede operativa"
        >
          {availableSedes.map((sede) => <option key={sede.id} value={sede.id}>{sede.nombre}</option>)}
        </select>
        <input
          className="h-9 rounded-md border border-input bg-background px-3 text-sm"
          placeholder="Buscar propiedad/edificio/dirección…"
          value={filters.search}
          onChange={(event) => updateFilter('search', event.target.value)}
        />
        <select
          className="h-9 rounded-md border border-input bg-background px-3 text-sm"
          value={filters.taskFilter}
          onChange={(event) => updateFilter('taskFilter', event.target.value as PlanningTaskFilter)}
        >
          {taskFilters.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
        </select>
        <select
          className="h-9 rounded-md border border-input bg-background px-3 text-sm"
          value={filters.zone}
          onChange={(event) => updateFilter('zone', event.target.value)}
        >
          <option value="all">Todas las zonas</option>
          {zones.map((zone) => <option key={zone} value={zone}>{zone}</option>)}
        </select>
        <select
          className="h-9 rounded-md border border-input bg-background px-3 text-sm"
          value={filters.cleanerId}
          onChange={(event) => updateFilter('cleanerId', event.target.value)}
        >
          <option value="all">Todas las limpiadoras</option>
          {cleaners.map((cleaner) => <option key={cleaner.id} value={cleaner.id}>{cleaner.name}</option>)}
        </select>
      </div>
    </div>
  );
};
