import React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { DAY_OF_WEEK_LABELS } from '@/types/workerAbsence';
import { buildDaySchedules, DayTimes } from '@/utils/weeklyScheduleDays';

interface Props {
  days: number[];
  times: DayTimes;
  startTime: string;
  endTime: string;
  individual: boolean;
  onIndividual: (value: boolean) => void;
  onTimes: (value: DayTimes) => void;
}

export const DayScheduleFields = ({ days, times, startTime, endTime, individual, onIndividual, onTimes }: Props) => (
  <div className="space-y-3">
    <div className="grid grid-cols-2 gap-1 rounded-xl bg-muted p-1">
      <Button type="button" size="sm" variant={individual ? 'ghost' : 'secondary'} aria-pressed={!individual} onClick={() => onIndividual(false)}>Mismo horario</Button>
      <Button type="button" size="sm" variant={individual ? 'secondary' : 'ghost'} aria-pressed={individual} onClick={() => onIndividual(true)}>Horario por día</Button>
    </div>
    {individual && <div className="space-y-2">
      {buildDaySchedules(days, times, startTime, endTime).map(row => {
        const day = row.daysOfWeek[0];
        const name = DAY_OF_WEEK_LABELS[day];
        return <div key={day} className="rounded-xl border bg-muted/20 p-3">
          <p className="mb-2 text-sm font-semibold">{name}</p>
          <div className="grid grid-cols-2 gap-3">
            <div><Label htmlFor={`day-start-${day}`} className="text-xs text-muted-foreground">Desde</Label><Input id={`day-start-${day}`} aria-label={`Inicio ${name}`} type="time" required value={row.startTime} onChange={event => onTimes({ ...times, [day]: { startTime: event.target.value, endTime: row.endTime } })} /></div>
            <div><Label htmlFor={`day-end-${day}`} className="text-xs text-muted-foreground">Hasta</Label><Input id={`day-end-${day}`} aria-label={`Fin ${name}`} type="time" required value={row.endTime} onChange={event => onTimes({ ...times, [day]: { startTime: row.startTime, endTime: event.target.value } })} /></div>
          </div>
          {row.endTime <= row.startTime && <p className="mt-1 text-xs text-destructive">El fin debe ser posterior al inicio.</p>}
        </div>;
      })}
      <p className="text-xs text-muted-foreground">Cada día se guardará por separado para que puedas editarlo después.</p>
    </div>}
  </div>
);
