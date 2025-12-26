import React, { memo } from 'react';
import { Calendar, CalendarDays } from 'lucide-react';
import { cn } from '@/lib/utils';

export type CalendarViewMode = 'daily' | 'weekly';

interface CleanerViewToggleProps {
  viewMode: CalendarViewMode;
  onViewModeChange: (mode: CalendarViewMode) => void;
}

const CleanerViewToggleComponent: React.FC<CleanerViewToggleProps> = ({
  viewMode,
  onViewModeChange
}) => {
  return (
    <div className="flex items-center justify-center p-2 bg-muted/30">
      <div className="flex items-center bg-background/60 rounded-full p-1 border border-border/50">
        <button
          onClick={() => onViewModeChange('daily')}
          className={cn(
            "flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all duration-200",
            viewMode === 'daily' 
              ? "bg-primary text-primary-foreground shadow-sm" 
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          <Calendar className="h-4 w-4" />
          <span>Día</span>
        </button>
        <button
          onClick={() => onViewModeChange('weekly')}
          className={cn(
            "flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all duration-200",
            viewMode === 'weekly' 
              ? "bg-primary text-primary-foreground shadow-sm" 
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          <CalendarDays className="h-4 w-4" />
          <span>Semana</span>
        </button>
      </div>
    </div>
  );
};

export const CleanerViewToggle = memo(CleanerViewToggleComponent);
