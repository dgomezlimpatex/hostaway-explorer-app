import React, { memo, useMemo } from 'react';
import { Task } from '@/types/calendar';
import { CheckCircle2, Clock, ArrowRight } from 'lucide-react';

interface CleanerTaskSummaryProps {
  todayTasks: Task[];
  tomorrowTasks: Task[];
}

const CleanerTaskSummaryComponent: React.FC<CleanerTaskSummaryProps> = ({
  todayTasks,
  tomorrowTasks
}) => {
  // Calculate completed and pending tasks
  const { completedToday, pendingToday, totalHoursToday } = useMemo(() => {
    const completed = todayTasks.filter(t => t.status === 'completed').length;
    const pending = todayTasks.filter(t => t.status !== 'completed').length;
    
    // Calculate total hours for today
    const totalMinutes = todayTasks.reduce((acc, task) => {
      const [startHour, startMinute] = task.startTime.split(':').map(Number);
      const [endHour, endMinute] = task.endTime.split(':').map(Number);
      const startMins = startHour * 60 + startMinute;
      const endMins = endHour * 60 + endMinute;
      return acc + (endMins - startMins);
    }, 0);
    
    const hours = Math.floor(totalMinutes / 60);
    const mins = totalMinutes % 60;
    const totalHours = mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
    
    return { completedToday: completed, pendingToday: pending, totalHoursToday: totalHours };
  }, [todayTasks]);

  return (
    <div className="p-4 space-y-3 bg-gradient-to-br from-muted/20 to-muted/40 border-b border-border/50">
      {/* Today's summary */}
      <div className="flex items-center gap-3">
        {/* Pending tasks */}
        <div className="flex-1 bg-background/60 backdrop-blur-sm rounded-2xl p-3 border border-border/30">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-full bg-amber-500/20 flex items-center justify-center">
              <Clock className="h-4 w-4 text-amber-600" />
            </div>
            <div>
              <div className="text-xl font-bold text-foreground">{pendingToday}</div>
              <div className="text-xs text-muted-foreground">Pendientes</div>
            </div>
          </div>
        </div>

        {/* Completed tasks */}
        <div className="flex-1 bg-background/60 backdrop-blur-sm rounded-2xl p-3 border border-border/30">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-full bg-green-500/20 flex items-center justify-center">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
            </div>
            <div>
              <div className="text-xl font-bold text-foreground">{completedToday}</div>
              <div className="text-xs text-muted-foreground">Completadas</div>
            </div>
          </div>
        </div>

        {/* Total hours */}
        {todayTasks.length > 0 && (
          <div className="flex-1 bg-background/60 backdrop-blur-sm rounded-2xl p-3 border border-border/30">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center">
                <Clock className="h-4 w-4 text-primary" />
              </div>
              <div>
                <div className="text-xl font-bold text-foreground">{totalHoursToday}</div>
                <div className="text-xs text-muted-foreground">Total hoy</div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Tomorrow preview */}
      {tomorrowTasks.length > 0 && (
        <div className="flex items-center justify-between bg-background/40 backdrop-blur-sm rounded-xl px-3 py-2 border border-border/20">
          <div className="flex items-center gap-2">
            <ArrowRight className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">Mañana:</span>
            <span className="text-sm font-semibold text-foreground">
              {tomorrowTasks.length} {tomorrowTasks.length === 1 ? 'tarea' : 'tareas'}
            </span>
          </div>
        </div>
      )}
    </div>
  );
};

// Memoize component to prevent unnecessary re-renders
export const CleanerTaskSummary = memo(CleanerTaskSummaryComponent);
