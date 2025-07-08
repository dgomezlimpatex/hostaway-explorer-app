import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Task } from "@/types/calendar";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
interface TaskDetailsFormProps {
  task: Task;
  isEditing: boolean;
  formData: Partial<Task>;
  onFieldChange: (field: string, value: string) => void;
}
export const TaskDetailsForm = ({
  task,
  isEditing,
  formData,
  onFieldChange
}: TaskDetailsFormProps) => {
  const [propertyCode, setPropertyCode] = useState<string>('');
  const [cleaningType, setCleaningType] = useState<string>('');
  useEffect(() => {
    const fetchPropertyAndClientInfo = async () => {
      if (task.propertyId) {
        // Fetch property code
        const {
          data: propertyData
        } = await supabase.from('properties').select('codigo, cliente_id').eq('id', task.propertyId).maybeSingle();
        if (propertyData) {
          setPropertyCode(propertyData.codigo || '');

          // Fetch client's cleaning type
          if (propertyData.cliente_id) {
            const {
              data: clientData
            } = await supabase.from('clients').select('tipo_servicio').eq('id', propertyData.cliente_id).maybeSingle();
            if (clientData) {
              setCleaningType(clientData.tipo_servicio || '');
            }
          }
        }
      }
    };
    fetchPropertyAndClientInfo();
  }, [task.propertyId]);
  return <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="property">Propiedad</Label>
          {isEditing ? <Input id="property" value={formData.property || ''} onChange={e => onFieldChange('property', e.target.value)} /> : <p className="text-sm p-2 bg-gray-50 rounded">{task.property}</p>}
        </div>
        
        <div className="space-y-2">
          <Label htmlFor="propertyCode">Código de Propiedad</Label>
          <div className="text-sm p-2 border border-blue-200 bg-neutral-50 rounded-none">
            <span className="text-blue-800 font-medium">{propertyCode || 'Cargando...'}</span>
            
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="address">Dirección</Label>
        {isEditing ? <Input id="address" value={formData.address || ''} onChange={e => onFieldChange('address', e.target.value)} /> : <p className="text-sm p-2 bg-gray-50 rounded">{task.address}</p>}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="startTime">Hora Inicio</Label>
          {isEditing ? <Input id="startTime" type="time" value={formData.startTime || ''} onChange={e => onFieldChange('startTime', e.target.value)} /> : <p className="text-sm p-2 bg-gray-50 rounded">{task.startTime}</p>}
        </div>
        
        <div className="space-y-2">
          <Label htmlFor="endTime">Hora Fin</Label>
          {isEditing ? <Input id="endTime" type="time" value={formData.endTime || ''} onChange={e => onFieldChange('endTime', e.target.value)} /> : <p className="text-sm p-2 bg-gray-50 rounded">{task.endTime}</p>}
        </div>
      </div>

      {isEditing && <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="type">Tipo de Limpieza</Label>
            <div className="text-sm p-2 bg-green-50 rounded border border-green-200">
              <span className="text-green-800 font-medium capitalize">{cleaningType || 'Cargando...'}</span>
              <p className="text-xs text-green-600 mt-1">Tipo autocompletado del cliente</p>
            </div>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="status">Estado</Label>
            <Select value={formData.status} onValueChange={value => onFieldChange('status', value)}>
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
        </div>}
    </div>;
};