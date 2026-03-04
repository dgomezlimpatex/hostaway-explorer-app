
import React from 'react';
import { DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { MapPin, Clock, CheckCircle, Loader2 } from 'lucide-react';
import { Task } from '@/types/calendar';
import { cn } from '@/lib/utils';

interface TaskReportHeaderProps {
  task: Task;
  reportStatus: string;
  completionPercentage: number;
  isLoadingReport: boolean;
  isCollapsed?: boolean;
}

const statusConfig = {
  completed: {
    label: 'Completado',
    gradient: 'from-emerald-500 to-green-600',
    bgGlow: 'bg-emerald-500/10',
    textColor: 'text-emerald-700',
    icon: CheckCircle,
    progressBar: 'bg-gradient-to-r from-emerald-400 to-green-500',
  },
  in_progress: {
    label: 'En Progreso',
    gradient: 'from-blue-500 to-indigo-600',
    bgGlow: 'bg-blue-500/10',
    textColor: 'text-blue-700',
    icon: Loader2,
    progressBar: 'bg-gradient-to-r from-blue-400 to-indigo-500',
  },
  pending: {
    label: 'Pendiente',
    gradient: 'from-amber-500 to-orange-600',
    bgGlow: 'bg-amber-500/10',
    textColor: 'text-amber-700',
    icon: Clock,
    progressBar: 'bg-gradient-to-r from-amber-400 to-orange-500',
  },
};

export const TaskReportHeader: React.FC<TaskReportHeaderProps> = ({
  task,
  reportStatus,
  completionPercentage,
  isLoadingReport,
  isCollapsed = false,
}) => {
  const config = statusConfig[reportStatus as keyof typeof statusConfig] || statusConfig.pending;
  const StatusIcon = config.icon;

  // Format time nicely
  const formattedTime = task.startTime?.replace(':00:00', ':00').replace(/^(\d{2}:\d{2}).*/, '$1') || '';

  const googleMapsUrl = task.address
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(task.address)}`
    : null;

  return (
    <div className="relative">
      {/* Collapsed mini-header - visible when scrolled down */}
      <div
        className={cn(
          'absolute inset-x-0 top-0 z-10 flex items-center gap-2 px-1 transition-all duration-300 ease-out',
          isCollapsed ? 'opacity-100 translate-y-0 h-auto' : 'opacity-0 -translate-y-2 h-0 overflow-hidden pointer-events-none'
        )}
      >
        <div className={cn('w-1.5 h-6 rounded-full bg-gradient-to-b flex-shrink-0', config.gradient)} />
        <p className="text-xs font-semibold truncate text-foreground flex-1 min-w-0">
          {task.property}
        </p>
        <span className="text-[11px] font-bold tabular-nums text-foreground flex-shrink-0">
          {completionPercentage}%
        </span>
        <div className="w-16 h-1.5 bg-muted rounded-full overflow-hidden flex-shrink-0">
          <div
            className={cn('h-full rounded-full transition-all duration-500', config.progressBar)}
            style={{ width: `${completionPercentage}%` }}
          />
        </div>
      </div>

      {/* Full header - visible when not scrolled */}
      <div
        className={cn(
          'transition-all duration-300 ease-out origin-top',
          isCollapsed
            ? 'opacity-0 max-h-0 scale-y-0 overflow-hidden'
            : 'opacity-100 max-h-48 scale-y-100'
        )}
      >
        {/* Top gradient accent bar */}
        <div className={cn('h-1 rounded-full bg-gradient-to-r mb-3', config.gradient)} />

        {/* Property name */}
        <DialogTitle className="text-base font-bold leading-tight tracking-tight truncate text-foreground">
          {task.property}
        </DialogTitle>

        {/* Address + time row */}
        <DialogDescription asChild>
          <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground">
            {task.address && (
              <a
                href={googleMapsUrl || '#'}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 truncate hover:text-primary transition-colors min-w-0"
                onClick={(e) => e.stopPropagation()}
              >
                <MapPin className="h-3 w-3 flex-shrink-0 text-primary/70" />
                <span className="truncate underline decoration-dotted underline-offset-2">
                  {task.address}
                </span>
              </a>
            )}
            {formattedTime && (
              <span className="flex items-center gap-1 flex-shrink-0">
                <Clock className="h-3 w-3" />
                {formattedTime}
              </span>
            )}
          </div>
        </DialogDescription>

        {/* Status + progress row */}
        <div className="flex items-center gap-2.5 mt-3">
          {/* Status pill */}
          <div
            className={cn(
              'flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold',
              config.bgGlow,
              config.textColor
            )}
          >
            <StatusIcon
              className={cn(
                'h-3 w-3',
                reportStatus === 'in_progress' && 'animate-spin'
              )}
            />
            {config.label}
          </div>

          {/* Percentage */}
          <span className="text-xs font-bold tabular-nums text-foreground">
            {completionPercentage}%
          </span>

          {/* Progress bar */}
          <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
            <div
              className={cn(
                'h-full rounded-full transition-all duration-700 ease-out',
                config.progressBar
              )}
              style={{ width: `${completionPercentage}%` }}
            />
          </div>

          {isLoadingReport && (
            <Loader2 className="h-3 w-3 text-muted-foreground animate-spin flex-shrink-0" />
          )}
        </div>
      </div>
    </div>
  );
};
