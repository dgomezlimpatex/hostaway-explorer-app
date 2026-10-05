import { useState } from 'react';
import { AlertTriangle, Check, ChevronRight, Clock, FileText, History } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import type { Task } from '@/types/calendar';
import { alertKinds, alertLabels, type AlertKind, type AttentionAlert, type AttentionGroup, type AttentionIssue } from './domain';

interface Props {
  groups: AttentionGroup[];
  issues: AttentionIssue[];
  loading: boolean;
  error?: string;
  onRetry: () => void;
  onReview: (alert: AttentionAlert) => Promise<void>;
  onTask: (task: Task) => void;
  onReports: (task: Task) => void;
  onHistory: () => void;
}
const tone = (kind: AlertKind) => kind === 'unfinished'
  ? 'border-red-200 bg-red-50 text-red-950' : 'border-amber-200 bg-amber-50 text-amber-950';

export function AttentionPanel({groups, issues, loading, error, onRetry, onReview, onTask, onReports, onHistory}: Props) {
  const [filter, setFilter] = useState<AlertKind | 'all'>('all');
  const [allOpen, setAllOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  const [reviewError, setReviewError] = useState('');
  const selected = groups.find(group => group.task.id === selectedId);
  const filtered = groups.filter(group => filter === 'all' || group.alerts.some(alert => alert.kind === filter));
  if (filter !== 'all') filtered.sort((a, b) =>
    Math.max(...b.alerts.filter(alert => alert.kind === filter).map(alert => alert.magnitude)) -
    Math.max(...a.alerts.filter(alert => alert.kind === filter).map(alert => alert.magnitude)) || a.task.id.localeCompare(b.task.id));
  const select = (group: AttentionGroup) => {setSelectedId(group.task.id); setReviewError(''); setAllOpen(false);};
  const review = async (alert: AttentionAlert) => {
    setPendingKey(alert.key); setReviewError('');
    try {await onReview(alert);} catch (reason) {setReviewError(reason instanceof Error ? reason.message : 'No se pudo guardar la revisión. Vuelve a intentarlo.');}
    finally {setPendingKey(null);}
  };
  const row = (group: AttentionGroup) => {
    const matching = filter === 'all' ? group.alerts : group.alerts.filter(a => a.kind === filter);
    const primary = matching[0];
    return <button type="button" key={group.task.id} onClick={() => select(group)}
      className={`flex w-full items-start gap-3 rounded-lg border p-3 text-left transition hover:shadow-sm ${tone(primary.kind)}`}>
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold">{primary.title}</span>
        <span className="mt-1 block break-words text-xs">{group.task.property}{primary.client && ` · ${primary.client}`}</span>
        <span className="mt-1 block break-words text-xs">{[...new Set(matching.map(a => a.cleanerName))].join(', ')}</span>
        <span className="mt-1 block text-xs">{primary.detail}</span>
        {group.alerts.length > 1 && <span className="mt-1 block text-xs font-medium">{group.alerts.length} avisos en esta tarea</span>}
      </span>
      <ChevronRight className="h-4 w-4 shrink-0" aria-hidden="true" />
    </button>;
  };
  return <>
    <section className="rounded-lg border border-line bg-white p-4 shadow-sm" aria-label="Requiere tu atención">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-base font-semibold"><AlertTriangle className="h-4 w-4" />Requiere tu atención · Hoy
          {!loading && !error && <span className="rounded-full bg-ink px-2 py-0.5 text-xs text-white" aria-label={`${groups.length} tareas afectadas`}>{groups.length}</span>}
        </h2>
        <Button variant="ghost" size="sm" onClick={onHistory}><History className="mr-1 h-4 w-4" />Historial</Button>
      </div>
      {loading ? <p className="mt-4 text-sm text-muted-foreground" role="status">Comprobando tareas y reportes…</p>
        : error ? <div className="mt-3 space-y-2" role="alert"><p className="text-sm text-destructive">{error}</p><Button variant="outline" onClick={onRetry}>Reintentar</Button></div>
        : <>
          <div className="my-3 flex flex-wrap gap-2" aria-label="Filtrar avisos">
            <Button size="sm" variant={filter === 'all' ? 'default' : 'outline'} aria-pressed={filter === 'all'} onClick={() => setFilter('all')}>Todas ({groups.length})</Button>
            {alertKinds.map(kind => <Button key={kind} size="sm" variant={filter === kind ? 'default' : 'outline'} aria-pressed={filter === kind} onClick={() => setFilter(kind)}>
              {alertLabels[kind]} ({groups.filter(g => g.alerts.some(a => a.kind === kind)).length})
            </Button>)}
          </div>
          <div className="space-y-2">{filtered.slice(0, 5).map(row)}</div>
          {!filtered.length && <p className="py-4 text-sm text-muted-foreground">{groups.length ? 'No hay avisos de este tipo.' : issues.length ? 'No hay avisos detectados; quedan datos por comprobar.' : 'No hay tareas que requieran atención ahora'}</p>}
          {issues.length > 0 && <details className="mt-3 rounded border border-amber-200 p-2 text-xs"><summary className="cursor-pointer font-medium">Datos por comprobar ({issues.length})</summary>
            {issues.map((issue, i) => <p key={`${issue.taskId}-${i}`} className="mt-2">{issue.property}: {issue.message}</p>)}
          </details>}
          {groups.length > 0 && <Button variant="outline" className="mt-3 w-full" onClick={() => setAllOpen(true)}>Ver todas las alertas de hoy ({filtered.length})<ChevronRight className="ml-1 h-4 w-4" /></Button>}
        </>}
    </section>
    <Dialog open={allOpen} onOpenChange={setAllOpen}><DialogContent className="max-h-[85dvh] overflow-y-auto sm:max-w-2xl"><DialogHeader><DialogTitle>Alertas de hoy</DialogTitle><DialogDescription>{filter === 'all' ? 'Todas las tareas que requieren atención.' : alertLabels[filter]}</DialogDescription></DialogHeader>
      {error ? <p role="alert">{error}</p> : <div className="space-y-2">{filtered.map(row)}</div>}
    </DialogContent></Dialog>
    <Dialog open={selectedId !== null} onOpenChange={open => {if (!open) setSelectedId(null);}}><DialogContent className="max-h-[85dvh] overflow-y-auto sm:max-w-2xl"><DialogHeader><DialogTitle>{selected?.task.property || 'Revisión de avisos'}</DialogTitle><DialogDescription>Revisar un aviso no cambia el estado de la tarea ni del reporte.</DialogDescription></DialogHeader>
      {error ? <p role="alert" className="text-destructive">{error}</p> : !selected ? <p>No quedan avisos pendientes en esta tarea.</p> : <>
        <div className="flex flex-wrap gap-2"><Button variant="outline" onClick={() => {onTask(selected.task); setSelectedId(null);}}><Clock className="mr-1 h-4 w-4" />Ver tarea</Button>
          <Button variant="outline" onClick={() => {onReports(selected.task); setSelectedId(null);}}><FileText className="mr-1 h-4 w-4" />Ver reportes</Button></div>
        {selected.alerts.map(alert => <div key={alert.key} className={`space-y-2 rounded-lg border p-3 ${tone(alert.kind)}`}>
          <p className="text-sm font-semibold">{alert.title}</p><p className="text-xs">{alert.client}</p><p className="text-sm">{alert.cleanerName}</p><p className="text-xs">{alert.detail}</p>
          <Button size="sm" variant="outline" disabled={pendingKey !== null} onClick={() => void review(alert)}><Check className="mr-1 h-4 w-4" />{pendingKey === alert.key ? 'Guardando…' : 'Marcar como revisado'}</Button>
        </div>)}
        {issues.filter(issue => issue.taskId === selected.task.id).map((issue, i) => <p key={i} className="text-sm text-amber-900">Datos por comprobar: {issue.message}</p>)}
      </>}
      {reviewError && <p className="text-sm text-destructive" role="alert">{reviewError}</p>}
    </DialogContent></Dialog>
  </>;
}
