
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Toggle } from "@/components/ui/toggle";
import { RecurringTaskFormData } from "./useRecurringTaskForm";

interface RecurrenceSectionProps {
  formData: RecurringTaskFormData;
  updateFormData: (field: keyof RecurringTaskFormData, value: any) => void;
}

const weekDays = [
  { value: 1, label: 'L' },
  { value: 2, label: 'M' },
  { value: 3, label: 'X' },
  { value: 4, label: 'J' },
  { value: 5, label: 'V' },
  { value: 6, label: 'S' },
  { value: 0, label: 'D' },
];

export const RecurrenceSection = ({ formData, updateFormData }: RecurrenceSectionProps) => {
  const toggleDay = (day: number) => {
    const current = formData.daysOfWeek || [];
    const updated = current.includes(day)
      ? current.filter(d => d !== day)
      : [...current, day];
    updateFormData('daysOfWeek', updated);
  };

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">Configuración de Recurrencia</h3>
      
      <div>
        <Label htmlFor="frequency">Frecuencia</Label>
        <Select value={formData.frequency} onValueChange={(value: 'daily' | 'weekly' | 'monthly') => updateFormData('frequency', value)}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="daily">Diaria</SelectItem>
            <SelectItem value="weekly">Semanal</SelectItem>
            <SelectItem value="monthly">Mensual</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div>
        <Label htmlFor="interval">Cada</Label>
        <div className="flex items-center gap-2">
          <Input
            id="interval"
            type="number"
            min="1"
            value={formData.interval}
            onChange={(e) => updateFormData('interval', parseInt(e.target.value) || 1)}
            className="w-20"
          />
          <span className="text-sm text-muted-foreground">
            {formData.frequency === 'daily' && 'días'}
            {formData.frequency === 'weekly' && 'semanas'}
            {formData.frequency === 'monthly' && 'meses'}
          </span>
        </div>
      </div>

      {/* Visual weekday selector for weekly frequency */}
      {formData.frequency === 'weekly' && (
        <div>
          <Label className="mb-2 block">Días de la semana</Label>
          <div className="flex gap-1.5">
            {weekDays.map(day => (
              <Toggle
                key={day.value}
                pressed={formData.daysOfWeek?.includes(day.value)}
                onPressedChange={() => toggleDay(day.value)}
                size="sm"
                className="w-10 h-10 rounded-full data-[state=on]:bg-primary data-[state=on]:text-primary-foreground font-semibold"
              >
                {day.label}
              </Toggle>
            ))}
          </div>
          {(!formData.daysOfWeek || formData.daysOfWeek.length === 0) && (
            <p className="text-xs text-destructive mt-1">Selecciona al menos un día</p>
          )}
        </div>
      )}

      {/* Day of month selector for monthly frequency */}
      {formData.frequency === 'monthly' && (
        <div>
          <Label htmlFor="dayOfMonth">Día del mes</Label>
          <Input
            id="dayOfMonth"
            type="number"
            min="1"
            max="31"
            value={formData.dayOfMonth}
            onChange={(e) => updateFormData('dayOfMonth', parseInt(e.target.value) || 1)}
            className="w-20"
          />
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="startDate">Fecha de Inicio</Label>
          <Input
            id="startDate"
            type="date"
            value={formData.startDate}
            onChange={(e) => updateFormData('startDate', e.target.value)}
          />
        </div>
        <div>
          <Label htmlFor="endDate">Fecha de Fin (Opcional)</Label>
          <Input
            id="endDate"
            type="date"
            value={formData.endDate}
            onChange={(e) => updateFormData('endDate', e.target.value)}
          />
        </div>
      </div>

      <div className="flex items-center space-x-2">
        <Switch
          id="isActive"
          checked={formData.isActive}
          onCheckedChange={(checked) => updateFormData('isActive', checked)}
        />
        <Label htmlFor="isActive">Tarea activa</Label>
      </div>
    </div>
  );
};
