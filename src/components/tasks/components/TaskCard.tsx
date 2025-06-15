import React from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Clock, MapPin, User, Euro, Calendar, Edit2, Trash2, UserPlus, History } from "lucide-react";
import { Task } from "@/types/calendar";

interface TaskCardProps {
  task: Task;
  onEditTask: (task: Task) => void;
  onDeleteTask: (taskId: string) => void;
  onQuickStatusChange: (taskId: string, status: string) => void;
  onAssignCleaner: (task: Task) => void;
  onShowHistory?: (task: Task) => void;
  getStatusColor: (status: string) => string;
  getStatusText: (status: string) => string;
}

export const TaskCard = React.memo(({ 
  task, 
  onEditTask, 
  onDeleteTask, 
  onQuickStatusChange, 
  onAssignCleaner, 
  onShowHistory,
  getStatusColor,
  getStatusText 
}: TaskCardProps) => {
  const serviceTypeLabels = React.useMemo(() => ({
    'limpieza-mantenimiento': 'Limpieza de Mantenimiento',
    'mantenimiento-cristaleria': 'Mantenimiento de Cristalería',
    'mantenimiento-airbnb': 'Mantenimiento Airbnb',
    'limpieza-puesta-punto': 'Limpieza de Puesta a Punto',
    'limpieza-final-obra': 'Limpieza Final de Obra',
    'check-in': 'Check In',
    'desplazamiento': 'Desplazamiento',
    'limpieza-especial': 'Limpieza Especial',
    'trabajo-extraordinario': 'Trabajo Extraordinario'
  }), []);

  const handleEditClick = React.useCallback(() => {
    onEditTask(task);
  }, [onEditTask, task]);

  const handleDeleteClick = React.useCallback(() => {
    onDeleteTask(task.id);
  }, [onDeleteTask, task.id]);

  const handleAssignClick = React.useCallback(() => {
    onAssignCleaner(task);
  }, [onAssignCleaner, task]);

  const handleHistoryClick = React.useCallback(() => {
    onShowHistory?.(task);
  }, [onShowHistory, task]);

  const handleStatusChange = React.useCallback((status: string) => {
    onQuickStatusChange(task.id, status);
  }, [onQuickStatusChange, task.id]);

  return (
    <Card className="hover:shadow-md transition-shadow duration-200">
      <CardContent className="p-4">
        <div className="flex items-start justify-between mb-3">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="font-semibold text-lg text-gray-900 truncate">{task.property}</h3>
              <Badge 
                variant="secondary"
                className={`text-xs ${getStatusColor(task.status)}`}
              >
                {getStatusText(task.status)}
              </Badge>
            </div>
            <div className="flex items-center gap-1 text-sm text-gray-600 mb-2">
              <MapPin className="h-3 w-3" />
              <span className="truncate">{task.address}</span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 text-sm mb-3">
          <div className="flex items-center gap-1">
            <Clock className="h-3 w-3 text-gray-400" />
            <span>{task.startTime} - {task.endTime}</span>
          </div>
          <div className="flex items-center gap-1">
            <Calendar className="h-3 w-3 text-gray-400" />
            <span>{new Date(task.date).toLocaleDateString()}</span>
          </div>
          <div className="flex items-center gap-1">
            <User className="h-3 w-3 text-gray-400" />
            <span>{task.cleaner || 'Sin asignar'}</span>
          </div>
          <div className="flex items-center gap-1">
            <Euro className="h-3 w-3 text-gray-400" />
            <span>{task.cost?.toFixed(2) || 'N/A'}€</span>
          </div>
        </div>

        <div className="flex items-center gap-1 mb-3">
          <Badge variant="outline" className="text-xs">
            {serviceTypeLabels[task.type as keyof typeof serviceTypeLabels] || task.type}
          </Badge>
        </div>

        {/* Quick Actions */}
        <div className="flex items-center justify-between">
          <div className="flex gap-1">
            {task.status === 'pending' && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleStatusChange('in-progress')}
                className="h-7 px-2 text-xs"
              >
                Iniciar
              </Button>
            )}
            {task.status === 'in-progress' && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleStatusChange('completed')}
                className="h-7 px-2 text-xs"
              >
                Completar
              </Button>
            )}
          </div>
          
          <div className="flex gap-1">
            {onShowHistory && (
              <Button 
                size="sm" 
                variant="ghost" 
                onClick={handleHistoryClick}
                className="h-7 w-7 p-0"
              >
                <History className="h-3 w-3" />
              </Button>
            )}
            {!task.cleaner && (
              <Button 
                size="sm" 
                variant="ghost" 
                onClick={handleAssignClick}
                className="h-7 w-7 p-0"
              >
                <UserPlus className="h-3 w-3" />
              </Button>
            )}
            <Button 
              size="sm" 
              variant="ghost" 
              onClick={handleEditClick}
              className="h-7 w-7 p-0"
            >
              <Edit2 className="h-3 w-3" />
            </Button>
            <Button 
              size="sm" 
              variant="ghost" 
              onClick={handleDeleteClick}
              className="h-7 w-7 p-0 text-red-600 hover:text-red-700"
            >
              <Trash2 className="h-3 w-3" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
});

TaskCard.displayName = 'TaskCard';
