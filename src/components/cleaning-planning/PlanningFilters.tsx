import { Button } from '@/components/ui/button';
import { PlanningRangePreset } from '@/types/cleaningPlanning';
import { addDays, subDays } from 'date-fns';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface PlanningFiltersProps {
  date: Date;
  preset: PlanningRangePreset;
  onDateChange: (date: Date) => void;
  onPresetChange: (preset: PlanningRangePreset) => void;
}

const presets: Array<{ value: PlanningRangePreset; label: string }> = [
  { value: 'today', label: 'Día' },
  { value: 'tomorrow', label: 'Mañana' },
  { value: 'week', label: 'Semana' },
];

export const PlanningFilters = ({ date, preset, onDateChange, onPresetChange }: PlanningFiltersProps) => {
  return (
    <div className="flex flex-col gap-3 rounded-lg border bg-white p-4 md:flex-row md:items-center md:justify-between">
      <div>
        <p className="text-sm font-medium text-gray-900">Rango de planificación</p>
        <p className="text-xs text-muted-foreground">Cambia entre día y semana para equilibrar carga.</p>
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
  );
};
