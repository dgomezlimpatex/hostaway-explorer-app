import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { 
  WorkerAbsence, 
  WorkerFixedDayOff, 
  WorkerMaintenanceCleaning,
  ABSENCE_TYPE_CONFIG,
  DAY_OF_WEEK_SHORT 
} from '@/types/workerAbsence';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';

interface AbsenceCalendarViewProps {
  cleanerId: string;
  absences: WorkerAbsence[];
  fixedDaysOff: WorkerFixedDayOff[];
  maintenanceCleanings: WorkerMaintenanceCleaning[];
  onDateClick: (date: Date) => void;
  isLoading?: boolean;
}

export const AbsenceCalendarView: React.FC<AbsenceCalendarViewProps> = ({
  cleanerId,
  absences,
  fixedDaysOff,
  maintenanceCleanings,
  onDateClick,
  isLoading,
}) => {
  const [currentMonth, setCurrentMonth] = useState(new Date());

  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();
    
    const days: Array<{ date: Date | null; isCurrentMonth: boolean }> = [];
    
    // Add empty cells for days before the first of the month
    for (let i = 0; i < startingDayOfWeek; i++) {
      days.push({ date: null, isCurrentMonth: false });
    }
    
    // Add days of the month
    for (let day = 1; day <= daysInMonth; day++) {
      days.push({ date: new Date(year, month, day), isCurrentMonth: true });
    }
    
    return days;
  };

  const getAbsenceForDate = (date: Date): WorkerAbsence | undefined => {
    // Format date as YYYY-MM-DD using local timezone
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const dateStr = `${year}-${month}-${day}`;
    
    return absences.find(a => {
      // Compare strings directly since startDate and endDate are already in YYYY-MM-DD format
      return dateStr >= a.startDate && dateStr <= a.endDate;
    });
  };

  const hasFixedDayOff = (date: Date): boolean => {
    const dayOfWeek = date.getDay();
    return fixedDaysOff.some(d => d.dayOfWeek === dayOfWeek && d.isActive);
  };

  const hasMaintenanceCleaning = (date: Date): boolean => {
    const dayOfWeek = date.getDay();
    return maintenanceCleanings.some(m => m.isActive && m.daysOfWeek.includes(dayOfWeek));
  };

  const getDateStyle = (date: Date): { bg: string; border: string; pattern?: string } => {
    const absence = getAbsenceForDate(date);
    const isFixedOff = hasFixedDayOff(date);
    const hasMaintenance = hasMaintenanceCleaning(date);
    const today = new Date();
    const isToday = date.toDateString() === today.toDateString();

    if (absence) {
      const config = ABSENCE_TYPE_CONFIG[absence.absenceType];
      return { 
        bg: `bg-opacity-30`, 
        border: `border-2`,
      };
    }
    
    if (isFixedOff) {
      return { 
        bg: 'bg-muted', 
        border: 'border-2 border-dashed border-muted-foreground/50',
        pattern: 'striped'
      };
    }
    
    if (hasMaintenance) {
      return { bg: 'bg-yellow-100 dark:bg-yellow-900/30', border: 'border border-yellow-400' };
    }
    
    if (isToday) {
      return { bg: 'bg-primary/10', border: 'border-2 border-primary' };
    }
    
    return { bg: 'hover:bg-accent', border: 'border border-transparent hover:border-border' };
  };

  const navigateMonth = (direction: number) => {
    setCurrentMonth(prev => {
      const newDate = new Date(prev);
      newDate.setMonth(newDate.getMonth() + direction);
      return newDate;
    });
  };

  const days = getDaysInMonth(currentMonth);
  const monthName = currentMonth.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-7 gap-1">
            {Array(35).fill(0).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <Button variant="ghost" size="icon" onClick={() => navigateMonth(-1)}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <CardTitle className="text-lg capitalize">{monthName}</CardTitle>
          <Button variant="ghost" size="icon" onClick={() => navigateMonth(1)}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {/* Day headers */}
        <div className="grid grid-cols-7 gap-1 mb-2">
          {[0, 1, 2, 3, 4, 5, 6].map(day => (
            <div key={day} className="text-center text-xs font-medium text-muted-foreground py-1">
              {DAY_OF_WEEK_SHORT[day]}
            </div>
          ))}
        </div>
        
        {/* Calendar grid */}
        <div className="grid grid-cols-7 gap-1">
          {days.map((day, index) => {
            if (!day.date) {
              return <div key={index} className="h-12" />;
            }
            
            const style = getDateStyle(day.date);
            const absence = getAbsenceForDate(day.date);
            const isFixedOff = hasFixedDayOff(day.date);
            const hasMaintenance = hasMaintenanceCleaning(day.date);
            
            return (
              <button
                key={index}
                onClick={() => onDateClick(day.date!)}
                className={cn(
                  'h-12 rounded-md flex flex-col items-center justify-center text-sm transition-colors relative',
                  style.bg,
                  style.border,
                  style.pattern === 'striped' && 'bg-stripes'
                )}
                style={absence ? { 
                  backgroundColor: `${ABSENCE_TYPE_CONFIG[absence.absenceType].color}30`,
                  borderColor: ABSENCE_TYPE_CONFIG[absence.absenceType].color,
                } : undefined}
              >
                <span className="font-medium">{day.date.getDate()}</span>
                {absence && (
                  <span className="text-[10px] leading-none">
                    {ABSENCE_TYPE_CONFIG[absence.absenceType].icon}
                  </span>
                )}
                {isFixedOff && !absence && (
                  <span className="text-[10px] leading-none">📅</span>
                )}
                {hasMaintenance && !absence && !isFixedOff && (
                  <span className="text-[10px] leading-none">🧹</span>
                )}
              </button>
            );
          })}
        </div>

        {/* Legend */}
        <div className="mt-4 pt-4 border-t">
          <h4 className="text-xs font-medium text-muted-foreground mb-2">Leyenda:</h4>
          <div className="flex flex-wrap gap-3 text-xs">
            {Object.entries(ABSENCE_TYPE_CONFIG).map(([key, config]) => (
              <div key={key} className="flex items-center gap-1">
                <div 
                  className="w-3 h-3 rounded" 
                  style={{ backgroundColor: config.color }}
                />
                <span>{config.icon} {config.label}</span>
              </div>
            ))}
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 rounded bg-muted border border-dashed border-muted-foreground/50" />
              <span>📅 Día libre fijo</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 rounded bg-yellow-100 dark:bg-yellow-900/30 border border-yellow-400" />
              <span>🧹 Limpieza mant.</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
