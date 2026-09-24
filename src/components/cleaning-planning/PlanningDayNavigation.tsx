import { addDays } from 'date-fns';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatMadridDate, getTodayMadrid } from '@/utils/date';

export function PlanningDayNavigation({date,disabled,onChange}:{date:Date;disabled?:boolean;onChange:(date:Date)=>void}) {
  return <nav aria-label="Cambiar día del planning" className="mb-4 flex flex-wrap items-center gap-2 rounded-lg border border-line bg-white p-3">
    <Button variant="outline" className="h-11 w-11 p-0" aria-label="Día anterior" disabled={disabled} onClick={()=>onChange(addDays(date,-1))}><ChevronLeft className="h-4 w-4" /></Button>
    <input aria-label="Día del planning" type="date" value={formatMadridDate(date)} disabled={disabled}
      className="h-11 min-w-0 rounded-lg border border-line px-3 text-base"
      onChange={event=>{const value=event.target.value;if(!/^\d{4}-\d{2}-\d{2}$/.test(value))return;const next=new Date(`${value}T12:00:00`);if(!Number.isNaN(next.getTime()))onChange(next);}} />
    <Button variant="outline" className="h-11 w-11 p-0" aria-label="Día siguiente" disabled={disabled} onClick={()=>onChange(addDays(date,1))}><ChevronRight className="h-4 w-4" /></Button>
    <Button variant="ghost" className="h-11" disabled={disabled} onClick={()=>onChange(getTodayMadrid())}>Hoy</Button>
    <p className="text-xs text-ink-3">Cambiar de día no guarda el reparto.</p>
  </nav>;
}
