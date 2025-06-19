
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

  return (
    <Card className="mb-4 hover:shadow-lg transition-all duration-200 border border-gray-200">
      <CardContent className="p-4">
        {/* Header: Property name */}
        <div className="mb-4">
          <h3 className="font-semibold text-lg text-gray-900 leading-tight mb-2">
            {task.property}
          </h3>
          <Badge className={`${getStatusColor(task.status)} px-3 py-1 text-sm font-medium`}>
            {getStatusText(task.status)}
          </Badge>
        </div>

        {/* Main info section */}
        <div className="space-y-3 mb-4">
          {/* Date */}
          <div className="flex items-center text-gray-600">
            <Calendar className="h-4 w-4 mr-3 text-blue-500 flex-shrink-0" />
            <span className="text-sm">{task.date}</span>
          </div>
          
          {/* Time */}
          <div className="flex items-center text-gray-600">
            <Clock className="h-4 w-4 mr-3 text-green-500 flex-shrink-0" />
            <span className="text-sm">{task.startTime} - {task.endTime}</span>
          </div>

          {/* Address */}
          <div className="flex items-start text-gray-600">
            <MapPin className="h-4 w-4 mr-3 mt-0.5 text-orange-500 flex-shrink-0" />
            <span className="text-sm leading-relaxed">{task.address}</span>
          </div>

          {/* Cleaner */}
          {task.cleaner && (
            <div className="flex items-start text-gray-600">
              <User className="h-4 w-4 mr-3 mt-0.5 text-purple-500 flex-shrink-0" />
              <span className="text-sm leading-relaxed">{task.cleaner}</span>
            </div>
          )}

          {/* Cost */}
          {task.cost && (
            <div className="flex items-center text-gray-600">
              <DollarSign className="h-4 w-4 mr-3 text-emerald-500 flex-shrink-0" />
              <span className="text-sm font-medium">{task.cost}€</span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-3 border-t border-gray-100">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="outline" className="text-xs bg-gray-50">
              {task.type}
            </Badge>
            {task.duration && (
              <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700">
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
