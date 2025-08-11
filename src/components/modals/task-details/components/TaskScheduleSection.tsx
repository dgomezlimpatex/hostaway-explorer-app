import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Clock, CalendarIcon } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { Task } from '@/types/calendar';

interface TaskScheduleSectionProps {
  task: Task;
  isEditing: boolean;
  formData: Partial<Task>;
  propertyData: any;
  onFieldChange: (field: string, value: string) => void;
}

export const TaskScheduleSection = ({
  task,
  isEditing,
  formData,
  propertyData,
  onFieldChange
}: TaskScheduleSectionProps) => {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Clock className="h-5 w-5 text-purple-600" />
          Horarios
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label className="text-sm font-medium text-gray-700">Fecha</Label>
            {isEditing ? (
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !formData.date && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {formData.date ? format(new Date(formData.date), "PPP") : <span>Selecciona una fecha</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={formData.date ? new Date(formData.date) : undefined}
                    onSelect={(date) => date && onFieldChange('date', date.toISOString().split('T')[0])}
                    initialFocus
                    className={cn("p-3 pointer-events-auto")}
                  />
                </PopoverContent>
              </Popover>
            ) : (
              <div className="p-3 bg-purple-50 rounded-lg border border-purple-200">
                <span className="text-purple-800 font-medium">{format(new Date(task.date), "PPP")}</span>
              </div>
            )}
          </div>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label className="text-sm font-medium text-gray-700">Hora de Inicio</Label>
            {isEditing ? (
              <Input 
                type="time" 
                value={formData.startTime || ''} 
                onChange={e => {
                  console.log('🕐 TaskScheduleSection - startTime onChange called:', e.target.value);
                  onFieldChange('startTime', e.target.value);
                }}
              />
            ) : (
              <div className="p-3 bg-purple-50 rounded-lg border border-purple-200">
                <span className="text-purple-800 font-medium">{task.startTime}</span>
              </div>
            )}
          </div>
          
          <div className="space-y-2">
            <Label className="text-sm font-medium text-gray-700">Hora de Fin</Label>
            {isEditing ? (
              <Input 
                type="time" 
                value={formData.endTime || ''} 
                onChange={e => onFieldChange('endTime', e.target.value)}
              />
            ) : (
              <div className="p-3 bg-purple-50 rounded-lg border border-purple-200">
                <span className="text-purple-800 font-medium">{task.endTime}</span>
              </div>
            )}
          </div>
        </div>
        
        {propertyData && (
          <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-sm font-medium text-gray-700">Check-in Predeterminado</Label>
              <div className="p-3 bg-gray-50 rounded-lg border">
                <span className="text-gray-700">{propertyData.check_in_predeterminado}</span>
              </div>
            </div>
            
            <div className="space-y-2">
              <Label className="text-sm font-medium text-gray-700">Check-out Predeterminado</Label>
              <div className="p-3 bg-gray-50 rounded-lg border">
                <span className="text-gray-700">{propertyData.check_out_predeterminado}</span>
              </div>
            </div>
          </div>
        )}
        </div>
      </CardContent>
    </Card>
  );
};