
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Task } from "@/types/calendar";

interface TaskDetailsFormProps {
  task: Task;
  isEditing: boolean;
  formData: Partial<Task>;
  onFieldChange: (field: string, value: string) => void;
}

export const TaskDetailsForm = ({ task, isEditing, formData, onFieldChange }: TaskDetailsFormProps) => {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="property">Propiedad</Label>
          {isEditing ? (
            <Input
              id="property"
              value={formData.property || ''}
              onChange={(e) => onFieldChange('property', e.target.value)}
            />
          ) : (
            <p className="text-sm p-2 bg-gray-50 rounded">{task.property}</p>
          )}
        </div>
        
        <div className="space-y-2">
          <Label htmlFor="address">Dirección</Label>
          {isEditing ? (
            <Input
              id="address"
              value={formData.address || ''}
              onChange={(e) => onFieldChange('address', e.target.value)}
            />
          ) : (
            <p className="text-sm p-2 bg-gray-50 rounded">{task.address}</p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="startTime">Hora Inicio</Label>
          {isEditing ? (
            <Input
              id="startTime"
              type="time"
              value={formData.startTime || ''}
              onChange={(e) => onFieldChange('startTime', e.target.value)}
            />
          ) : (
            <p className="text-sm p-2 bg-gray-50 rounded">{task.startTime}</p>
          )}
        </div>
        
        <div className="space-y-2">
          <Label htmlFor="endTime">Hora Fin</Label>
          {isEditing ? (
            <Input
              id="endTime"
              type="time"
              value={formData.endTime || ''}
              onChange={(e) => onFieldChange('endTime', e.target.value)}
            />
          ) : (
            <p className="text-sm p-2 bg-gray-50 rounded">{task.endTime}</p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="checkOut">Check-out</Label>
          {isEditing ? (
            <Input
              id="checkOut"
              type="time"
              value={formData.checkOut || ''}
              onChange={(e) => onFieldChange('checkOut', e.target.value)}
            />
          ) : (
            <p className="text-sm p-2 bg-gray-50 rounded">{task.checkOut}</p>
          )}
        </div>
        
        <div className="space-y-2">
          <Label htmlFor="checkIn">Check-in</Label>
          {isEditing ? (
            <Input
              id="checkIn"
              type="time"
              value={formData.checkIn || ''}
              onChange={(e) => onFieldChange('checkIn', e.target.value)}
            />
          ) : (
            <p className="text-sm p-2 bg-gray-50 rounded">{task.checkIn}</p>
          )}
        </div>
      </div>

      {isEditing && (
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
      )}
    </div>
  );
};
