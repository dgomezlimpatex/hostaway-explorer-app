import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { 
  Clock, 
  TrendingUp, 
  TrendingDown, 
  Calendar,
  Filter,
  RefreshCw,
  Plus,
  BarChart3
} from "lucide-react";
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { useTaskTimeSync, useSyncTasksWithTimeLogs, useCreateTimeLogFromTask } from '@/hooks/useTaskTimeSync';
import { TaskTimeBreakdown as TaskTimeBreakdownType } from '@/types/calendar';

interface TaskTimeBreakdownProps {
  workerId: string;
  workerName: string;
  month?: Date;
}

export const TaskTimeBreakdown = ({ workerId, workerName, month }: TaskTimeBreakdownProps) => {
  const [selectedMonth, setSelectedMonth] = useState(month || new Date());
  const [filterType, setFilterType] = useState<string>('all');
  const [isCreateTimeLogOpen, setIsCreateTimeLogOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<any>(null);
  const [actualHours, setActualHours] = useState<number>(2);

  const { taskTimeBreakdown, stats } = useTaskTimeSync(workerId, selectedMonth);
  const syncTasksWithTimeLogs = useSyncTasksWithTimeLogs();
  const createTimeLogFromTask = useCreateTimeLogFromTask();

  // Filter breakdown by type
  const filteredBreakdown = taskTimeBreakdown.filter(item => {
    if (filterType === 'all') return true;
    if (filterType === 'with-logs') return item.timeSpent > 0;
    if (filterType === 'without-logs') return item.timeSpent === 0;
    if (filterType === 'efficient') return item.efficiency >= 90;
    if (filterType === 'inefficient') return item.efficiency < 90;
    return true;
  });

  const handleSyncTasks = () => {
    const monthStart = format(new Date(selectedMonth.getFullYear(), selectedMonth.getMonth(), 1), 'yyyy-MM-dd');
    const monthEnd = format(new Date(selectedMonth.getFullYear(), selectedMonth.getMonth() + 1, 0), 'yyyy-MM-dd');
    
    syncTasksWithTimeLogs.mutate({
      cleanerId: workerId,
      startDate: monthStart,
      endDate: monthEnd
    });
  };

  const handleCreateTimeLog = () => {
    if (!selectedTask) return;

    createTimeLogFromTask.mutate({
      taskId: selectedTask.taskId,
      cleanerId: workerId,
      actualHours,
      notes: `Registro manual para tarea: ${selectedTask.taskName}`
    });

    setIsCreateTimeLogOpen(false);
    setSelectedTask(null);
    setActualHours(2);
  };

  const openCreateTimeLogModal = (task: TaskTimeBreakdownType) => {
    setSelectedTask(task);
    setActualHours(task.scheduledTime);
    setIsCreateTimeLogOpen(true);
  };

  const getEfficiencyBadge = (efficiency: number) => {
    if (efficiency >= 95) {
      return <Badge className="bg-green-100 text-green-800">Excelente</Badge>;
    } else if (efficiency >= 85) {
      return <Badge className="bg-blue-100 text-blue-800">Buena</Badge>;
    } else if (efficiency >= 70) {
      return <Badge variant="outline">Regular</Badge>;
    } else {
      return <Badge variant="destructive">Baja</Badge>;
    }
  };

  const getEfficiencyIcon = (efficiency: number) => {
    return efficiency >= 90 
      ? <TrendingUp className="h-4 w-4 text-green-600" />
      : <TrendingDown className="h-4 w-4 text-red-600" />;
  };

  const navigateMonth = (direction: 'prev' | 'next') => {
    const newMonth = new Date(selectedMonth);
    newMonth.setMonth(newMonth.getMonth() + (direction === 'next' ? 1 : -1));
    setSelectedMonth(newMonth);
  };

  return (
    <div className="space-y-6">
      {/* Header with stats */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Desglose de Tiempo por Tarea</h3>
          <p className="text-sm text-muted-foreground">{workerName}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigateMonth('prev')}
          >
            ← 
          </Button>
          <span className="text-sm font-medium px-3">
            {format(selectedMonth, 'MMMM yyyy', { locale: es })}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigateMonth('next')}
          >
            →
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleSyncTasks}
            disabled={syncTasksWithTimeLogs.isPending}
            className="flex items-center gap-1"
          >
            <RefreshCw className="h-4 w-4" />
            Sincronizar
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-primary">
              {stats.totalTimeSpent.toFixed(1)}h
            </div>
            <div className="text-xs text-muted-foreground">Tiempo Total</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-green-600">
              {stats.averageEfficiency.toFixed(0)}%
            </div>
            <div className="text-xs text-muted-foreground">Eficiencia Media</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-blue-600">
              {stats.tasksWithTimeLogs}
            </div>
            <div className="text-xs text-muted-foreground">Con Registros</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-orange-600">
              {stats.tasksWithoutTimeLogs}
            </div>
            <div className="text-xs text-muted-foreground">Sin Registros</div>
          </CardContent>
        </Card>
      </div>

      {/* Filters and Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Tareas del Mes
            </CardTitle>
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <Select value={filterType} onValueChange={setFilterType}>
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="Filtrar por..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas las tareas</SelectItem>
                  <SelectItem value="with-logs">Con registros</SelectItem>
                  <SelectItem value="without-logs">Sin registros</SelectItem>
                  <SelectItem value="efficient">Eficientes (≥90%)</SelectItem>
                  <SelectItem value="inefficient">Ineficientes (&lt;90%)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fecha</TableHead>
                <TableHead>Tarea</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Tiempo Planificado</TableHead>
                <TableHead>Tiempo Real</TableHead>
                <TableHead>Eficiencia</TableHead>
                <TableHead>Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredBreakdown.map((item) => (
                <TableRow key={item.taskId}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      {format(new Date(item.date), 'dd/MM', { locale: es })}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="font-medium">{item.taskName}</div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{item.taskType}</Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Clock className="h-4 w-4 text-muted-foreground" />
                      {item.scheduledTime.toFixed(1)}h
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Clock className="h-4 w-4 text-muted-foreground" />
                      {item.timeSpent > 0 ? `${item.timeSpent.toFixed(1)}h` : '-'}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {getEfficiencyIcon(item.efficiency)}
                      <span>{item.efficiency.toFixed(0)}%</span>
                      {getEfficiencyBadge(item.efficiency)}
                    </div>
                  </TableCell>
                  <TableCell>
                    {item.timeSpent === 0 && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => openCreateTimeLogModal(item)}
                        className="flex items-center gap-1"
                      >
                        <Plus className="h-3 w-3" />
                        Registrar
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {filteredBreakdown.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    No hay tareas que coincidan con el filtro seleccionado
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Create Time Log Modal */}
      <Dialog open={isCreateTimeLogOpen} onOpenChange={setIsCreateTimeLogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Registrar Tiempo para Tarea</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {selectedTask && (
              <div className="p-3 bg-muted rounded-lg">
                <p className="font-medium">{selectedTask.taskName}</p>
                <p className="text-sm text-muted-foreground">
                  {format(new Date(selectedTask.date), 'dd/MM/yyyy', { locale: es })} - 
                  Tiempo planificado: {selectedTask.scheduledTime.toFixed(1)}h
                </p>
              </div>
            )}
            <div>
              <Label htmlFor="actualHours">Tiempo Real Trabajado (horas)</Label>
              <Input
                id="actualHours"
                type="number"
                min="0.1"
                step="0.1"
                value={actualHours}
                onChange={(e) => setActualHours(parseFloat(e.target.value) || 0)}
              />
            </div>
            <div className="flex gap-2">
              <Button onClick={() => setIsCreateTimeLogOpen(false)} variant="outline" className="flex-1">
                Cancelar
              </Button>
              <Button onClick={handleCreateTimeLog} className="flex-1">
                Crear Registro
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};