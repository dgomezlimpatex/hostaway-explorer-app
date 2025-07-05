import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon, Edit, Save, X } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { Cleaner } from '@/types/calendar';
import { useUpdateCleaner } from '@/hooks/useCleaners';

interface WorkerBasicInfoProps {
  worker: Cleaner;
}

export const WorkerBasicInfo = ({ worker }: WorkerBasicInfoProps) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState({
    contractHoursPerWeek: worker.contractHoursPerWeek || 40,
    hourlyRate: worker.hourlyRate || 0,
    contractType: worker.contractType || 'full-time',
    startDate: worker.startDate ? new Date(worker.startDate) : undefined,
    emergencyContactName: worker.emergencyContactName || '',
    emergencyContactPhone: worker.emergencyContactPhone || ''
  });

  const updateCleaner = useUpdateCleaner();

  // Sincronizar editData cuando cambie el worker
  useEffect(() => {
    setEditData({
      contractHoursPerWeek: worker.contractHoursPerWeek || 40,
      hourlyRate: worker.hourlyRate || 0,
      contractType: worker.contractType || 'full-time',
      startDate: worker.startDate ? new Date(worker.startDate) : undefined,
      emergencyContactName: worker.emergencyContactName || '',
      emergencyContactPhone: worker.emergencyContactPhone || ''
    });
  }, [worker]);

  const handleSave = () => {
    updateCleaner.mutate({
      id: worker.id,
      updates: {
        contractHoursPerWeek: editData.contractHoursPerWeek,
        hourlyRate: editData.hourlyRate,
        contractType: editData.contractType,
        startDate: editData.startDate?.toISOString().split('T')[0],
        emergencyContactName: editData.emergencyContactName,
        emergencyContactPhone: editData.emergencyContactPhone
      }
    });
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditData({
      contractHoursPerWeek: worker.contractHoursPerWeek || 40,
      hourlyRate: worker.hourlyRate || 0,
      contractType: worker.contractType || 'full-time',
      startDate: worker.startDate ? new Date(worker.startDate) : undefined,
      emergencyContactName: worker.emergencyContactName || '',
      emergencyContactPhone: worker.emergencyContactPhone || ''
    });
    setIsEditing(false);
  };

  return (
    <div className="grid gap-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Información Personal</CardTitle>
          {!isEditing ? (
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => setIsEditing(true)}
              className="flex items-center gap-1"
            >
              <Edit className="h-4 w-4" />
              Editar
            </Button>
          ) : (
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={handleSave}
                className="flex items-center gap-1"
                disabled={updateCleaner.isPending}
              >
                <Save className="h-4 w-4" />
                Guardar
              </Button>
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={handleCancel}
                className="flex items-center gap-1"
              >
                <X className="h-4 w-4" />
                Cancelar
              </Button>
            </div>
          )}
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Nombre</Label>
              <Input value={worker.name} readOnly />
            </div>
            <div>
              <Label>Email</Label>
              <Input value={worker.email || ''} readOnly />
            </div>
            <div>
              <Label>Teléfono</Label>
              <Input value={worker.telefono || ''} readOnly />
            </div>
            <div>
              <Label>Horas de Contrato por Semana</Label>
              {isEditing ? (
                <Input
                  type="number"
                  min="1"
                  max="80"
                  value={editData.contractHoursPerWeek}
                  onChange={(e) => setEditData({
                    ...editData,
                    contractHoursPerWeek: parseFloat(e.target.value) || 0
                  })}
                />
              ) : (
                <Input value={`${worker.contractHoursPerWeek || 40}h`} readOnly />
              )}
            </div>
            <div>
              <Label>Tarifa por Hora (€)</Label>
              {isEditing ? (
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={editData.hourlyRate}
                  onChange={(e) => setEditData({
                    ...editData,
                    hourlyRate: parseFloat(e.target.value) || 0
                  })}
                />
              ) : (
                <Input value={worker.hourlyRate ? `€${worker.hourlyRate}` : 'No definida'} readOnly />
              )}
            </div>
            <div>
              <Label>Tipo de Contrato</Label>
              {isEditing ? (
                <Select
                  value={editData.contractType}
                  onValueChange={(value) => setEditData({
                    ...editData,
                    contractType: value
                  })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="full-time">Tiempo Completo</SelectItem>
                    <SelectItem value="part-time">Tiempo Parcial</SelectItem>
                    <SelectItem value="temporary">Temporal</SelectItem>
                    <SelectItem value="freelance">Autónomo</SelectItem>
                  </SelectContent>
                </Select>
              ) : (
                <Input value={
                  worker.contractType === 'full-time' ? 'Tiempo Completo' :
                  worker.contractType === 'part-time' ? 'Tiempo Parcial' :
                  worker.contractType === 'temporary' ? 'Temporal' :
                  worker.contractType === 'freelance' ? 'Autónomo' : 'No definido'
                } readOnly />
              )}
            </div>
            <div>
              <Label>Fecha de Inicio</Label>
              {isEditing ? (
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !editData.startDate && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {editData.startDate ? (
                        format(editData.startDate, "PPP", { locale: es })
                      ) : (
                        <span>Seleccionar fecha</span>
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={editData.startDate}
                      onSelect={(date) => setEditData({
                        ...editData,
                        startDate: date
                      })}
                      disabled={(date) => date > new Date()}
                      initialFocus
                      className="p-3 pointer-events-auto"
                    />
                  </PopoverContent>
                </Popover>
              ) : (
                <Input value={
                  worker.startDate ? 
                    format(new Date(worker.startDate), "PPP", { locale: es }) : 
                    'No definida'
                } readOnly />
              )}
            </div>
            <div>
              <Label>Contacto de Emergencia</Label>
              {isEditing ? (
                <Input
                  value={editData.emergencyContactName}
                  onChange={(e) => setEditData({
                    ...editData,
                    emergencyContactName: e.target.value
                  })}
                  placeholder="Nombre del contacto"
                />
              ) : (
                <Input value={worker.emergencyContactName || 'No definido'} readOnly />
              )}
            </div>
            <div>
              <Label>Teléfono de Emergencia</Label>
              {isEditing ? (
                <Input
                  value={editData.emergencyContactPhone}
                  onChange={(e) => setEditData({
                    ...editData,
                    emergencyContactPhone: e.target.value
                  })}
                  placeholder="Teléfono del contacto"
                />
              ) : (
                <Input value={worker.emergencyContactPhone || 'No definido'} readOnly />
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};