import React, { memo } from 'react';
import { Task } from '@/types/calendar';
import { MapPin, Calendar } from 'lucide-react';

interface CleanerTaskCardProps {
  task: Task;
  onClick: () => void;
}

const CleanerTaskCardComponent: React.FC<CleanerTaskCardProps> = ({
  task,
  onClick
}) => {
  // Calculate duration
  const calculateDuration = () => {
    const [startHour, startMinute] = task.startTime.split(':').map(Number);
    const [endHour, endMinute] = task.endTime.split(':').map(Number);
    const startMinutes = startHour * 60 + startMinute;
    const endMinutes = endHour * 60 + endMinute;
    const durationMinutes = endMinutes - startMinutes;
    
    if (durationMinutes >= 60) {
      const hours = Math.floor(durationMinutes / 60);
      const mins = durationMinutes % 60;
      return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
    }
    return `${durationMinutes}m`;
  };

  // Format date for display
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    // Compare dates (ignoring time)
    const taskDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const todayDate = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const tomorrowDate = new Date(tomorrow.getFullYear(), tomorrow.getMonth(), tomorrow.getDate());
    
    if (taskDate.getTime() === todayDate.getTime()) {
      return 'Hoy';
    } else if (taskDate.getTime() === tomorrowDate.getTime()) {
      return 'Mañana';
    } else {
      return date.toLocaleDateString('es-ES', { 
        weekday: 'short', 
        day: 'numeric', 
        month: 'short' 
      });
    }
  };

  // Get gradient based on status
  const getGradient = () => {
    switch (task.status) {
      case 'completed':
        return 'bg-gradient-to-br from-green-400 to-green-600';
      case 'in-progress':
        return 'bg-gradient-to-br from-blue-400 to-blue-600';
      default:
        return 'bg-gradient-to-br from-amber-400 to-orange-500';
    }
  };

  return (
    <div 
      onClick={onClick}
      className={`${getGradient()} p-6 rounded-3xl shadow-lg cursor-pointer hover:shadow-xl transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] text-white relative overflow-hidden`}
    >
      {/* Background pattern */}
      <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-16 translate-x-16"></div>
      <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/5 rounded-full translate-y-12 -translate-x-12"></div>
      
      <div className="relative z-10">
        {/* Status indicator in top right */}
        <div className="absolute top-0 right-0 w-3 h-3 bg-white rounded-full opacity-80"></div>
        
        {/* Main content */}
        <div className="space-y-4">
          {/* Property name and date */}
          <div className="space-y-2">
            <h3 className="text-2xl font-bold leading-tight">
              {task.property}
            </h3>
            
            {/* Date badge */}
            <div className="flex items-center">
              <div className="bg-white/20 backdrop-blur-sm px-3 py-1 rounded-full flex items-center">
                <Calendar className="h-3 w-3 mr-2 opacity-80" />
                <span className="text-white font-medium text-sm">{formatDate(task.date)}</span>
              </div>
            </div>
          </div>
          
          {/* Property code if available */}
          {task.propertyCode && (
            <p className="text-white/80 text-sm font-medium">
              Código: {task.propertyCode}
            </p>
          )}
          
          {/* Time and duration section */}
          <div className="flex items-center justify-between">
            {/* Start time */}
            <div className="text-left">
              <div className="text-2xl font-bold">{task.startTime}</div>
              <div className="text-white/80 text-sm font-medium">Inicio</div>
            </div>
            
            {/* Duration badge */}
            <div className="bg-white/20 backdrop-blur-sm px-4 py-2 rounded-full">
              <span className="text-white font-bold text-sm">{calculateDuration()}</span>
            </div>
            
            {/* End time */}
            <div className="text-right">
              <div className="text-2xl font-bold">{task.endTime}</div>
              <div className="text-white/80 text-sm font-medium">Fin</div>
            </div>
          </div>
          
          {/* Address if available */}
          {task.address && (
            <div className="flex items-start text-white/90 mt-3">
              <MapPin className="h-4 w-4 mr-2 flex-shrink-0 mt-0.5 opacity-80" />
              <span className="text-sm line-clamp-2 leading-relaxed">
                {task.address}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// Memoize component to prevent unnecessary re-renders
export const CleanerTaskCard = memo(CleanerTaskCardComponent);