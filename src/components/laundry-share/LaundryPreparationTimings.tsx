import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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

  return (
    <Card>
      <CardHeader>
        <CardTitle>Tiempos de preparación · Solo tú</CardTitle>
        <p className="text-sm text-muted-foreground">
          Tiempo entre bolsas distintas marcadas por la misma persona durante el día, en horario de Madrid.
          Incluye pausas. La primera bolsa no tiene tiempo previo. Las pulsaciones repetidas sobre una misma bolsa se cuentan una vez al día.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-end gap-3">
          <label className="space-y-1 text-sm">Día de preparación
            <Input type="date" value={day} onChange={event => { setDay(event.target.value); setWorker('all'); }} />
          </label>
          <label className="space-y-1 text-sm">Persona
            <select className="flex h-10 w-full rounded-md border border-input bg-background px-3" value={worker} onChange={event => setWorker(event.target.value)}>
              <option value="all">Todas</option>
              {workers.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
            </select>
          </label>
          <Button variant="outline" disabled={!day || query.isFetching} onClick={() => void query.refetch()}>Actualizar tiempos</Button>
        </div>
        {query.isError ? <p role="alert" className="text-sm text-destructive">No se pudieron cargar los tiempos. Pulsa «Actualizar tiempos» para reintentar.</p>
          : query.isPending ? <p role="status">Cargando tiempos…</p>
          : <>
            <p className="text-sm"><strong>{visible.length}</strong> bolsas · <strong>{measured.length}</strong> intervalos · Media: <strong>{measured.length ? duration(total / measured.length) : 'Sin intervalos todavía'}</strong></p>
            {workers.length > 1 && worker === 'all' && <ul className="text-sm space-y-1">
              {workers.map(([id, name]) => {
                const bags = rows.filter(row => row.worker_id === id);
                const intervals = bags.filter(row => row.elapsed_seconds !== null);
                const sum = intervals.reduce((value, row) => value + Number(row.elapsed_seconds), 0);
                return <li key={id}>{name}: {bags.length} bolsas · Media {intervals.length ? duration(sum / intervals.length) : 'sin intervalo previo'}</li>;
              })}
            </ul>}
            {!visible.length ? <p className="text-sm text-muted-foreground">No hay bolsas preparadas registradas para este día.</p> :
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <caption className="sr-only">Detalle de tiempos entre bolsas</caption>
                  <thead><tr className="border-b">{['Persona', 'Bolsa / propiedad', 'Anterior', 'Preparada', 'Intervalo'].map(title => <th key={title} scope="col" className="p-2">{title}</th>)}</tr></thead>
                  <tbody>{visible.map(row => <tr key={row.event_id} className="border-b">
                    <td className="p-2">{row.worker_name}</td><td className="p-2">{row.property_name}</td>
                    <td className="whitespace-nowrap p-2">{row.previous_prepared_at ? clock(row.previous_prepared_at) : '—'}</td>
                    <td className="whitespace-nowrap p-2">{clock(row.prepared_at)}</td>
                    <td className="whitespace-nowrap p-2">{row.elapsed_seconds === null ? 'Primera bolsa del día' : duration(Number(row.elapsed_seconds))}</td>
                  </tr>)}</tbody>
                </table>
              </div>}
          </>}
      </CardContent>
    </Card>
  );
}
