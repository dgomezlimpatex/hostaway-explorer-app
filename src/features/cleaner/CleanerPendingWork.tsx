import { lazy, Suspense, useState } from 'react';
import { useSede } from '@/contexts/SedeContext';
import type { Task } from '@/types/calendar';
import { useCleanerOfflineStatus } from './CleanerOfflineProvider';
const CleanerTaskReportModal = lazy(() => import('./CleanerTaskReportModal').then(module => ({ default: module.CleanerTaskReportModal })));

export function CleanerPendingWork({ tasks }: { tasks: Task[] }) {
  const status = useCleanerOfflineStatus();
  const { activeSede } = useSede();
  const [selected, setSelected] = useState<Task | null>(null);
  const pending = (status?.drafts || []).filter(draft => draft.sedeId === activeSede?.id &&
    draft.revision > draft.syncedRevision && !tasks.some(task => (task.originalTaskId || task.id) === draft.report.task_id));
  if (!pending.length) return null;
  return <section className="rounded-xl border border-amber-200 bg-amber-50 p-3" aria-label="Trabajo guardado pendiente de revisión">
    <h2 className="text-sm font-semibold">Trabajo guardado pendiente de revisión</h2>
    {pending.map(draft => <button key={draft.key} className="mt-2 block min-h-11 w-full rounded-lg bg-white p-3 text-left text-sm" onClick={() => setSelected(draft.task)}>
      <span className="font-medium">{draft.task.propertyCode || draft.task.property} · {draft.task.date}</span>
      <span className="mt-1 block text-xs">{draft.error || 'Este trabajo aún no tiene el envío confirmado.'} Ver fotos y notas.</span>
    </button>)}
    {selected && <Suspense fallback={<p role="status">Abriendo el trabajo guardado…</p>}><CleanerTaskReportModal recovery task={selected} open onOpenChange={open => { if (!open) setSelected(null); }} /></Suspense>}
  </section>;
}
