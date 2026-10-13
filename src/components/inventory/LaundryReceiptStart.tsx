import { ArrowRight, CalendarDays, ClipboardList, History, Info, MapPin, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Props = {
  workerName: string;
  warehouseName: string;
  date: string;
  today: string;
  pendingDates: string[];
  locked: boolean;
  resumeDisabled: boolean;
  adminMode: boolean;
  onSelectDate: (date: string) => void;
  onStart: () => void;
};

function displayDate(date: string) {
  return new Intl.DateTimeFormat("es-ES", {
    day: "numeric", month: "long", year: "numeric", timeZone: "UTC",
  }).format(new Date(`${date}T12:00:00Z`));
}

export default function LaundryReceiptStart({ workerName, warehouseName, date, today, pendingDates, locked, resumeDisabled, adminMode, onSelectDate, onStart }: Props) {
  const dateId = `receipt-date-${adminMode ? "admin" : "public"}`;
  const Heading = adminMode ? "h3" : "h1";
  return (
    <div className="receipt-stage space-y-5 pb-6">
      <header className="space-y-4 pt-2">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <ClipboardList className="h-6 w-6" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-primary">APP GESTIÓN LIMPATEX</p>
            <Heading className="text-xl font-bold leading-tight tracking-tight text-slate-900 sm:text-2xl">Inventario de lencería</Heading>
          </div>
        </div>
        <div className="space-y-1.5 border-b border-slate-200 pb-4 text-sm text-slate-600">
          <p className="flex items-start gap-2"><UserRound className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" /><span className="break-words font-medium text-slate-800">{workerName}</span></p>
          <p className="flex items-start gap-2"><MapPin className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" /><span className="break-words">{warehouseName}</span></p>
        </div>
      </header>

      <section aria-label="Nueva entrega" className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="space-y-4 p-4 sm:p-5">
          <div>
            <h2 className="text-base font-bold text-slate-900">Registrar una entrega</h2>
            <p className="mt-1 text-sm leading-5 text-slate-500">Selecciona la fecha en la que recibiste la lencería.</p>
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-3">
              <label htmlFor={dateId} className="flex items-center gap-2 text-sm font-semibold text-slate-700"><CalendarDays className="h-4 w-4 text-primary" aria-hidden="true" />Fecha de la entrega</label>
              {date === today ? <span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary">Hoy</span> : <Button variant="ghost" className="h-9 px-2 text-sm text-primary" disabled={locked} onClick={() => onSelectDate(today)}>Volver a hoy</Button>}
            </div>
            <Input id={dateId} type="date" min="0001-01-01" max={today} value={date} disabled={locked} onChange={(event) => onSelectDate(event.target.value)}
              className="block h-12 min-w-0 max-w-full appearance-none rounded-xl border-slate-300 bg-slate-50 text-base [color-scheme:light] [&::-webkit-date-and-time-value]:text-left" />
          </div>
          {date < today && <div className="flex gap-2 rounded-xl bg-amber-50 p-3 text-xs leading-5 text-amber-900" role="note"><Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" /><p>Esta entrega es de un día anterior. Al confirmar el recuento, se actualizará el stock actual.</p></div>}
          <Button className="h-auto min-h-12 w-full gap-2 whitespace-normal rounded-xl px-4 py-3 text-base font-semibold" disabled={locked} onClick={onStart}>
            {date === today ? "Iniciar recuento de hoy" : `Iniciar recuento del ${displayDate(date)}`}<ArrowRight className="h-4 w-4 shrink-0" aria-hidden="true" />
          </Button>
        </div>
        <p className="border-t border-slate-100 bg-slate-50/70 px-4 py-3 text-center text-xs leading-5 text-slate-500">Añade las cantidades por tandas y revisa antes de confirmar.</p>
      </section>

      {pendingDates.length > 0 && <section aria-label="Recuentos pendientes" className="rounded-2xl border border-amber-200 bg-amber-50/60 p-4 sm:p-5">
        <div className="flex items-start gap-3">
          <History className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" aria-hidden="true" />
          <div>
            <h2 className="text-sm font-bold text-slate-900">Recuentos sin confirmar <span className="ml-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-900">{pendingDates.length}</span></h2>
            <p className="mt-1 text-xs leading-5 text-slate-600">Puedes continuar una entrega pendiente.</p>
          </div>
        </div>
        <div className="mt-3 space-y-2">
          {pendingDates.map((pendingDate) => <Button key={pendingDate} variant="outline" disabled={resumeDisabled} onClick={() => onSelectDate(pendingDate)} className="flex h-auto min-h-11 w-full justify-between gap-3 whitespace-normal rounded-xl border-amber-200 bg-white px-3 py-3 text-left text-sm">
            <span>{displayDate(pendingDate)}</span><span className="flex shrink-0 items-center gap-1 font-semibold text-primary">Retomar<ArrowRight className="h-4 w-4" aria-hidden="true" /></span>
          </Button>)}
        </div>
      </section>}
    </div>
  );
}
