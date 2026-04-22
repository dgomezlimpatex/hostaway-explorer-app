import React, { useEffect, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarIcon, Loader2, Check, AlertCircle, Hourglass, Clock } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
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
  /** When true, fields are displayed but cannot be edited. */
  readOnly?: boolean;
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
  const formatted = Number.isInteger(hours) ? hours.toString() : hours.toFixed(2).replace(/\.?0+$/, '');
  return `${formatted.replace('.', ',')} h`;
};

const FieldStatus = ({ status }: { status?: FieldSaveStatus }) => {
  if (!status || status === 'idle') return null;
  if (status === 'saving') return <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" aria-label="Guardando" />;
  if (status === 'saved') return <Check className="h-3 w-3 text-emerald-600" aria-label="Guardado" />;
  if (status === 'error') return <AlertCircle className="h-3 w-3 text-destructive" aria-label="Error" />;
  return null;
};

export const TaskScheduleSection = ({
  task: _task,
  formData,
  propertyData: _propertyData,
  onFieldChange,
  onFieldBlur,
  onScheduleSave,
  statusByField,
  readOnly = false,
}: TaskScheduleSectionProps) => {
  const startTime = normalizeTime(formData.startTime);
  const endTime = normalizeTime(formData.endTime);
  const currentDuration = computeDurationMin(startTime, endTime);
  const currentHours = currentDuration / 60;

  const [durationInput, setDurationInput] = useState<string>(
    Number.isInteger(currentHours) ? currentHours.toString() : currentHours.toFixed(2).replace(/\.?0+$/, '')
  );
  useEffect(() => {
    setDurationInput(
      Number.isInteger(currentHours) ? currentHours.toString() : currentHours.toFixed(2).replace(/\.?0+$/, '')
    );
  }, [currentHours]);

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
    const normalized = durationInput.replace(',', '.').trim();
    const hoursParsed = parseFloat(normalized);
    if (!isNaN(hoursParsed) && hoursParsed > 0) {
      const minutes = Math.max(15, Math.round((hoursParsed * 60) / 15) * 15);
      if (minutes !== currentDuration) {
        applyDuration(minutes);
        return;
      }
    }
    setDurationInput(
      Number.isInteger(currentHours) ? currentHours.toString() : currentHours.toFixed(2).replace(/\.?0+$/, '')
    );
  };

  return (
    <section className="space-y-3">
      <div className="flex items-center gap-2">
        <Clock className="h-4 w-4 text-blue-500" />
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Horarios</h3>
      </div>

      {/* Fecha */}
      <div className="flex items-center gap-3">
        <span className="text-xs text-muted-foreground w-16 flex-shrink-0">Fecha</span>
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              disabled={readOnly}
              className={cn(
                'justify-start text-left font-normal h-8 px-2 -ml-2',
                'hover:bg-muted/60 transition-colors',
                !formData.date && 'text-muted-foreground',
                readOnly && 'opacity-100 cursor-default hover:bg-transparent disabled:opacity-100'
              )}
            >
              <CalendarIcon className="mr-2 h-3.5 w-3.5 text-violet-500" />
              {formData.date ? format(new Date(formData.date), "EEEE d 'de' MMMM, yyyy", { locale: es }) : 'Selecciona fecha'}
            </Button>
          </PopoverTrigger>
          {!readOnly && (
            <PopoverContent className="w-auto p-0 bg-popover" align="start">
              <Calendar
                mode="single"
                selected={formData.date ? new Date(formData.date) : undefined}
                onSelect={d => d && setDateTo(d)}
                initialFocus
                className={cn('p-3 pointer-events-auto')}
              />
            </PopoverContent>
          )}
        </Popover>
        <FieldStatus status={statusByField?.date} />
      </div>

      {/* Horario: Inicio - Fin - Duración en línea */}
      <div className="flex items-center gap-3 flex-wrap">
        <span className="text-xs text-muted-foreground w-16 flex-shrink-0">Horario</span>
        <div className="flex items-center gap-2">
          <Input
            type="time"
            step={900}
            value={formData.startTime || ''}
            onChange={e => onFieldChange('startTime', e.target.value)}
            onBlur={handleStartBlur}
            readOnly={readOnly}
            disabled={readOnly}
            className={cn(
              'h-8 w-24 px-2 border-0 shadow-none bg-muted/40',
              'hover:bg-muted/70 focus-visible:ring-1 focus-visible:ring-primary/30',
              'font-mono text-sm transition-colors',
              readOnly && 'disabled:opacity-100 cursor-default'
            )}
          />
          <FieldStatus status={statusByField?.startTime} />
          <span className="text-muted-foreground text-xs">→</span>
          <Input
            type="time"
            step={900}
            value={formData.endTime || ''}
            onChange={e => onFieldChange('endTime', e.target.value)}
            onBlur={handleEndBlur}
            readOnly={readOnly}
            disabled={readOnly}
            className={cn(
              'h-8 w-24 px-2 border-0 shadow-none bg-muted/40',
              'hover:bg-muted/70 focus-visible:ring-1 focus-visible:ring-primary/30',
              'font-mono text-sm transition-colors',
              readOnly && 'disabled:opacity-100 cursor-default'
            )}
          />
          <FieldStatus status={statusByField?.endTime} />
        </div>

        {/* Duración inline */}
        <div className="flex items-center gap-1.5 ml-6">
          <Hourglass className="h-3.5 w-3.5 text-amber-500" />
          <span className="text-xs text-muted-foreground font-medium">Duración</span>
          <Input
            type="text"
            inputMode="decimal"
            value={durationInput}
            onChange={e => setDurationInput(e.target.value)}
            onBlur={handleDurationBlur}
            readOnly={readOnly}
            disabled={readOnly}
            className={cn(
              'h-8 w-14 px-2 text-center border-0 shadow-none bg-muted/40',
              'hover:bg-muted/70 focus-visible:ring-1 focus-visible:ring-primary/30',
              'font-mono text-sm transition-colors',
              readOnly && 'disabled:opacity-100 cursor-default'
            )}
            placeholder="0"
          />
          <span className="text-xs text-muted-foreground font-medium">h</span>
        </div>
      </div>

      {/* Atajos rápidos de duración */}
      {!readOnly && (
        <div className="flex items-center gap-1.5 pl-[76px] flex-wrap">
          {[
            { label: '−30m', delta: -30 },
            { label: '−15m', delta: -15 },
            { label: '+15m', delta: 15 },
            { label: '+30m', delta: 30 },
            { label: '+1h', delta: 60 },
          ].map(s => (
            <button
              key={s.label}
              type="button"
              onClick={() => adjustDuration(s.delta)}
              className={cn(
                'h-6 px-2 text-[11px] font-medium rounded-md',
                'text-muted-foreground hover:text-foreground',
                'bg-transparent hover:bg-muted/60 transition-colors',
                'border border-transparent hover:border-border'
              )}
            >
              {s.label}
            </button>
          ))}
        </div>
      )}
    </section>
  );
};
