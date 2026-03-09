
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { RecurringTaskFormData } from "./useRecurringTaskForm";
import { useCleaners } from "@/hooks/useCleaners";
import { useMemo } from "react";

interface BasicInfoSectionProps {
  formData: RecurringTaskFormData;
  updateFormData: (field: keyof RecurringTaskFormData, value: any) => void;
}

export const BasicInfoSection = ({ formData, updateFormData }: BasicInfoSectionProps) => {
  const { cleaners = [] } = useCleaners();

  const activeCleaners = useMemo(() => 
    cleaners.filter(c => c.isActive),
    [cleaners]
  );

  const serviceTypes = [
    { value: 'limpieza-mantenimiento', label: 'Limpieza de Mantenimiento' },
    { value: 'mantenimiento-cristaleria', label: 'Mantenimiento de Cristalería' },
    { value: 'limpieza-turistica', label: 'Limpieza Turística' },
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

      <div className="grid grid-cols-2 gap-4">
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

        <div>
          <Label htmlFor="cleaner">Trabajador</Label>
          <Select 
            value={formData.cleaner || '_none'} 
            onValueChange={(value) => updateFormData('cleaner', value === '_none' ? '' : value)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Seleccionar trabajador" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="_none">Sin asignar</SelectItem>
              {activeCleaners.map((cleaner) => (
                <SelectItem key={cleaner.id} value={cleaner.name}>
                  {cleaner.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="coste">Coste (€)</Label>
          <Input
            id="coste"
            type="number"
            min="0"
            step="0.01"
            value={formData.coste}
            onChange={(e) => updateFormData('coste', parseFloat(e.target.value) || 0)}
          />
        </div>
        <div>
          <Label htmlFor="duracion">Duración (horas)</Label>
          <Input
            id="duracion"
            type="number"
            min="0"
            step="0.25"
            value={formData.duracion / 60}
            onChange={(e) => updateFormData('duracion', Math.round((parseFloat(e.target.value) || 0) * 60))}
          />
        </div>
      </div>
    </div>
  );
};
