
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { RecurringTaskFormData } from "./useRecurringTaskForm";

interface BasicInfoSectionProps {
  formData: RecurringTaskFormData;
  updateFormData: (field: keyof RecurringTaskFormData, value: any) => void;
}

export const BasicInfoSection = ({ formData, updateFormData }: BasicInfoSectionProps) => {
  const serviceTypes = [
    { value: 'limpieza-mantenimiento', label: 'Limpieza de Mantenimiento' },
    { value: 'mantenimiento-cristaleria', label: 'Mantenimiento de Cristalería' },
    { value: 'mantenimiento-airbnb', label: 'Mantenimiento Airbnb' },
    { value: 'limpieza-puesta-punto', label: 'Limpieza de Puesta a Punto' },
    { value: 'limpieza-final-obra', label: 'Limpieza Final de Obra' },
    { value: 'check-in', label: 'Check In' },
    { value: 'desplazamiento', label: 'Desplazamiento' },
    { value: 'limpieza-especial', label: 'Limpieza Especial' },
    { value: 'trabajo-extraordinario', label: 'Trabajo Extraordinario' }
  ];

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">Información Básica</h3>
      
      <div>
        <Label htmlFor="name">Nombre de la Tarea</Label>
        <Input
          id="name"
          value={formData.name}
          onChange={(e) => updateFormData('name', e.target.value)}
          required
        />
      </div>

      <div>
        <Label htmlFor="description">Descripción (Opcional)</Label>
        <Textarea
          id="description"
          value={formData.description}
          onChange={(e) => updateFormData('description', e.target.value)}
          rows={3}
        />
      </div>

      <div>
        <Label htmlFor="type">Tipo de Servicio</Label>
        <Select value={formData.type} onValueChange={(value) => updateFormData('type', value)}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {serviceTypes.map((type) => (
              <SelectItem key={type.value} value={type.value}>
                {type.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
};
