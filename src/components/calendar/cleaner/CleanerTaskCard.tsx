import React from 'react';
import { Task } from '@/types/calendar';
import { Clock, MapPin } from 'lucide-react';

interface CleanerTaskCardProps {
  task: Task;
  onClick: (task: Task) => void;
}

export const CleanerTaskCard: React.FC<CleanerTaskCardProps> = ({
  task,
  onClick
}) => {
  return (
    <div 
      onClick={() => onClick(task)}
      className="bg-card p-4 rounded-xl border border-border shadow-sm cursor-pointer hover:shadow-md transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]"
    >
      <div className="space-y-3">
        {/* Property Name and Code */}
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <h3 className="font-semibold text-foreground text-base leading-tight">
              {task.property}
            </h3>
            {task.propertyCode && (
              <p className="text-sm text-muted-foreground mt-1">
                Código: {task.propertyCode}
              </p>
            )}
          </div>
          
          {/* Status Badge */}
          <div className={`px-2 py-1 rounded-full text-xs font-medium ml-3 ${
            task.status === 'completed' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' :
            task.status === 'in-progress' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' :
            'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300'
          }`}>
            {task.status === 'completed' ? 'Completada' :
             task.status === 'in-progress' ? 'En progreso' : 'Pendiente'}
          </div>
        </div>

        {/* Time and Location Info */}
        <div className="space-y-2">
          <div className="flex items-center text-sm text-muted-foreground">
            <Clock className="h-4 w-4 mr-2 flex-shrink-0" />
            <span className="font-medium">
              {task.startTime} - {task.endTime}
            </span>
          </div>
          
          {task.address && (
            <div className="flex items-start text-sm text-muted-foreground">
              <MapPin className="h-4 w-4 mr-2 flex-shrink-0 mt-0.5" />
              <span className="line-clamp-2">
                {task.address}
              </span>
            </div>
          )}
        </div>

        {/* Task Type */}
        <div className="flex items-center justify-between">
          <span className="text-xs bg-muted px-2 py-1 rounded-md text-muted-foreground font-medium">
            {task.type}
          </span>
          
          {/* Check-in/out times */}
          <div className="text-xs text-muted-foreground">
            Check-out: {task.checkOut} • Check-in: {task.checkIn}
          </div>
        </div>
      </div>
    </div>
  );
};