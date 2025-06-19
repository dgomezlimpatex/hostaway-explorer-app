import React from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar, Clock, MapPin, User, DollarSign, Edit, FileText, MoreVertical } from 'lucide-react';
import { Task } from '@/types/calendar';
import { CreateReportButton } from './CreateReportButton';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface TaskCardProps {
  task: Task;
  onShowHistory: (task: Task) => void;
  onCreateReport: (task: Task) => void;
  onEditTask?: (task: Task) => void;
}

export const TaskCard: React.FC<TaskCardProps> = ({ 
  task, 
  onShowHistory,
  onCreateReport,
  onEditTask,
}) => {
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-green-100 text-green-800 border-green-200';
      case 'in_progress': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'cancelled': return 'bg-red-100 text-red-800 border-red-200';
      default: return 'bg-yellow-100 text-yellow-800 border-yellow-200';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'pending': return 'Pendiente';
      case 'in_progress': return 'En Progreso';
      case 'completed': return 'Completada';
      case 'cancelled': return 'Cancelada';
      default: return status;
    }
  };

  const handleEdit = () => {
    if (onEditTask) {
      onEditTask(task);
    }
  };

  const handleHistory = () => {
    onShowHistory(task);
  };

  return (
    <Card className="group hover:shadow-md transition-all duration-200 border border-gray-200 bg-white relative">
      <CardContent className="p-4">
        {/* History button in top right corner */}
        <Button 
          variant="ghost" 
          size="sm"
          onClick={handleHistory}
          className="absolute top-2 right-2 h-8 w-8 p-0 opacity-70 hover:opacity-100 transition-opacity"
        >
          <FileText className="h-4 w-4" />
        </Button>

        {/* Header section with property name and status */}
        <div className="mb-3 pr-10">
          <h3 className="font-semibold text-lg text-gray-900 leading-tight mb-2">
            {task.property}
          </h3>
          <div className="flex items-center gap-2 flex-wrap">
            <Badge className={`${getStatusColor(task.status)} text-xs font-medium`}>
              {getStatusText(task.status)}
            </Badge>
            <Badge variant="outline" className="text-xs bg-gray-50">
              {task.type}
            </Badge>
            {task.duration && (
              <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700">
                {task.duration} min
              </Badge>
            )}
          </div>
        </div>

        {/* Date section */}
        <div className="mb-3">
          <div className="flex items-center text-gray-600">
            <Calendar className="h-4 w-4 mr-2 text-blue-500 flex-shrink-0" />
            <span className="text-sm">{task.date}</span>
          </div>
        </div>

        {/* Time and cost section - side by side */}
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center text-gray-600">
            <Clock className="h-4 w-4 mr-2 text-green-500 flex-shrink-0" />
            <span className="text-sm">{task.startTime} - {task.endTime}</span>
          </div>
          {task.cost && (
            <div className="flex items-center text-gray-600">
              <DollarSign className="h-4 w-4 mr-1 text-emerald-500 flex-shrink-0" />
              <span className="text-sm font-medium">{task.cost}€</span>
            </div>
          )}
        </div>

        {/* Address section */}
        <div className="mb-3">
          <div className="flex items-start text-gray-600">
            <MapPin className="h-4 w-4 mr-2 mt-0.5 text-orange-500 flex-shrink-0" />
            <span className="text-sm leading-relaxed break-words">{task.address}</span>
          </div>
        </div>

        {/* Cleaner section */}
        {task.cleaner && (
          <div className="mb-4">
            <div className="flex items-center text-gray-600">
              <User className="h-4 w-4 mr-2 text-purple-500 flex-shrink-0" />
              <span className="text-sm">{task.cleaner}</span>
            </div>
          </div>
        )}

        {/* Actions footer */}
        <div className="flex items-center justify-between pt-3 border-t border-gray-100">
          <div className="flex items-center gap-2">
            {onEditTask && (
              <Button 
                variant="outline" 
                size="sm" 
                onClick={handleEdit}
                className="text-xs"
              >
                <Edit className="h-3 w-3 mr-1" />
                Editar
              </Button>
            )}
          </div>

          <CreateReportButton 
            task={task} 
            onCreateReport={onCreateReport}
          />
        </div>
      </CardContent>
    </Card>
  );
};
