import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { CleaningPlanningFilters, PlanningRangePreset, PlanningTaskFilter } from '@/types/cleaningPlanning';
import { Sede } from '@/types/sede';
import { formatMadridDate } from '@/utils/date';
import { addDays, subDays } from 'date-fns';
import { ChevronLeft, ChevronRight, SlidersHorizontal, X } from 'lucide-react';

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

const controlClass = 'h-11 min-h-[44px] rounded-md border border-[#310984]/12 bg-white px-3 text-sm text-[#171321] outline-none ring-offset-white placeholder:text-[#6b627a]/55 focus:border-[#310984]/50 focus:ring-2 focus:ring-[#310984]/15';

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
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const hasAdvancedFilters = filters.search.trim().length > 0 || filters.taskFilter !== 'all' || filters.zone !== 'all' || filters.cleanerId !== 'all';

  const updateFilter = <K extends keyof CleaningPlanningFilters>(key: K, value: CleaningPlanningFilters[K]) => {
    onFiltersChange({ ...filters, [key]: value });
  };

  const clearAdvancedFilters = () => {
    onFiltersChange({ taskFilter: 'all', zone: 'all', search: '', cleanerId: 'all' });
  };

  return (
    <div className="space-y-3 rounded-2xl border border-[#310984]/10 bg-white p-4 text-[#171321] shadow-lg shadow-[#310984]/6">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <p className="text-sm font-semibold text-[#171321]">Día, sede y horizonte</p>
          <p className="text-xs text-[#6b627a]">Elige qué operación quieres cerrar. Los filtros finos están en “Más filtros”.</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            aria-label="Seleccionar sede operativa"
            className={controlClass}
            value={activeSedeId || ''}
            onChange={(event) => {
              const sede = availableSedes.find((item) => item.id === event.target.value);
              if (sede) onSedeChange(sede);
            }}
          >
            {availableSedes.map((sede) => <option key={sede.id} value={sede.id}>{sede.nombre}</option>)}
          </select>

          <Button
            aria-label="Día anterior"
            variant="outline"
            size="sm"
            className="min-h-[44px] border-[#310984]/15 bg-white text-[#310984] hover:bg-[#f0eaff] hover:text-[#310984]"
            onClick={() => onDateChange(subDays(date, 1))}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <input
            aria-label="Fecha de planificación"
            className={controlClass}
            type="date"
            value={formatMadridDate(date)}
            onChange={(event) => onDateChange(new Date(`${event.target.value}T12:00:00`))}
          />
          <Button
            aria-label="Día siguiente"
            variant="outline"
            size="sm"
            className="min-h-[44px] border-[#310984]/15 bg-white text-[#310984] hover:bg-[#f0eaff] hover:text-[#310984]"
            onClick={() => onDateChange(addDays(date, 1))}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>

          <div className="flex rounded-md border border-[#310984]/10 bg-[#f7f3ff] p-1" aria-label="Horizonte de planificación">
            {presets.map((item) => (
              <Button
                key={item.value}
                size="sm"
                variant={preset === item.value ? 'default' : 'ghost'}
                className={preset === item.value ? 'min-h-[44px] bg-[#310984] text-white hover:bg-[#4c1bb0]' : 'min-h-[44px] text-[#6b627a] hover:bg-white hover:text-[#310984]'}
                onClick={() => onPresetChange(item.value)}
              >
                {item.label}
              </Button>
            ))}
          </div>

          <Button
            type="button"
            variant="outline"
            className="min-h-[44px] border-[#310984]/15 bg-white text-[#310984] hover:bg-[#f0eaff] hover:text-[#310984]"
            onClick={() => setShowAdvancedFilters((current) => !current)}
          >
            <SlidersHorizontal className="mr-2 h-4 w-4" /> Más filtros{hasAdvancedFilters ? ' activos' : ''}
          </Button>
        </div>
      </div>

      {showAdvancedFilters && (
        <div className="grid gap-2 border-t border-[#310984]/10 pt-3 md:grid-cols-5">
          <input
            aria-label="Buscar propiedad, edificio o dirección"
            className={controlClass}
            placeholder="Buscar propiedad/edificio/dirección…"
            value={filters.search}
            onChange={(event) => updateFilter('search', event.target.value)}
          />
          <select
            aria-label="Filtrar tareas por estado"
            className={controlClass}
            value={filters.taskFilter}
            onChange={(event) => updateFilter('taskFilter', event.target.value as PlanningTaskFilter)}
          >
            {taskFilters.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
          </select>
          <select
            aria-label="Filtrar por zona"
            className={controlClass}
            value={filters.zone}
            onChange={(event) => updateFilter('zone', event.target.value)}
          >
            <option value="all">Todas las zonas</option>
            {zones.map((zone) => <option key={zone} value={zone}>{zone}</option>)}
          </select>
          <select
            aria-label="Filtrar por limpiadora"
            className={controlClass}
            value={filters.cleanerId}
            onChange={(event) => updateFilter('cleanerId', event.target.value)}
          >
            <option value="all">Todas las limpiadoras</option>
            {cleaners.map((cleaner) => <option key={cleaner.id} value={cleaner.id}>{cleaner.name}</option>)}
          </select>
          <Button
            type="button"
            variant="outline"
            className="min-h-[44px] border-[#310984]/15 bg-white text-[#310984] hover:bg-[#f0eaff] hover:text-[#310984]"
            disabled={!hasAdvancedFilters}
            onClick={clearAdvancedFilters}
          >
            <X className="mr-2 h-4 w-4" /> Limpiar filtros
          </Button>
        </div>
      )}
    </div>
  );
};
