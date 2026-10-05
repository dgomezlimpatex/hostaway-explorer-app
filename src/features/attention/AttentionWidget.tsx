import { useEffect, useState } from 'react';
import { useInfiniteQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { GroupedTaskReportModal } from '@/components/modals/GroupedTaskReportModal';
import { useClientData } from '@/hooks/useClientData';
import type { Task } from '@/types/calendar';
import { formatMadridDate } from '@/utils/date';
import { alertKinds, alertLabels, type AlertKind } from './domain';
import { readReviewHistory } from './storage';
import { useAttention } from './useAttention';
import { AttentionPanel } from './AttentionPanel';

export function AttentionWidget({onTask}: {onTask: (task: Task) => void}) {
  const attention = useAttention();
  const {getClientName} = useClientData();
  const [reportTask, setReportTask] = useState<Task | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  useEffect(() => {setReportTask(null); setHistoryOpen(false);}, [attention.sedeId]);
  if (!attention.allowed) return null;
  const groups = attention.groups.map(group => ({...group, alerts: group.alerts.map(alert => ({...alert, client: alert.client || getClientName(group.task.clienteId || '')}))}));
  return <>
    <AttentionPanel key={`${attention.sedeId}:${attention.date}`} groups={groups} issues={attention.issues}
      loading={!attention.enabled || attention.query.isPending} error={attention.query.error?.message}
      onRetry={() => void attention.query.refetch()} onReview={alert => attention.review.mutateAsync(alert)}
      onTask={onTask} onReports={setReportTask} onHistory={() => setHistoryOpen(true)} />
    <ReviewHistory key={attention.sedeId} sedeId={attention.sedeId} open={historyOpen} onOpenChange={setHistoryOpen} />
    <GroupedTaskReportModal task={reportTask} open={reportTask !== null} onOpenChange={open => {if (!open) setReportTask(null);}} />
  </>;
}
function ReviewHistory({sedeId, open, onOpenChange}: {sedeId: string; open: boolean; onOpenChange: (open: boolean) => void}) {
  const [from, setFrom] = useState(() => formatMadridDate(new Date(Date.now() - 30 * 86400000)));
  const [to, setTo] = useState(() => formatMadridDate(new Date()));
  const [kind, setKind] = useState<AlertKind | 'all'>('all');
  const valid = !!from && !!to && from <= to;
  const history = useInfiniteQuery({
    queryKey: ['attention-history', sedeId, from, to, kind], initialPageParam: 0,
    queryFn: ({pageParam}) => readReviewHistory(sedeId, from, to, kind, pageParam),
    getNextPageParam: (lastPage, pages) => lastPage.length === 100 ? pages.length * 100 : undefined,
    enabled: open && !!sedeId && valid, retry: 1,
  });
  const rows = history.data?.pages.flat() || [];
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="max-h-[85dvh] overflow-y-auto sm:max-w-2xl"><DialogHeader><DialogTitle>Historial de avisos revisados</DialogTitle><DialogDescription>Solo se conservan los avisos marcados como revisados. Las fechas filtran el día de la tarea.</DialogDescription></DialogHeader>
    <div className="flex flex-wrap gap-3 text-sm">
      <label>Desde<input type="date" value={from} onChange={e => setFrom(e.target.value)} className="block rounded border p-2" /></label>
      <label>Hasta<input type="date" value={to} onChange={e => setTo(e.target.value)} className="block rounded border p-2" /></label>
      <label>Tipo<select value={kind} onChange={e => setKind(e.target.value as AlertKind | 'all')} className="block rounded border p-2"><option value="all">Todos</option>{alertKinds.map(k => <option key={k} value={k}>{alertLabels[k]}</option>)}</select></label>
    </div>
    {!valid ? <p role="alert">Selecciona un intervalo de fechas válido.</p> : history.isPending ? <p role="status">Cargando historial…</p> : history.isError ? <div role="alert"><p>{history.error.message}</p><Button variant="outline" onClick={() => void history.refetch()}>Reintentar</Button></div>
      : !rows.length ? <p>No hay avisos revisados en este periodo.</p> : rows.map(row => <article key={row.id} className="space-y-1 rounded border p-3 text-sm"><p className="font-semibold">{row.snapshot.property} · {row.task_date}</p><p>{row.snapshot.title}</p><p>{row.snapshot.detail}</p><p>{row.snapshot.client} · {row.snapshot.cleanerName}</p><p className="text-xs text-muted-foreground">Revisado por {row.reviewed_by_name} · {new Intl.DateTimeFormat('es-ES', {timeZone: 'Europe/Madrid', dateStyle: 'short', timeStyle: 'short'}).format(new Date(row.reviewed_at))}</p></article>)}
    {history.hasNextPage && <Button variant="outline" disabled={history.isFetchingNextPage} onClick={() => void history.fetchNextPage()}>Cargar más revisiones</Button>}
  </DialogContent></Dialog>;
}
