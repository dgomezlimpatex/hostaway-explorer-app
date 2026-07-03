import React, { useRef, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, Clock, MapPin } from 'lucide-react';
import { 
  WorkerAbsence, 
  WorkerFixedDayOff, 
  WorkerMaintenanceCleaning,
  ABSENCE_TYPE_CONFIG,
  DAY_OF_WEEK_SHORT 
} from '@/types/workerAbsence';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';

interface AbsenceCalendarViewProps {
  cleanerId: string;
  absences: WorkerAbsence[];
  fixedDaysOff: WorkerFixedDayOff[];
  maintenanceCleanings: WorkerMaintenanceCleaning[];
  onDateClick: (date: Date) => void;
  onDateRangeSelect?: (startDate: Date, endDate: Date) => void;
  isLoading?: boolean;
}

export const AbsenceCalendarView: React.FC<AbsenceCalendarViewProps> = ({
  cleanerId,
  absences,
  fixedDaysOff,
  maintenanceCleanings,
  onDateClick,
  onDateRangeSelect,
  isLoading,
}) => {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectionRange, setSelectionRange] = useState<{ start: Date; end: Date } | null>(null);
  const isSelectingRef = useRef(false);
  const selectionStartRef = useRef<Date | null>(null);
  const selectionEndRef = useRef<Date | null>(null);

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

  const formatDateLocal = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const dateFromLocalKey = (dateKey: string) => {
    const [year, month, day] = dateKey.split('-').map(Number);
    return new Date(year, month - 1, day);
  };

  const getAbsenceForDate = (date: Date): WorkerAbsence | undefined => {
    // Format date as YYYY-MM-DD using local timezone
    const dateStr = formatDateLocal(date);
    
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

  const getMaintenanceCleaningsForDate = (date: Date): WorkerMaintenanceCleaning[] => {
    const dayOfWeek = date.getDay();
    return maintenanceCleanings.filter(m => m.isActive && m.daysOfWeek.includes(dayOfWeek));
  };

  const getAbsencesForDate = (date: Date): WorkerAbsence[] => {
    const dateStr = formatDateLocal(date);
    
    return absences.filter(a => dateStr >= a.startDate && dateStr <= a.endDate);
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

  const normalizeRange = (start: Date, end: Date) => {
    const startTime = start.getTime();
    const endTime = end.getTime();
    return startTime <= endTime ? { start, end } : { start: end, end: start };
  };

  const isDateInSelectionRange = (date: Date) => {
    if (!selectionRange) return false;
    const { start, end } = normalizeRange(selectionRange.start, selectionRange.end);
    const dayTime = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
    return dayTime >= start.getTime() && dayTime <= end.getTime();
  };

  const clearSelection = () => {
    isSelectingRef.current = false;
    selectionStartRef.current = null;
    selectionEndRef.current = null;
    setSelectionRange(null);
  };

  const handleDayPointerDown = (date: Date, event: React.PointerEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    isSelectingRef.current = true;
    selectionStartRef.current = date;
    selectionEndRef.current = date;
    setSelectionRange({ start: date, end: date });
  };

  const handleDayPointerEnter = (date: Date) => {
    if (!isSelectingRef.current || !selectionStartRef.current) return;
    selectionEndRef.current = date;
    setSelectionRange({ start: selectionStartRef.current, end: date });
  };

  const handleDayPointerMove = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (!isSelectingRef.current || !selectionStartRef.current) return;
    const target = document.elementFromPoint(event.clientX, event.clientY);
    const dateElement = target instanceof HTMLElement
      ? target.closest<HTMLElement>('[data-calendar-date]')
      : null;
    const dateKey = dateElement?.dataset.calendarDate;
    if (!dateKey) return;

    const date = dateFromLocalKey(dateKey);
    if (selectionEndRef.current && formatDateLocal(selectionEndRef.current) === dateKey) return;

    selectionEndRef.current = date;
    setSelectionRange({ start: selectionStartRef.current, end: date });
  };

  const handleDayPointerUp = (date: Date, event: React.PointerEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    const start = selectionStartRef.current || date;
    const end = selectionEndRef.current || date;
    const range = normalizeRange(start, end);
    clearSelection();

    if (onDateRangeSelect) {
      onDateRangeSelect(range.start, range.end);
      return;
    }

    onDateClick(range.start);
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
            
            const maintenanceList = getMaintenanceCleaningsForDate(day.date);
            const absenceList = getAbsencesForDate(day.date);
            const hasDetails = maintenanceList.length > 0 || absenceList.length > 0 || isFixedOff;
            const isRangeSelected = isDateInSelectionRange(day.date);
            
            const dayButton = (
              <button
                data-calendar-date={formatDateLocal(day.date)}
                onPointerDown={(event) => handleDayPointerDown(day.date!, event)}
                onPointerEnter={() => handleDayPointerEnter(day.date!)}
                onPointerMove={handleDayPointerMove}
                onPointerUp={(event) => handleDayPointerUp(day.date!, event)}
                onPointerCancel={clearSelection}
                onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                }}
                className={cn(
                  'h-12 w-full touch-none select-none rounded-md flex flex-col items-center justify-center text-sm transition-colors relative cursor-pointer hover:ring-2 hover:ring-[#310984]/25',
                  style.bg,
                  style.border,
                  isRangeSelected && 'ring-2 ring-[#310984] ring-offset-1',
                  style.pattern === 'striped' && 'bg-stripes'
                )}
                style={
                  isRangeSelected
                    ? { backgroundColor: '#ede9fe', borderColor: '#310984' }
                    : absence
                      ? { 
                          backgroundColor: `${ABSENCE_TYPE_CONFIG[absence.absenceType].color}30`,
                          borderColor: ABSENCE_TYPE_CONFIG[absence.absenceType].color,
                        }
                      : undefined
                }
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
            
            if (!hasDetails) {
              return <div key={index}>{dayButton}</div>;
            }
            
            return (
              <Popover key={index}>
                <PopoverTrigger asChild>
                  {dayButton}
                </PopoverTrigger>
                <PopoverContent className="w-72 p-3" align="center">
                  <div className="space-y-3">
                    <div className="text-sm font-medium text-center border-b pb-2">
                      {day.date.toLocaleDateString('es-ES', { 
                        weekday: 'long', 
                        day: 'numeric', 
                        month: 'long' 
                      })}
                    </div>
                    
                    {/* Ausencias */}
                    {absenceList.length > 0 && (
                      <div className="space-y-2">
                        <h4 className="text-xs font-semibold text-muted-foreground uppercase">Ausencias</h4>
                        {absenceList.map((abs) => {
                          const config = ABSENCE_TYPE_CONFIG[abs.absenceType];
                          return (
                            <div 
                              key={abs.id} 
                              className="flex items-start gap-2 p-2 rounded-md text-sm"
                              style={{ backgroundColor: `${config.color}20` }}
                            >
                              <span>{config.icon}</span>
                              <div className="flex-1">
                              <div className="font-medium">{config.label}</div>
                              {abs.startTime && abs.endTime && (
                                <div className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
                                  <Clock className="h-3 w-3" />
                                  {abs.startTime} - {abs.endTime}
                                </div>
                              )}
                              {abs.notes && (
                                <div className="text-xs text-muted-foreground mt-0.5">{abs.notes}</div>
                              )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                    
                    {/* Limpiezas de mantenimiento */}
                    {maintenanceList.length > 0 && (
                      <div className="space-y-2">
                        <h4 className="text-xs font-semibold text-muted-foreground uppercase">Limpiezas de mantenimiento</h4>
                        {maintenanceList.map((maint) => (
                          <div 
                            key={maint.id} 
                            className="flex items-start gap-2 p-2 rounded-md bg-yellow-50 dark:bg-yellow-900/20 text-sm"
                          >
                            <span>🧹</span>
                            <div className="flex-1">
                              <div className="font-medium flex items-center gap-1">
                                <MapPin className="h-3 w-3" />
                                {maint.locationName}
                              </div>
                              <div className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
                                <Clock className="h-3 w-3" />
                                {maint.startTime} - {maint.endTime}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                    
                    {/* Día libre fijo */}
                    {isFixedOff && !absence && (
                      <div className="space-y-2">
                        <h4 className="text-xs font-semibold text-muted-foreground uppercase">Día libre fijo</h4>
                        <div className="flex items-center gap-2 p-2 rounded-md bg-muted text-sm">
                          <span>📅</span>
                          <span>Este es un día libre fijo configurado</span>
                        </div>
                      </div>
                    )}
                    
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="w-full mt-2"
                      onClick={() => onDateClick(day.date!)}
                    >
                      Añadir nueva ausencia
                    </Button>
                  </div>
                </PopoverContent>
              </Popover>
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
