import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

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
    
    return {
      dayMonth: `${day}.${month}`,
      weekday
    };
  };

  const { dayMonth, weekday } = formatDate(currentDate);

  return (
    <div className="flex items-center justify-between p-4 border-b border-border bg-card">
      <Button
        variant="ghost"
        size="icon"
        onClick={() => onNavigateDate('prev')}
        className="h-10 w-10"
      >
        <ChevronLeft className="h-5 w-5" />
      </Button>
      
      <div className="text-center">
        <div className="text-3xl font-bold text-foreground">
          {dayMonth}
        </div>
        <div className="text-sm text-muted-foreground mt-1">
          {weekday}
        </div>
      </div>
      
      <Button
        variant="ghost"
        size="icon"
        onClick={() => onNavigateDate('next')}
        className="h-10 w-10"
      >
        <ChevronRight className="h-5 w-5" />
      </Button>
    </div>
  );
};