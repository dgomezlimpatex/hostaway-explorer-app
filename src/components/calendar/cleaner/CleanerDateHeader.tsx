import React, { useState } from 'react';
import { ChevronLeft, ChevronRight, Home, Calendar as CalendarIcon } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

interface CleanerDateHeaderProps {
  currentDate: Date;
  onNavigateDate: (direction: 'prev' | 'next') => void;
  onDateChange?: (date: Date) => void;
}

export const CleanerDateHeader: React.FC<CleanerDateHeaderProps> = ({
  currentDate,
  onNavigateDate,
  onDateChange
}) => {
  const navigate = useNavigate();
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const formatDate = (date: Date) => {
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const weekday = date.toLocaleDateString('es-ES', { weekday: 'short' }).toUpperCase();
    const monthName = date.toLocaleDateString('es-ES', { month: 'short' }).toUpperCase();
    
    return {
      dayMonth: `${day}.${month}`,
      weekday,
      monthName
    };
  };

  const { dayMonth, weekday, monthName } = formatDate(currentDate);

  return (
    <div className="flex items-center justify-between p-4 border-b border-border bg-gradient-to-r from-primary/5 to-primary/10">
      {/* Botón Home */}
      <Button
        variant="ghost"
        size="sm"
        onClick={() => navigate('/')}
        className="h-10 w-10 rounded-full bg-background/50 backdrop-blur-sm border border-border/50 hover:bg-background/80 transition-all duration-200"
      >
        <Home className="h-4 w-4 text-foreground" />
      </Button>

      {/* Navegación de fecha */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => onNavigateDate('prev')}
          className="h-10 w-10 rounded-full bg-background/50 backdrop-blur-sm border border-border/50 flex items-center justify-center hover:bg-background/80 transition-all duration-200 active:scale-95"
        >
          <ChevronLeft className="h-4 w-4 text-foreground" />
        </button>
        
        {/* Selector de fecha */}
        <Popover open={isCalendarOpen} onOpenChange={setIsCalendarOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="ghost"
              className="flex flex-col items-center px-3 py-2 h-auto bg-background/50 backdrop-blur-sm border border-border/50 hover:bg-background/80 transition-all duration-200"
            >
              <div className="text-2xl font-bold text-foreground tracking-tight">
                {dayMonth}
              </div>
              <div className="text-xs font-medium text-muted-foreground tracking-wider">
                {weekday} {monthName}
              </div>
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="center">
            <Calendar
              mode="single"
              selected={currentDate}
              onSelect={(date) => {
                if (date && onDateChange) {
                  onDateChange(date);
                  setIsCalendarOpen(false);
                }
              }}
              initialFocus
              className={cn("p-3 pointer-events-auto")}
            />
          </PopoverContent>
        </Popover>
        
        <button
          onClick={() => onNavigateDate('next')}
          className="h-10 w-10 rounded-full bg-background/50 backdrop-blur-sm border border-border/50 flex items-center justify-center hover:bg-background/80 transition-all duration-200 active:scale-95"
        >
          <ChevronRight className="h-4 w-4 text-foreground" />
        </button>
      </div>

      {/* Botón de calendario para visual balance */}
      <div className="h-10 w-10 flex items-center justify-center">
        <CalendarIcon className="h-4 w-4 text-muted-foreground/50" />
      </div>
    </div>
  );
};