import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface CleanerDateHeaderProps {
  currentDate: Date;
  onNavigateDate: (direction: 'prev' | 'next') => void;
}

export const CleanerDateHeader: React.FC<CleanerDateHeaderProps> = ({
  currentDate,
  onNavigateDate
}) => {
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
    <div className="flex items-center justify-between p-6 border-b border-border bg-gradient-to-r from-primary/5 to-primary/10">
      <button
        onClick={() => onNavigateDate('prev')}
        className="h-12 w-12 rounded-full bg-background/50 backdrop-blur-sm border border-border/50 flex items-center justify-center hover:bg-background/80 transition-all duration-200 active:scale-95"
      >
        <ChevronLeft className="h-5 w-5 text-foreground" />
      </button>
      
      <div className="text-center">
        <div className="text-4xl font-bold text-foreground mb-1 tracking-tight">
          {dayMonth}
        </div>
        <div className="text-sm font-medium text-muted-foreground tracking-wider">
          {weekday} {monthName}
        </div>
      </div>
      
      <button
        onClick={() => onNavigateDate('next')}
        className="h-12 w-12 rounded-full bg-background/50 backdrop-blur-sm border border-border/50 flex items-center justify-center hover:bg-background/80 transition-all duration-200 active:scale-95"
      >
        <ChevronRight className="h-5 w-5 text-foreground" />
      </button>
    </div>
  );
};