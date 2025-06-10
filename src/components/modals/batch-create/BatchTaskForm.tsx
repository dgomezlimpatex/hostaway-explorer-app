
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BatchTaskData } from "./useBatchCreateTask";

interface BatchTaskFormProps {
  batchData: BatchTaskData;
  onFieldChange: (field: keyof BatchTaskData, value: any) => void;
}

export const BatchTaskForm = ({ batchData, onFieldChange }: BatchTaskFormProps) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {/* Fecha */}
      <div className="space-y-2">
        <Label htmlFor="date">Fecha</Label>
        <Input
          id="date"
          type="date"
          value={batchData.date}
          onChange={(e) => onFieldChange('date', e.target.value)}
          required
        />
      </div>

      {/* Tipo de Servicio */}
      <div className="space-y-2">
        <Label htmlFor="type">Tipo de Servicio</Label>
        <Select value={batchData.type} onValueChange={(value) => onFieldChange('type', value)}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="mantenimiento-airbnb">Mantenimiento Airbnb</SelectItem>
            <SelectItem value="limpieza-mantenimiento">Limpieza y Mantenimiento</SelectItem>
            <SelectItem value="mantenimiento-cristaleria">Mantenimiento y Cristalería</SelectItem>
            <SelectItem value="limpieza-entrada-salida">Limpieza Entrada/Salida</SelectItem>
            <SelectItem value="limpieza-profunda">Limpieza Profunda</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Hora de Inicio */}
      <div className="space-y-2">
        <Label htmlFor="startTime">Hora de Inicio</Label>
        <Input
          id="startTime"
          type="time"
          value={batchData.startTime}
          onChange={(e) => onFieldChange('startTime', e.target.value)}
          required
        />
      </div>

      {/* Hora de Fin */}
      <div className="space-y-2">
        <Label htmlFor="endTime">Hora de Fin</Label>
        <Input
          id="endTime"
          type="time"
          value={batchData.endTime}
          onChange={(e) => onFieldChange('endTime', e.target.value)}
        />
      </div>

      {/* Check Out */}
      <div className="space-y-2">
        <Label htmlFor="checkOut">Check Out</Label>
        <Input
          id="checkOut"
          type="time"
          value={batchData.checkOut}
          onChange={(e) => onFieldChange('checkOut', e.target.value)}
        />
      </div>

      {/* Check In */}
      <div className="space-y-2">
        <Label htmlFor="checkIn">Check In</Label>
        <Input
          id="checkIn"
          type="time"
          value={batchData.checkIn}
          onChange={(e) => onFieldChange('checkIn', e.target.value)}
        />
      </div>

      {/* Estado */}
      <div className="space-y-2">
        <Label htmlFor="status">Estado</Label>
        <Select value={batchData.status} onValueChange={(value: any) => onFieldChange('status', value)}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="pending">Pendiente</SelectItem>
            <SelectItem value="in-progress">En Progreso</SelectItem>
            <SelectItem value="completed">Completado</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Método de Pago */}
      <div className="space-y-2">
        <Label htmlFor="metodoPago">Método de Pago</Label>
        <Select value={batchData.metodoPago} onValueChange={(value) => onFieldChange('metodoPago', value)}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="transferencia">Transferencia</SelectItem>
            <SelectItem value="efectivo">Efectivo</SelectItem>
            <SelectItem value="bizum">Bizum</SelectItem>
            <SelectItem value="tarjeta">Tarjeta</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Supervisor */}
      <div className="space-y-2 md:col-span-2">
        <Label htmlFor="supervisor">Supervisor</Label>
        <Input
          id="supervisor"
          type="text"
          value={batchData.supervisor}
          onChange={(e) => onFieldChange('supervisor', e.target.value)}
          placeholder="Nombre del supervisor"
        />
      </div>
    </div>
  );
};
