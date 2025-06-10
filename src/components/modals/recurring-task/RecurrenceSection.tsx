
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { RecurringTaskFormData } from "./useRecurringTaskForm";

interface RecurrenceSectionProps {
  formData: RecurringTaskFormData;
  updateFormData: (field: keyof RecurringTaskFormData, value: any) => void;
}

export const RecurrenceSection = ({ formData, updateFormData }: RecurrenceSectionProps) => {
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
          <span className="text-sm text-gray-600">
            {formData.frequency === 'daily' && 'días'}
            {formData.frequency === 'weekly' && 'semanas'}
            {formData.frequency === 'monthly' && 'meses'}
          </span>
        </div>
      </div>

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
