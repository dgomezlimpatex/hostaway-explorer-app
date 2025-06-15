
import React from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calendar, Clock, MapPin, User, DollarSign } from 'lucide-react';
import { Task } from '@/types/calendar';
import { CreateReportButton } from './CreateReportButton';

interface TaskCardProps {
  task: Task;
  onShowHistory: (task: Task) => void;
  onCreateReport: (task: Task) => void;
}

export const TaskCard: React.FC<TaskCardProps> = ({ 
  task, 
  onShowHistory,
  onCreateReport,
}) => {
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-green-100 text-green-800 border-green-200';
      case 'in_progress': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'cancelled': return 'bg-red-100 text-red-800 border-red-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
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

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="p-4">
        <div className="flex justify-between items-start mb-3">
          <h3 className="font-semibold text-lg">{task.property}</h3>
          <Badge className={getStatusColor(task.status)}>
            {getStatusText(task.status)}
          </Badge>
        </div>

        <div className="space-y-2 text-sm text-gray-600">
          <div className="flex items-center">
            <Calendar className="h-4 w-4 mr-2" />
            <span>{task.date}</span>
          </div>
          
          <div className="flex items-center">
            <Clock className="h-4 w-4 mr-2" />
            <span>{task.startTime} - {task.endTime}</span>
          </div>

          <div className="flex items-center">
            <MapPin className="h-4 w-4 mr-2" />
            <span className="truncate">{task.address}</span>
          </div>

          {task.cleaner && (
            <div className="flex items-center">
              <User className="h-4 w-4 mr-2" />
              <span>{task.cleaner}</span>
            </div>
          )}

          {task.cost && (
            <div className="flex items-center">
              <DollarSign className="h-4 w-4 mr-2" />
              <span>{task.cost}€</span>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between mt-4 pt-3 border-t">
          <div className="flex items-center space-x-2">
            <Badge variant="outline" className="text-xs">
              {task.type}
            </Badge>
            {task.duration && (
              <Badge variant="outline" className="text-xs">
                {task.duration} min
              </Badge>
            )}
          </div>

          <div className="flex items-center">
            <CreateReportButton 
              task={task} 
              onCreateReport={onCreateReport}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
