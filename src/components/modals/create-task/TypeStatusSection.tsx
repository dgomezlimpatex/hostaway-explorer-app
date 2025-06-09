
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface TypeStatusSectionProps {
  formData: {
    type: string;
    status: 'pending' | 'in-progress' | 'completed';
  };
  onFieldChange: (field: string, value: string) => void;
}

export const TypeStatusSection = ({ formData, onFieldChange }: TypeStatusSectionProps) => {
  return (
    <div className="grid grid-cols-2 gap-4">
      <div className="space-y-2">
        <Label htmlFor="type">Tipo</Label>
        <Select value={formData.type} onValueChange={(value) => onFieldChange('type', value)}>
          <SelectTrigger>
            <SelectValue placeholder="Seleccionar tipo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="checkout-checkin">Check-out/Check-in</SelectItem>
            <SelectItem value="maintenance">Mantenimiento</SelectItem>
            <SelectItem value="deep-cleaning">Limpieza Profunda</SelectItem>
            <SelectItem value="cristaleria">Cristalería</SelectItem>
          </SelectContent>
        </Select>
      </div>
      
      <div className="space-y-2">
        <Label htmlFor="status">Estado</Label>
        <Select value={formData.status} onValueChange={(value) => onFieldChange('status', value)}>
          <SelectTrigger>
            <SelectValue placeholder="Seleccionar estado" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="pending">Pendiente</SelectItem>
            <SelectItem value="in-progress">En Progreso</SelectItem>
            <SelectItem value="completed">Completado</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
};
