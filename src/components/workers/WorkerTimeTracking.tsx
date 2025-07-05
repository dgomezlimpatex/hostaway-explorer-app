import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { Clock, Plus, CheckCircle, XCircle, Edit } from "lucide-react";
import { format, startOfWeek, endOfWeek } from "date-fns";
import { es } from "date-fns/locale";
import { useTimeLogs, useCreateTimeLog, useUpdateTimeLog, useApproveTimeLog, useRejectTimeLog, useWeeklyHours } from '@/hooks/useTimeLogs';
import { useAuth } from '@/hooks/useAuth';

interface WorkerTimeTrackingProps {
  workerId: string;
}

interface TimeLogFormData {
  date: string;
  clockIn: string;
  clockOut: string;
  breakDurationMinutes: number;
  notes: string;
}

export const WorkerTimeTracking = ({ workerId }: WorkerTimeTrackingProps) => {
  const [selectedWeek, setSelectedWeek] = useState(new Date());
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingLog, setEditingLog] = useState<any>(null);
  const [formData, setFormData] = useState<TimeLogFormData>({
    date: format(new Date(), 'yyyy-MM-dd'),
    clockIn: '09:00',
    clockOut: '17:00',
    breakDurationMinutes: 30,
    notes: ''
  });

  const { userRole } = useAuth();
  const canManageTimeLogs = ['admin', 'manager', 'supervisor'].includes(userRole || '');

  // Obtener el rango de la semana
  const weekStart = startOfWeek(selectedWeek, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(selectedWeek, { weekStartsOn: 1 });

  const { data: timeLogs = [], isLoading } = useTimeLogs(
    workerId,
    format(weekStart, 'yyyy-MM-dd'),
    format(weekEnd, 'yyyy-MM-dd')
  );

  const { data: weeklyHours } = useWeeklyHours(workerId, format(weekStart, 'yyyy-MM-dd'));

  const createTimeLog = useCreateTimeLog();
  const updateTimeLog = useUpdateTimeLog();
  const approveTimeLog = useApproveTimeLog();
  const rejectTimeLog = useRejectTimeLog();

  const calculateTotalHours = (clockIn: string, clockOut: string, breakMinutes: number) => {
    const [inHour, inMin] = clockIn.split(':').map(Number);
    const [outHour, outMin] = clockOut.split(':').map(Number);
    
    const inTime = inHour * 60 + inMin;
    const outTime = outHour * 60 + outMin;
    
    const totalMinutes = outTime - inTime - breakMinutes;
    return Math.max(0, totalMinutes / 60);
  };

  const handleCreateTimeLog = () => {
    const totalHours = calculateTotalHours(
      formData.clockIn, 
      formData.clockOut, 
      formData.breakDurationMinutes
    );

    createTimeLog.mutate({
      cleanerId: workerId,
      date: formData.date,
      clockIn: `${formData.date}T${formData.clockIn}:00`,
      clockOut: `${formData.date}T${formData.clockOut}:00`,
      breakDurationMinutes: formData.breakDurationMinutes,
      notes: formData.notes
    });

    setIsCreateModalOpen(false);
    resetForm();
  };

  const handleUpdateTimeLog = () => {
    if (!editingLog) return;

    updateTimeLog.mutate({
      id: editingLog.id,
      updates: {
        clockIn: `${formData.date}T${formData.clockIn}:00`,
        clockOut: `${formData.date}T${formData.clockOut}:00`,
        breakDurationMinutes: formData.breakDurationMinutes,
        notes: formData.notes
      }
    });

    setEditingLog(null);
    resetForm();
  };

  const resetForm = () => {
    setFormData({
      date: format(new Date(), 'yyyy-MM-dd'),
      clockIn: '09:00',
      clockOut: '17:00',
      breakDurationMinutes: 30,
      notes: ''
    });
  };

  const openEditModal = (log: any) => {
    setEditingLog(log);
    setFormData({
      date: log.date,
      clockIn: log.clockIn ? format(new Date(log.clockIn), 'HH:mm') : '09:00',
      clockOut: log.clockOut ? format(new Date(log.clockOut), 'HH:mm') : '17:00',
      breakDurationMinutes: log.breakDurationMinutes || 30,
      notes: log.notes || ''
    });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'approved':
        return <Badge className="bg-green-100 text-green-800">Aprobado</Badge>;
      case 'rejected':
        return <Badge className="bg-red-100 text-red-800">Rechazado</Badge>;
      default:
        return <Badge className="bg-yellow-100 text-yellow-800">Pendiente</Badge>;
    }
  };

  const navigateWeek = (direction: 'prev' | 'next') => {
    const newWeek = new Date(selectedWeek);
    newWeek.setDate(newWeek.getDate() + (direction === 'next' ? 7 : -7));
    setSelectedWeek(newWeek);
  };

  return (
    <div className="space-y-4">
      {/* Resumen semanal */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-primary">
              {weeklyHours?.total.toFixed(1) || '0.0'}h
            </div>
            <div className="text-sm text-muted-foreground">Total Semana</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-green-600">
              {weeklyHours?.regular.toFixed(1) || '0.0'}h
            </div>
            <div className="text-sm text-muted-foreground">Horas Regulares</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-orange-600">
              {weeklyHours?.overtime.toFixed(1) || '0.0'}h
            </div>
            <div className="text-sm text-muted-foreground">Horas Extra</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-blue-600">
              {timeLogs.filter(log => log.status === 'pending').length}
            </div>
            <div className="text-sm text-muted-foreground">Pendientes</div>
          </CardContent>
        </Card>
      </div>

      {/* Control de tiempo */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Registros de Tiempo
            </CardTitle>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigateWeek('prev')}
              >
                ← Anterior
              </Button>
              <span className="text-sm font-medium">
                {format(weekStart, 'dd MMM', { locale: es })} - {format(weekEnd, 'dd MMM yyyy', { locale: es })}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigateWeek('next')}
              >
                Siguiente →
              </Button>
              <Dialog open={isCreateModalOpen} onOpenChange={setIsCreateModalOpen}>
                <DialogTrigger asChild>
                  <Button className="flex items-center gap-1">
                    <Plus className="h-4 w-4" />
                    Nuevo Registro
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Crear Registro de Tiempo</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div>
                      <Label>Fecha</Label>
                      <Input
                        type="date"
                        value={formData.date}
                        onChange={(e) => setFormData({
                          ...formData, 
                          date: e.target.value
                        })}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label>Hora Entrada</Label>
                        <Input
                          type="time"
                          value={formData.clockIn}
                          onChange={(e) => setFormData({
                            ...formData, 
                            clockIn: e.target.value
                          })}
                        />
                      </div>
                      <div>
                        <Label>Hora Salida</Label>
                        <Input
                          type="time"
                          value={formData.clockOut}
                          onChange={(e) => setFormData({
                            ...formData, 
                            clockOut: e.target.value
                          })}
                        />
                      </div>
                    </div>
                    <div>
                      <Label>Descanso (mins)</Label>
                      <Input
                        type="number"
                        min="0"
                        value={formData.breakDurationMinutes}
                        onChange={(e) => setFormData({
                          ...formData, 
                          breakDurationMinutes: parseInt(e.target.value) || 0
                        })}
                      />
                    </div>
                    <div>
                      <Label>Notas</Label>
                      <Textarea
                        value={formData.notes}
                        onChange={(e) => setFormData({
                          ...formData, 
                          notes: e.target.value
                        })}
                        placeholder="Notas opcionales..."
                      />
                    </div>
                    <div className="text-sm text-muted-foreground">
                      Total horas: {calculateTotalHours(
                        formData.clockIn, 
                        formData.clockOut, 
                        formData.breakDurationMinutes
                      ).toFixed(2)}h
                    </div>
                    <Button onClick={handleCreateTimeLog} className="w-full">
                      Crear Registro
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fecha</TableHead>
                <TableHead>Entrada</TableHead>
                <TableHead>Salida</TableHead>
                <TableHead>Descanso</TableHead>
                <TableHead>Total</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {timeLogs.map((log) => (
                <TableRow key={log.id}>
                  <TableCell>
                    {format(new Date(log.date), 'dd/MM/yyyy', { locale: es })}
                  </TableCell>
                  <TableCell>
                    {log.clockIn ? format(new Date(log.clockIn), 'HH:mm') : '-'}
                  </TableCell>
                  <TableCell>
                    {log.clockOut ? format(new Date(log.clockOut), 'HH:mm') : '-'}
                  </TableCell>
                  <TableCell>{log.breakDurationMinutes}min</TableCell>
                  <TableCell>{log.totalHours.toFixed(2)}h</TableCell>
                  <TableCell>{getStatusBadge(log.status)}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openEditModal(log)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      {canManageTimeLogs && log.status === 'pending' && (
                        <>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => approveTimeLog.mutate({
                              id: log.id,
                              approvedBy: 'current-user'
                            })}
                            className="text-green-600"
                          >
                            <CheckCircle className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => rejectTimeLog.mutate({
                              id: log.id,
                              approvedBy: 'current-user'
                            })}
                            className="text-red-600"
                          >
                            <XCircle className="h-4 w-4" />
                          </Button>
                        </>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {timeLogs.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    No hay registros de tiempo para esta semana
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Modal de edición */}
      <Dialog open={!!editingLog} onOpenChange={(open) => !open && setEditingLog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Registro de Tiempo</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Fecha</Label>
              <Input
                type="date"
                value={formData.date}
                onChange={(e) => setFormData({
                  ...formData, 
                  date: e.target.value
                })}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Hora Entrada</Label>
                <Input
                  type="time"
                  value={formData.clockIn}
                  onChange={(e) => setFormData({
                    ...formData, 
                    clockIn: e.target.value
                  })}
                />
              </div>
              <div>
                <Label>Hora Salida</Label>
                <Input
                  type="time"
                  value={formData.clockOut}
                  onChange={(e) => setFormData({
                    ...formData, 
                    clockOut: e.target.value
                  })}
                />
              </div>
            </div>
            <div>
              <Label>Descanso (mins)</Label>
              <Input
                type="number"
                min="0"
                value={formData.breakDurationMinutes}
                onChange={(e) => setFormData({
                  ...formData, 
                  breakDurationMinutes: parseInt(e.target.value) || 0
                })}
              />
            </div>
            <div>
              <Label>Notas</Label>
              <Textarea
                value={formData.notes}
                onChange={(e) => setFormData({
                  ...formData, 
                  notes: e.target.value
                })}
                placeholder="Notas opcionales..."
              />
            </div>
            <div className="text-sm text-muted-foreground">
              Total horas: {calculateTotalHours(
                formData.clockIn, 
                formData.clockOut, 
                formData.breakDurationMinutes
              ).toFixed(2)}h
            </div>
            <Button onClick={handleUpdateTimeLog} className="w-full">
              Actualizar Registro
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};