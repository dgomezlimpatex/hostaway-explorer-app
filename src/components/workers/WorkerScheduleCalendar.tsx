import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Clock, Plus, Edit, Trash2 } from "lucide-react";
import { format, startOfWeek, endOfWeek, eachDayOfInterval, isSameDay } from "date-fns";
import { es } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { useWorkSchedule, useCreateWorkSchedule, useUpdateWorkSchedule, useDeleteWorkSchedule } from '@/hooks/useWorkSchedule';

interface WorkerScheduleCalendarProps {
  workerId: string;
}

interface ScheduleFormData {
  scheduledStartTime: string;
  scheduledEndTime: string;
  isWorkingDay: boolean;
  scheduleType: 'regular' | 'overtime' | 'holiday';
  notes: string;
}

export const WorkerScheduleCalendar = ({ workerId }: WorkerScheduleCalendarProps) => {
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState<any>(null);
  const [formData, setFormData] = useState<ScheduleFormData>({
    scheduledStartTime: '09:00',
    scheduledEndTime: '17:00',
    isWorkingDay: true,
    scheduleType: 'regular',
    notes: ''
  });

  // Obtener el rango de la semana actual
  const weekStart = startOfWeek(selectedDate, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(selectedDate, { weekStartsOn: 1 });
  const weekDays = eachDayOfInterval({ start: weekStart, end: weekEnd });

  const { data: schedules = [], isLoading } = useWorkSchedule(
    workerId,
    format(weekStart, 'yyyy-MM-dd'),
    format(weekEnd, 'yyyy-MM-dd')
  );

  const createSchedule = useCreateWorkSchedule();
  const updateSchedule = useUpdateWorkSchedule();
  const deleteSchedule = useDeleteWorkSchedule();

  const getScheduleForDate = (date: Date) => {
    return schedules.find(schedule => 
      isSameDay(new Date(schedule.date), date)
    );
  };

  const handleCreateSchedule = () => {
    if (!selectedDate) return;

    createSchedule.mutate({
      cleanerId: workerId,
      date: format(selectedDate, 'yyyy-MM-dd'),
      ...formData
    });

    setIsCreateModalOpen(false);
    resetForm();
  };

  const handleUpdateSchedule = () => {
    if (!editingSchedule) return;

    updateSchedule.mutate({
      id: editingSchedule.id,
      updates: formData
    });

    setEditingSchedule(null);
    resetForm();
  };

  const handleDeleteSchedule = (scheduleId: string) => {
    deleteSchedule.mutate(scheduleId);
  };

  const resetForm = () => {
    setFormData({
      scheduledStartTime: '09:00',
      scheduledEndTime: '17:00',
      isWorkingDay: true,
      scheduleType: 'regular',
      notes: ''
    });
  };

  const openEditModal = (schedule: any) => {
    setEditingSchedule(schedule);
    setFormData({
      scheduledStartTime: schedule.scheduledStartTime,
      scheduledEndTime: schedule.scheduledEndTime,
      isWorkingDay: schedule.isWorkingDay,
      scheduleType: schedule.scheduleType,
      notes: schedule.notes || ''
    });
  };

  const getScheduleTypeColor = (type: string) => {
    switch (type) {
      case 'overtime': return 'bg-orange-100 text-orange-800';
      case 'holiday': return 'bg-red-100 text-red-800';
      default: return 'bg-green-100 text-green-800';
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Calendario de Horarios
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Calendario */}
            <div>
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={(date) => date && setSelectedDate(date)}
                className="rounded-md border pointer-events-auto"
                locale={es}
              />
            </div>

            {/* Vista semanal */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-medium">
                  Semana del {format(weekStart, 'dd MMM', { locale: es })} - {format(weekEnd, 'dd MMM yyyy', { locale: es })}
                </h3>
                <Dialog open={isCreateModalOpen} onOpenChange={setIsCreateModalOpen}>
                  <DialogTrigger asChild>
                    <Button size="sm" className="flex items-center gap-1">
                      <Plus className="h-4 w-4" />
                      Añadir Horario
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>
                        Crear Horario - {selectedDate && format(selectedDate, 'PPP', { locale: es })}
                      </DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label>Hora Inicio</Label>
                          <Input
                            type="time"
                            value={formData.scheduledStartTime}
                            onChange={(e) => setFormData({
                              ...formData, 
                              scheduledStartTime: e.target.value
                            })}
                          />
                        </div>
                        <div>
                          <Label>Hora Fin</Label>
                          <Input
                            type="time"
                            value={formData.scheduledEndTime}
                            onChange={(e) => setFormData({
                              ...formData, 
                              scheduledEndTime: e.target.value
                            })}
                          />
                        </div>
                      </div>
                      <div>
                        <Label>Tipo de Horario</Label>
                        <Select
                          value={formData.scheduleType}
                          onValueChange={(value: any) => setFormData({
                            ...formData, 
                            scheduleType: value
                          })}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="regular">Regular</SelectItem>
                            <SelectItem value="overtime">Horas Extra</SelectItem>
                            <SelectItem value="holiday">Festivo</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label>Notas</Label>
                        <Input
                          value={formData.notes}
                          onChange={(e) => setFormData({
                            ...formData, 
                            notes: e.target.value
                          })}
                          placeholder="Notas opcionales"
                        />
                      </div>
                      <Button onClick={handleCreateSchedule} className="w-full">
                        Crear Horario
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>

              {/* Lista de días de la semana */}
              <div className="space-y-2">
                {weekDays.map((day) => {
                  const schedule = getScheduleForDate(day);
                  const isSelected = isSameDay(day, selectedDate);
                  
                  return (
                    <div
                      key={day.toISOString()}
                      className={cn(
                        "p-3 rounded-lg border cursor-pointer transition-colors",
                        isSelected ? "border-primary bg-primary/5" : "hover:bg-muted"
                      )}
                      onClick={() => setSelectedDate(day)}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="font-medium">
                            {format(day, 'EEEE dd', { locale: es })}
                          </div>
                          {schedule ? (
                            <div className="text-sm text-muted-foreground">
                              {schedule.scheduledStartTime} - {schedule.scheduledEndTime}
                            </div>
                          ) : (
                            <div className="text-sm text-muted-foreground">
                              Sin horario
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          {schedule && (
                            <>
                              <Badge className={cn("text-xs", getScheduleTypeColor(schedule.scheduleType))}>
                                {schedule.scheduleType === 'regular' ? 'Regular' :
                                 schedule.scheduleType === 'overtime' ? 'Extra' : 'Festivo'}
                              </Badge>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  openEditModal(schedule);
                                }}
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeleteSchedule(schedule.id);
                                }}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Modal de edición */}
      <Dialog open={!!editingSchedule} onOpenChange={(open) => !open && setEditingSchedule(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Editar Horario - {editingSchedule && format(new Date(editingSchedule.date), 'PPP', { locale: es })}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Hora Inicio</Label>
                <Input
                  type="time"
                  value={formData.scheduledStartTime}
                  onChange={(e) => setFormData({
                    ...formData, 
                    scheduledStartTime: e.target.value
                  })}
                />
              </div>
              <div>
                <Label>Hora Fin</Label>
                <Input
                  type="time"
                  value={formData.scheduledEndTime}
                  onChange={(e) => setFormData({
                    ...formData, 
                    scheduledEndTime: e.target.value
                  })}
                />
              </div>
            </div>
            <div>
              <Label>Tipo de Horario</Label>
              <Select
                value={formData.scheduleType}
                onValueChange={(value: any) => setFormData({
                  ...formData, 
                  scheduleType: value
                })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="regular">Regular</SelectItem>
                  <SelectItem value="overtime">Horas Extra</SelectItem>
                  <SelectItem value="holiday">Festivo</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Notas</Label>
              <Input
                value={formData.notes}
                onChange={(e) => setFormData({
                  ...formData, 
                  notes: e.target.value
                })}
                placeholder="Notas opcionales"
              />
            </div>
            <Button onClick={handleUpdateSchedule} className="w-full">
              Actualizar Horario
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};