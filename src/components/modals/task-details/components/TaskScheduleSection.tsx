import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Clock, CalendarIcon, Loader2, Check, AlertCircle, Hourglass } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { Task } from '@/types/calendar';
import { FieldSaveStatus } from '@/hooks/useInlineFieldSave';

interface TaskScheduleSectionProps {
  task: Task;
  formData: Partial<Task>;
  propertyData: any;
  onFieldChange: (field: string, value: string) => void;
  onFieldBlur?: (field: string, value: string) => void;
  /** Save schedule + duration in one shot (used by quick-action buttons). */
  onScheduleSave?: (updates: Partial<Task>) => void;
  statusByField?: Record<string, FieldSaveStatus>;
}

// Helpers
const normalizeTime = (t?: string) => (t ? (t.length >= 5 ? t.substring(0, 5) : t) : '');
const toMinutes = (t: string) => {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
};
const fromMinutes = (mins: number) => {
  const total = ((mins % (24 * 60)) + 24 * 60) % (24 * 60);
  const h = Math.floor(total / 60);
  const m = total % 60;
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
};
const computeDurationMin = (start?: string, end?: string) => {
  if (!start || !end) return 0;
  const s = toMinutes(normalizeTime(start));
  const e = toMinutes(normalizeTime(end));
  let d = e - s;
  if (d < 0) d += 24 * 60;
  return d;
};
const formatDurationHours = (mins: number) => {
  if (mins <= 0) return '0 h';
  const hours = mins / 60;
  // Mostrar sin decimales si es entero, con un decimal si no
  const formatted = Number.isInteger(hours) ? hours.toString() : hours.toFixed(2).replace(/\.?0+$/, '');
  return `${formatted.replace('.', ',')} h`;
};

const FieldStatus = ({ status }: { status?: FieldSaveStatus }) => {
  if (!status || status === 'idle') return null;
  if (status === 'saving') return <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" aria-label="Guardando" />;
  if (status === 'saved') return <Check className="h-3.5 w-3.5 text-emerald-600" aria-label="Guardado" />;
  if (status === 'error') return <AlertCircle className="h-3.5 w-3.5 text-destructive" aria-label="Error" />;
  return null;
};

export const TaskScheduleSection = ({
  task,
  formData,
  propertyData: _propertyData,
  onFieldChange,
  onFieldBlur,
  onScheduleSave,
  statusByField,
}: TaskScheduleSectionProps) => {
  const startTime = normalizeTime(formData.startTime);
  const endTime = normalizeTime(formData.endTime);
  const currentDuration = computeDurationMin(startTime, endTime);
  const currentHours = currentDuration / 60;

  // Local duration state in HOURS (decimal) — autosave on blur
  const [durationInput, setDurationInput] = useState<string>(
    Number.isInteger(currentHours) ? currentHours.toString() : currentHours.toFixed(2).replace(/\.?0+$/, '')
  );
  useEffect(() => {
    setDurationInput(
      Number.isInteger(currentHours) ? currentHours.toString() : currentHours.toFixed(2).replace(/\.?0+$/, '')
    );
  }, [currentHours]);

  // Apply duration in minutes → recompute endTime from startTime
  const applyDuration = (mins: number) => {
    if (!startTime || mins <= 0) return;
    const newEnd = fromMinutes(toMinutes(startTime) + mins);
    onFieldChange('endTime', newEnd);
    if (onScheduleSave) onScheduleSave({ endTime: newEnd });
    else onFieldBlur?.('endTime', newEnd);
  };

  const adjustDuration = (deltaMin: number) => {
    const next = Math.max(15, currentDuration + deltaMin);
    applyDuration(next);
  };

  const setDateTo = (date: Date) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    onFieldChange('date', dateStr);
    if (onScheduleSave) onScheduleSave({ date: dateStr });
    else onFieldBlur?.('date', dateStr);
  };

  const handleStartBlur = () => {
    if (formData.startTime) onFieldBlur?.('startTime', formData.startTime);
    if (formData.endTime) onFieldBlur?.('endTime', formData.endTime);
  };
  const handleEndBlur = () => {
    if (formData.endTime) onFieldBlur?.('endTime', formData.endTime);
  };

  const handleDurationBlur = () => {
    // Aceptar coma o punto como separador decimal
    const normalized = durationInput.replace(',', '.').trim();
    const hoursParsed = parseFloat(normalized);
    if (!isNaN(hoursParsed) && hoursParsed > 0) {
      // Snap a 15 min (0.25 h)
      const minutes = Math.max(15, Math.round((hoursParsed * 60) / 15) * 15);
      if (minutes !== currentDuration) {
        applyDuration(minutes);
        return;
      }
    }
    // Reset al valor actual si entrada inválida
    setDurationInput(
      Number.isInteger(currentHours) ? currentHours.toString() : currentHours.toFixed(2).replace(/\.?0+$/, '')
    );
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Clock className="h-5 w-5 text-primary" />
          Horarios
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Fecha */}
          <div className="space-y-2">
            <Label className="text-sm font-medium text-foreground flex items-center gap-2">
              Fecha
              <FieldStatus status={statusByField?.date} />
            </Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    'justify-start text-left font-normal min-w-[200px]',
                    !formData.date && 'text-muted-foreground'
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {formData.date ? format(new Date(formData.date), 'PPP') : <span>Selecciona fecha</span>}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0 bg-popover" align="start">
                <Calendar
                  mode="single"
                  selected={formData.date ? new Date(formData.date) : undefined}
                  onSelect={d => d && setDateTo(d)}
                  initialFocus
                  className={cn('p-3 pointer-events-auto')}
                />
              </PopoverContent>
            </Popover>
          </div>

          {/* Horarios + duración */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label className="text-sm font-medium text-foreground flex items-center gap-2">
                Inicio
                <FieldStatus status={statusByField?.startTime} />
              </Label>
              <Input
                type="time"
                step={900}
                value={formData.startTime || ''}
                onChange={e => onFieldChange('startTime', e.target.value)}
                onBlur={handleStartBlur}
              />
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-medium text-foreground flex items-center gap-2">
                Fin
                <FieldStatus status={statusByField?.endTime} />
              </Label>
              <Input
                type="time"
                step={900}
                value={formData.endTime || ''}
                onChange={e => onFieldChange('endTime', e.target.value)}
                onBlur={handleEndBlur}
              />
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-medium text-foreground flex items-center gap-2">
                <Hourglass className="h-3.5 w-3.5" />
                Duración
              </Label>
              <div className="flex items-center gap-1.5">
                <Input
                  type="text"
                  inputMode="decimal"
                  value={durationInput}
                  onChange={e => setDurationInput(e.target.value)}
                  onBlur={handleDurationBlur}
                  className="w-20"
                  placeholder="0"
                />
                <span className="text-sm text-muted-foreground whitespace-nowrap">
                  h · {formatDurationHours(currentDuration)}
                </span>
              </div>
            </div>
          </div>

          {/* Atajos rápidos de duración */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-muted-foreground mr-1">Atajos:</span>
            <Button type="button" variant="outline" size="sm" onClick={() => adjustDuration(-30)} className="h-7 px-2 text-xs">
              −30m
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={() => adjustDuration(-15)} className="h-7 px-2 text-xs">
              −15m
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={() => adjustDuration(15)} className="h-7 px-2 text-xs">
              +15m
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={() => adjustDuration(30)} className="h-7 px-2 text-xs">
              +30m
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={() => adjustDuration(60)} className="h-7 px-2 text-xs">
              +1h
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
