
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { format, addYears } from "date-fns";

interface TimeFieldsSectionProps {
  formData: {
    date: string;
    startTime: string;
    endTime: string;
    duracion: number;
  };
  onFieldChange: (field: string, value: string | number) => void;
  convertMinutesToTime: (minutes: number) => string;
}

export const TimeFieldsSection = ({
  formData,
  onFieldChange,
  convertMinutesToTime
}: TimeFieldsSectionProps) => {
  return (
    <>
      <div className="grid grid-cols-3 gap-4">
        <div className="space-y-2">
          <Label htmlFor="date">Fecha</Label>
          <Input
            id="date"
            type="date"
            value={formData.date}
            onChange={(e) => onFieldChange('date', e.target.value)}
            min={format(new Date(), 'yyyy-MM-dd')}
            max={format(addYears(new Date(), 2), 'yyyy-MM-dd')}
            className="w-full"
          />
          <p className="text-xs text-muted-foreground">
            Puedes seleccionar fechas hasta 2 años en el futuro
          </p>
        </div>
        
        <div className="space-y-2">
          <Label htmlFor="startTime">Hora Inicio (opcional)</Label>
          <Input
            id="startTime"
            type="time"
            value={formData.startTime}
            onChange={(e) => onFieldChange('startTime', e.target.value)}
            placeholder="Sin asignar"
          />
        </div>
        
        <div className="space-y-2">
          <Label htmlFor="endTime">Hora Fin (auto)</Label>
          <Input
            id="endTime"
            type="time"
            value={formData.endTime}
            readOnly
            className="bg-gray-50"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="duracion">Duración</Label>
          <Input
            id="duracion"
            value={convertMinutesToTime(formData.duracion)}
            readOnly
            className="bg-gray-50"
            placeholder="00:00"
          />
        </div>
      </div>
    </>
  );
};
