
import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Trash2, Clock, CalendarCheck } from "lucide-react";
import { Cleaner } from "@/types/calendar";
import { useCleanerAvailability, useCreateOrUpdateAvailability, useDeleteAvailability } from "@/hooks/useCleanerAvailability";

interface AvailabilityModalProps {
  worker: Cleaner | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const DAYS_OF_WEEK = [
  { value: 1, label: 'Lunes' },
  { value: 2, label: 'Martes' },
  { value: 3, label: 'Miércoles' },
  { value: 4, label: 'Jueves' },
  { value: 5, label: 'Viernes' },
  { value: 6, label: 'Sábado' },
  { value: 0, label: 'Domingo' },
];

export const AvailabilityModal = ({ worker, open, onOpenChange }: AvailabilityModalProps) => {
  const [dayAvailability, setDayAvailability] = useState<{
    [key: number]: {
      isAvailable: boolean;
      startTime: string;
      endTime: string;
    }
  }>({});

  const { data: availability, isLoading } = useCleanerAvailability(worker?.id || '');
  const updateAvailability = useCreateOrUpdateAvailability();
  const deleteAvailability = useDeleteAvailability();

  useEffect(() => {
    if (availability) {
      const availabilityMap: typeof dayAvailability = {};
      availability.forEach(avail => {
        availabilityMap[avail.day_of_week] = {
          isAvailable: avail.is_available,
          startTime: avail.start_time || '09:00',
          endTime: avail.end_time || '17:00',
        };
      });
      setDayAvailability(availabilityMap);
    }
  }, [availability]);

  const handleDayToggle = (dayOfWeek: number, isAvailable: boolean) => {
    setDayAvailability(prev => ({
      ...prev,
      [dayOfWeek]: {
        ...prev[dayOfWeek],
        isAvailable,
        startTime: prev[dayOfWeek]?.startTime || '06:00',
        endTime: prev[dayOfWeek]?.endTime || '23:00',
      }
    }));
  };

  const handleTimeChange = (dayOfWeek: number, field: 'startTime' | 'endTime', value: string) => {
    setDayAvailability(prev => ({
      ...prev,
      [dayOfWeek]: {
        ...prev[dayOfWeek],
        [field]: value,
        isAvailable: prev[dayOfWeek]?.isAvailable ?? true,
      }
    }));
  };

  const handleFullAvailability = () => {
    const fullAvailabilityMap: typeof dayAvailability = {};
    DAYS_OF_WEEK.forEach(day => {
      fullAvailabilityMap[day.value] = {
        isAvailable: true,
        startTime: '06:00',
        endTime: '23:00',
      };
    });
    setDayAvailability(fullAvailabilityMap);
  };

  const handleSave = async () => {
    if (!worker) return;

    const promises = Object.entries(dayAvailability).map(([dayOfWeek, config]) => {
      return updateAvailability.mutateAsync({
        cleaner_id: worker.id,
        day_of_week: parseInt(dayOfWeek),
        is_available: config.isAvailable,
        start_time: config.isAvailable ? config.startTime : undefined,
        end_time: config.isAvailable ? config.endTime : undefined,
      });
    });

    try {
      await Promise.all(promises);
      onOpenChange(false);
    } catch (error) {
      console.error('Error saving availability:', error);
    }
  };

  const handleRemoveDay = async (dayOfWeek: number) => {
    const dayAvail = availability?.find(a => a.day_of_week === dayOfWeek);
    if (dayAvail) {
      await deleteAvailability.mutateAsync({ 
        id: dayAvail.id, 
        cleanerId: worker?.id || '' 
      });
    }
    
    setDayAvailability(prev => {
      const newState = { ...prev };
      delete newState[dayOfWeek];
      return newState;
    });
  };

  if (!worker) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Disponibilidad de {worker.name}
          </DialogTitle>
          <DialogDescription>
            Configure los días y horarios en los que este trabajador está disponible.
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="text-center py-4">Cargando disponibilidad...</div>
        ) : (
          <div className="space-y-4">
            {/* Full Availability Button */}
            <div className="flex justify-center pb-4 border-b">
              <Button 
                onClick={handleFullAvailability}
                variant="outline"
                className="flex items-center gap-2"
              >
                <CalendarCheck className="h-4 w-4" />
                Disponibilidad Total (06:00 - 23:00)
              </Button>
            </div>

            {DAYS_OF_WEEK.map(day => {
              const config = dayAvailability[day.value];
              const isConfigured = config !== undefined;
              
              return (
                <Card key={day.value} className={!isConfigured ? "opacity-60" : ""}>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base">{day.label}</CardTitle>
                      <div className="flex items-center gap-2">
                        {isConfigured && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleRemoveDay(day.value)}
                            className="text-red-500 hover:text-red-700"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                        <Switch
                          checked={isConfigured && config.isAvailable}
                          onCheckedChange={(checked) => handleDayToggle(day.value, checked)}
                        />
                      </div>
                    </div>
                  </CardHeader>
                  {isConfigured && config.isAvailable && (
                    <CardContent className="pt-0">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label htmlFor={`start-${day.value}`} className="text-sm">
                            Hora de inicio
                          </Label>
                          <Input
                            id={`start-${day.value}`}
                            type="time"
                            value={config.startTime}
                            onChange={(e) => handleTimeChange(day.value, 'startTime', e.target.value)}
                          />
                        </div>
                        <div>
                          <Label htmlFor={`end-${day.value}`} className="text-sm">
                            Hora de fin
                          </Label>
                          <Input
                            id={`end-${day.value}`}
                            type="time"
                            value={config.endTime}
                            onChange={(e) => handleTimeChange(day.value, 'endTime', e.target.value)}
                          />
                        </div>
                      </div>
                    </CardContent>
                  )}
                </Card>
              );
            })}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button 
            onClick={handleSave} 
            disabled={updateAvailability.isPending}
          >
            {updateAvailability.isPending ? 'Guardando...' : 'Guardar Disponibilidad'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
