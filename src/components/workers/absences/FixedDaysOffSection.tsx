import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { WorkerFixedDayOff, DAY_OF_WEEK_LABELS } from '@/types/workerAbsence';
import { useToggleWorkerFixedDayOff } from '@/hooks/useWorkerFixedDaysOff';
import { Loader2 } from 'lucide-react';

interface FixedDaysOffSectionProps {
  cleanerId: string;
  fixedDaysOff: WorkerFixedDayOff[];
}

export const FixedDaysOffSection: React.FC<FixedDaysOffSectionProps> = ({
  cleanerId,
  fixedDaysOff,
}) => {
  const toggleMutation = useToggleWorkerFixedDayOff();

  const handleToggle = (dayOfWeek: number, isActive: boolean) => {
    toggleMutation.mutate({
      cleanerId,
      dayOfWeek,
      isActive,
    });
  };

  const isDayActive = (dayOfWeek: number): boolean => {
    return fixedDaysOff.some(d => d.dayOfWeek === dayOfWeek && d.isActive);
  };

  // Order days starting from Monday (1) to Sunday (0)
  const orderedDays = [1, 2, 3, 4, 5, 6, 0];

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Días Libres Fijos</CardTitle>
        <CardDescription>
          Marca los días de la semana en los que este trabajador no trabaja regularmente
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-4">
          {orderedDays.map(dayOfWeek => {
            const isActive = isDayActive(dayOfWeek);
            const isLoading = toggleMutation.isPending && 
              toggleMutation.variables?.dayOfWeek === dayOfWeek;
            
            return (
              <div 
                key={dayOfWeek} 
                className="flex items-center space-x-2"
              >
                <Checkbox
                  id={`day-${dayOfWeek}`}
                  checked={isActive}
                  onCheckedChange={(checked) => handleToggle(dayOfWeek, checked as boolean)}
                  disabled={isLoading}
                />
                <Label 
                  htmlFor={`day-${dayOfWeek}`}
                  className="text-sm cursor-pointer flex items-center gap-1"
                >
                  {isLoading && <Loader2 className="h-3 w-3 animate-spin" />}
                  {DAY_OF_WEEK_LABELS[dayOfWeek]}
                </Label>
              </div>
            );
          })}
        </div>
        
        {fixedDaysOff.filter(d => d.isActive).length > 0 && (
          <div className="mt-4 pt-4 border-t">
            <p className="text-sm text-muted-foreground">
              <span className="font-medium">Días libres activos: </span>
              {fixedDaysOff
                .filter(d => d.isActive)
                .sort((a, b) => {
                  const orderA = a.dayOfWeek === 0 ? 7 : a.dayOfWeek;
                  const orderB = b.dayOfWeek === 0 ? 7 : b.dayOfWeek;
                  return orderA - orderB;
                })
                .map(d => DAY_OF_WEEK_LABELS[d.dayOfWeek])
                .join(', ')}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
