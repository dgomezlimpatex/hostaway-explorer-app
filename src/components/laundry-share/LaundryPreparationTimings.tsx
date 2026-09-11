import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Clock3, LockKeyhole, RefreshCw, Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

type Timing = {
  event_id: string;
  worker_id: string;
  worker_name: string;
  task_id: string;
  property_name: string;
  prepared_at: string;
  previous_prepared_at: string | null;
  elapsed_seconds: number | null;
};

const madridToday = () => new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Europe/Madrid', year: 'numeric', month: '2-digit', day: '2-digit',
}).format(new Date());
const clock = (value: string) => new Intl.DateTimeFormat('es-ES', {
  timeZone: 'Europe/Madrid', hour: '2-digit', minute: '2-digit', second: '2-digit',
}).format(new Date(value));
const duration = (seconds: number) => {
  const rounded = Math.round(seconds);
  return `${Math.floor(rounded / 60)} min ${rounded % 60} s`;
};

export function LaundryPreparationTimings({ sedeId }: { sedeId: string }) {
  const [day, setDay] = useState(madridToday);
  const [worker, setWorker] = useState('all');
  const [search, setSearch] = useState('');
  const [order, setOrder] = useState('recent');
  const query = useQuery({
    queryKey: ['laundry-preparation-timings', sedeId, day],
    enabled: Boolean(day),
    queryFn: async (): Promise<Timing[]> => {
      // This RPC is introduced by a migration; keep generated types untouched.
      const { data, error } = await supabase.rpc('laundry_preparation_timings' as never, {
        p_sede_id: sedeId, p_day: day,
      } as never);
      if (error) throw error;
      return (data || []) as unknown as Timing[];
    },
    refetchInterval: 30_000,
  });
  const rows = query.data || [];
  const workers = [...new Map(rows.map(row => [row.worker_id, row.worker_name])).entries()];
  const visible = rows.filter(row => worker === 'all' || row.worker_id === worker);
  const measured = visible.filter(row => row.elapsed_seconds !== null);
  const total = measured.reduce((sum, row) => sum + Number(row.elapsed_seconds), 0);


  const intervals = measured.map(row => Number(row.elapsed_seconds)).sort((a, b) => a - b);
  const mid = Math.floor(intervals.length / 2);
  const median = intervals.length ? (intervals.length % 2 ? intervals[mid] : (intervals[mid - 1] + intervals[mid]) / 2) : null;
  const normalize = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const detail = visible.filter(row => normalize(row.property_name).includes(normalize(search))).sort((a, b) => order === 'longest' ? (b.elapsed_seconds ?? -1) - (a.elapsed_seconds ?? -1) : Date.parse(b.prepared_at) - Date.parse(a.prepared_at));
  return <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm" aria-label="Tiempos de preparación">
    <header className="bg-slate-900 p-5 text-white sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-3"><div className="flex items-center gap-3"><span className="rounded-xl bg-teal-400/15 p-2.5 text-teal-300"><Clock3 className="h-6 w-6" /></span><div><p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-teal-300">Control de lavandería</p><h2 className="mt-1 text-xl font-semibold tracking-tight">Tiempos de preparación</h2></div></div><span className="flex items-center gap-1.5 rounded-full border border-slate-600 px-3 py-1 text-xs"><LockKeyhole className="h-3 w-3" />Solo tú</span></div>
      <p className="mt-3 text-xs text-slate-300">Actividad del equipo e intervalos entre bolsas · Horario de Madrid</p>
    </header>
    <div className="space-y-5 p-4 sm:p-6">
      <div className="flex flex-wrap items-end gap-3"><label className="space-y-1.5 text-xs font-medium text-slate-600">Día de preparación<Input className="w-40" type="date" value={day} onChange={event => { setDay(event.target.value); setWorker('all'); setSearch(''); }} /></label><Button variant="ghost" onClick={() => { setDay(madridToday()); setWorker('all'); setSearch(''); }}>Hoy</Button><Button variant="outline" className="sm:ml-auto" disabled={!day || query.isFetching} onClick={() => void query.refetch()}><RefreshCw className={cn('mr-2 h-4 w-4', query.isFetching && 'animate-spin')} />Actualizar</Button></div>
      {!day ? <p className="p-6 text-sm text-slate-500">Selecciona una fecha.</p> : query.isError ? <p role="alert" className="rounded-xl bg-red-50 p-4 text-sm text-red-800">No se pudieron cargar los tiempos. Pulsa «Actualizar» para reintentar.</p> : query.isPending ? <p role="status" className="p-6 text-sm">Cargando actividad…</p> : <>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{[
          ['Bolsas preparadas', String(visible.length), worker === 'all' ? 'Todas las personas' : 'Persona seleccionada'],
          ['Intervalo medio', measured.length ? duration(total / measured.length) : '—', measured.length + ' intervalos registrados'],
          ['Intervalo mediano', median === null ? '—' : duration(median), 'Valor central de los intervalos'],
          ['Personas con actividad', String(new Set(visible.map(row => row.worker_id)).size), 'En el día seleccionado'],
        ].map(([label, value, hint]) => <div key={label} className="rounded-xl border border-slate-200 bg-slate-50/70 p-4"><p className="text-xs font-medium text-slate-600">{label}</p><p className="mt-3 font-mono text-xl font-semibold tracking-tight text-slate-900 sm:text-2xl">{value}</p><p className="mt-1 text-[11px] text-slate-500">{hint}</p></div>)}</div>
        <div><div className="mb-3 flex items-center justify-between"><h3 className="text-sm font-semibold">Preparación por persona</h3>{worker !== 'all' && <Button variant="ghost" size="sm" onClick={() => setWorker('all')}>Ver todas</Button>}</div>
          {!workers.length ? <div className="rounded-xl border border-dashed p-8 text-center text-sm text-slate-500">Sin bolsas registradas. Prueba con otro día.</div> : <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{workers.map(([id, name]) => {
            const bags = rows.filter(row => row.worker_id === id);
            const measuredBags = bags.filter(row => row.elapsed_seconds !== null);
            const sum = measuredBags.reduce((value, row) => value + Number(row.elapsed_seconds), 0);
            const times = bags.map(row => row.prepared_at).sort();
            return <button key={id} type="button" aria-pressed={worker === id} onClick={() => { setWorker(worker === id ? 'all' : id); setSearch(''); }} className={cn('rounded-xl border p-4 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600 focus-visible:ring-offset-2', worker === id ? 'border-teal-600 bg-teal-50' : 'border-slate-200 hover:border-teal-400 hover:bg-slate-50')}>
              <div className="flex items-center gap-3"><span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-teal-100 text-xs font-bold text-teal-800">{name.split(' ').filter(Boolean).slice(0, 2).map(part => part[0]).join('')}</span><span className="text-xs font-semibold text-slate-800">{name}</span><span className="ml-auto font-mono text-2xl font-semibold">{bags.length}<span className="block text-right font-sans text-[10px] font-normal text-slate-500">bolsas</span></span></div>
              <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-teal-600" style={{ width: bags.length / rows.length * 100 + '%' }} /></div>
              <div className="mt-3 flex flex-wrap justify-between gap-1 text-xs text-slate-600"><span>Media <strong>{measuredBags.length ? duration(sum / measuredBags.length) : '—'}</strong></span><span className="font-mono text-[11px]">{clock(times[0])} – {clock(times[times.length - 1])}</span></div>
            </button>;
          })}</div>}
        </div>
        {rows.length > 0 && <div className="overflow-hidden rounded-xl border border-slate-200">
          <div className="flex flex-wrap items-center gap-3 border-b bg-slate-50 px-4 py-3"><div className="mr-auto"><h3 className="text-sm font-semibold">Registro de bolsas</h3><p className="text-xs text-slate-500">{detail.length} resultados{worker !== 'all' ? ' · ' + (workers.find(([id]) => id === worker)?.[1] || '') : ''}</p></div><div className="relative w-full sm:w-56"><Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" /><Input aria-label="Buscar propiedad" value={search} onChange={event => setSearch(event.target.value)} placeholder="Buscar propiedad…" className="bg-white pl-9" /></div><select aria-label="Orden del registro" value={order} onChange={event => setOrder(event.target.value)} className="h-10 max-w-full rounded-md border bg-white px-3 text-xs"><option value="recent">Más recientes primero</option><option value="longest">Mayor intervalo primero</option></select></div>
          {!detail.length ? <p className="p-6 text-center text-sm text-slate-500">No hay bolsas que coincidan con la búsqueda.</p> : <div className="max-h-[480px] overflow-auto"><table className="w-full text-left text-xs"><caption className="sr-only">Intervalos entre bolsas, incluyendo pausas</caption><thead className="sticky top-0 bg-slate-100 text-[10px] uppercase tracking-wide text-slate-600"><tr>{['Bolsa / propiedad', 'Persona', 'Anterior', 'Preparada', 'Intervalo'].map(title => <th key={title} scope="col" className="px-4 py-3 font-semibold">{title}</th>)}</tr></thead><tbody>{detail.map(row => <tr key={row.event_id} className="border-t border-slate-100 hover:bg-teal-50/40"><td className="min-w-48 px-4 py-3 font-medium text-slate-900">{row.property_name}</td><td className="min-w-36 px-4 py-3 text-slate-600">{row.worker_name}</td><td className="whitespace-nowrap px-4 py-3 font-mono text-slate-500">{row.previous_prepared_at ? clock(row.previous_prepared_at) : '—'}</td><td className="whitespace-nowrap px-4 py-3 font-mono text-slate-800">{clock(row.prepared_at)}</td><td className="whitespace-nowrap px-4 py-3"><span className={cn('rounded-md px-2 py-1 font-mono', row.elapsed_seconds === null ? 'bg-slate-100 text-[10px] text-slate-500' : 'bg-teal-50 font-semibold text-teal-900')}>{row.elapsed_seconds === null ? 'Primera del día' : duration(Number(row.elapsed_seconds))}</span></td></tr>)}</tbody></table></div>}
        </div>}
      </>}
      <details className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-500"><summary className="cursor-pointer font-medium">Cómo se calculan estos tiempos</summary><p className="mt-2 leading-relaxed">Se mide el intervalo entre bolsas distintas marcadas por la misma persona. Incluye pausas y no equivale al tiempo efectivo de preparación. La primera bolsa no tiene intervalo previo. Las pulsaciones repetidas se cuentan una vez al día por bolsa. La mediana es el valor central y resulta menos sensible a intervalos muy largos. Actualización automática cada 30 segundos.</p></details>
    </div>
  </section>;
}
