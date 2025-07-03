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
      className="bg-gradient-to-br from-card to-card/80 p-5 rounded-2xl border border-border/50 shadow-lg cursor-pointer hover:shadow-xl transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] backdrop-blur-sm"
    >
      <div className="space-y-4">
        {/* Property Name and Code */}
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <h3 className="font-bold text-foreground text-lg leading-tight">
              {task.property}
            </h3>
            {task.propertyCode && (
              <p className="text-sm text-muted-foreground mt-1 font-medium">
                Código: {task.propertyCode}
              </p>
            )}
          </div>
          
          {/* Status Badge */}
          <div className={`px-3 py-1.5 rounded-full text-xs font-bold ml-3 shadow-sm ${
            task.status === 'completed' ? 'bg-green-500/20 text-green-600 border border-green-500/30' :
            task.status === 'in-progress' ? 'bg-blue-500/20 text-blue-600 border border-blue-500/30' :
            'bg-amber-500/20 text-amber-600 border border-amber-500/30'
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