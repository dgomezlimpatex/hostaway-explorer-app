
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RecurringTaskFormData } from "./useRecurringTaskForm";

interface ScheduleSectionProps {
  formData: RecurringTaskFormData;
  updateFormData: (field: keyof RecurringTaskFormData, value: any) => void;
}

export const ScheduleSection = ({ formData, updateFormData }: ScheduleSectionProps) => {
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
            onChange={(e) => updateFormData('startTime', e.target.value)}
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

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="checkOut">Check-out</Label>
          <Input
            id="checkOut"
            type="time"
            value={formData.checkOut}
            onChange={(e) => updateFormData('checkOut', e.target.value)}
          />
        </div>
        <div>
          <Label htmlFor="checkIn">Check-in</Label>
          <Input
            id="checkIn"
            type="time"
            value={formData.checkIn}
            onChange={(e) => updateFormData('checkIn', e.target.value)}
          />
        </div>
      </div>
    </div>
  );
};
