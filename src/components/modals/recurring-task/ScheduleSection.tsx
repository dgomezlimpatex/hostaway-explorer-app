
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RecurringTaskFormData } from "./useRecurringTaskForm";

interface ScheduleSectionProps {
  formData: RecurringTaskFormData;
  updateFormData: (field: keyof RecurringTaskFormData, value: any) => void;
}

export const ScheduleSection = ({ formData, updateFormData }: ScheduleSectionProps) => {
  const handleStartTimeChange = (value: string) => {
    updateFormData('startTime', value);
    // Auto-calculate endTime based on duration
    if (formData.duracion > 0) {
      const [h, m] = value.split(':').map(Number);
      const totalMin = h * 60 + m + formData.duracion;
      const endH = Math.floor(totalMin / 60) % 24;
      const endM = totalMin % 60;
      updateFormData('endTime', `${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}`);
    }
  };

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">Horarios</h3>
      
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="startTime">Hora de Inicio</Label>
          <Input
            id="startTime"
            type="time"
            value={formData.startTime}
            onChange={(e) => handleStartTimeChange(e.target.value)}
          />
        </div>
        <div>
          <Label htmlFor="endTime">Hora de Fin</Label>
          <Input
            id="endTime"
            type="time"
            value={formData.endTime}
            onChange={(e) => updateFormData('endTime', e.target.value)}
          />
        </div>
      </div>
    </div>
  );
};
