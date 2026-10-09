import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ChecklistSection } from '@/components/modals/task-report/ChecklistSection';
import { ReportSummary } from '@/components/modals/task-report/ReportSummary';
import { useAuth } from '@/hooks/useAuth';
import { formatMadridDate } from '@/utils/date';
import { getMimeType } from '@/utils/imageCompression';
import type { Task } from '@/types/calendar';
import type { TaskMedia, TaskReport } from '@/types/taskReports';
import { Loader2, MapPin, Play, CheckCircle2 } from 'lucide-react';
import { CleanerTaskHeaderActions } from './CleanerTaskHeaderActions';
import { CleanerPropertyDetails } from './CleanerPropertyDetails';
import { useCleanerOfflineStatus } from './CleanerOfflineProvider';
import { CleanerWorkContext } from './CleanerWorkContext';
import { cleanerBundleKey, loadCleanerBundle, useCleanerCachedQuery, useCleanerIdentity } from './useCleanerData';
import {
  changeDraft, draftKey, getCleanerStoreVersion, LOCAL_PHOTO_PREFIX, savePhotoWithDraft,
  subscribeCleanerStore, type CleanerDraft,
} from './offlineStore';
import type { CleanerChecklist } from './reportMerge';
import { IncidentReportTrigger } from '@/components/incidents/IncidentReportTrigger';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import { readCleanerDraft } from './readCleanerDraft';
import { CleanerReportErrorBoundary } from './CleanerReportErrorBoundary';
import { localPhotoErrorMessage } from './prepareLocalPhoto';

interface Props { task: Task | null; open: boolean; onOpenChange: (open: boolean) => void; recovery?: boolean }

export function CleanerTaskReportModal({ task, open, onOpenChange, recovery = false }: Props) {
  const { user } = useAuth();
  return task && open && user ? <CleanerReportErrorBoundary key={`${user.id}:${task.originalTaskId || task.id}`} onClose={() => onOpenChange(false)}>
    <CleanerTaskWork task={task} onClose={() => onOpenChange(false)} recovery={recovery} />
  </CleanerReportErrorBoundary> : null;
}

function CleanerTaskWork({ task, onClose, recovery }: { task: Task; onClose: () => void; recovery: boolean }) {
  const { user } = useAuth();
  const { isOnline } = useNetworkStatus();
  const offlineStatus = useCleanerOfflineStatus();
  const identity = useCleanerIdentity();
  const taskId = task.originalTaskId || task.id.split('_assignment_')[0];
  const key = draftKey(identity.ownerId, taskId);
  const bundleKey = cleanerBundleKey(identity.ownerId, identity.sedeId, taskId);
  const bundle = useCleanerCachedQuery(['cleaner-bundle', bundleKey], bundleKey,
    () => loadCleanerBundle(identity.ownerId, identity.sedeId, task, identity.data!.id), Boolean(identity.data?.id && !taskId.startsWith('recurring_')));
  const [draft, setDraft] = useState<CleanerDraft | null>(null);
  const [loadedLocal, setLoadedLocal] = useState(false);
  const [preparationError, setPreparationError] = useState<string | null>(null);
  const [preparationAttempt, setPreparationAttempt] = useState(0);
  const [saving, setSaving] = useState(0);
  const [preparingPhotos, setPreparingPhotos] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [photoErrors, setPhotoErrors] = useState<Record<string, string>>({});
  const photoError = Object.values(photoErrors)[0];
  const [checklist, setChecklist] = useState<CleanerChecklist>({});
  const [notes, setNotes] = useState('');
  const fieldsInitialized = useRef(false);
  const saveChain = useRef<Promise<unknown>>(Promise.resolve());
  const closingRef = useRef(false);
  const saveErrorRef = useRef<string | null>(null);
  const version = useSyncExternalStore(subscribeCleanerStore, getCleanerStoreVersion, () => 0);

  const applyDraft = useCallback((saved: CleanerDraft) => {
    setDraft(current => !current || saved.revision >= current.revision ? saved : current);
  }, []);
  useEffect(() => {
    if (!identity.ownerId) return;
    let cancelled = false;
    void readCleanerDraft(key).then(saved => {
      if (!cancelled) { if (saved) applyDraft(saved); setPreparationError(null); setLoadedLocal(true); }
    }).catch(reason => {
      if (!cancelled) setPreparationError(reason instanceof Error ? reason.message : 'No se ha podido leer el avance guardado en este móvil. Reintenta la preparación.');
    });
    return () => { cancelled = true; };
  }, [key, identity.ownerId, version, applyDraft, preparationAttempt]);

  useEffect(() => {
    if (!loadedLocal || draft || !bundle.data?.report || !identity.data) return;
    const report = bundle.data.report;
    void changeDraft(key, current => current || {
      key, ownerId: identity.ownerId, sedeId: identity.sedeId, task,
      report, base: report, serverId: report.id, revision: 0, syncedRevision: 0,
      checklistTemplate: bundle.data?.templates.find(item => item.id === report.checklist_template_id),
      finishRequested: report.overall_status === 'completed', subtasks: {},
    }).then(applyDraft).catch(reason => setError(reason.message));
  }, [loadedLocal, draft, bundle.data, key, identity.data, identity.ownerId, identity.sedeId, task, applyDraft]);

  const template = useMemo(() => {
    const templates = bundle.data?.templates || [];
    return templates.find(item => item.id === draft?.report.checklist_template_id)
      || draft?.checklistTemplate
      || templates.find(item => item.id === bundle.data?.assignedTemplateId)
      || templates.find(item => item.property_type && task.type?.toLowerCase().includes(item.property_type.toLowerCase()))
      || templates[0];
  }, [bundle.data, draft?.report.checklist_template_id, draft?.checklistTemplate, task.type]);
  useEffect(() => {
    if (!draft || fieldsInitialized.current) return;
    fieldsInitialized.current = true;
    setChecklist(draft.report.checklist_completed);
    setNotes(draft.report.notes || '');
  }, [draft]);
  const effectiveTask = useMemo(() => ({
    ...task, additionalTasks: (task.additionalTasks || []).map(item => draft?.subtasks[item.id] ||
      (Date.parse(task.updated_at || '') > Date.parse(draft?.report.updated_at || '') ? item : draft?.task.additionalTasks?.find(saved => saved.id === item.id)) || item),
  }), [task, draft?.subtasks, draft?.task.additionalTasks, draft?.report.updated_at]);
  const completed = draft?.finishRequested || draft?.report.overall_status === 'completed' || task.status === 'completed';
  const started = Boolean(draft && (draft.report.start_time || draft.report.overall_status !== 'pending'));
  const virtual = taskId.startsWith('recurring_');
  const missingTemplate = Boolean(draft?.report.checklist_template_id && !bundle.data?.templates.some(item => item.id === draft.report.checklist_template_id));
  const fromToday = task.date === formatMadridDate(new Date());
  const validation = useMemo(() => {
    const missing: string[] = [];
    let done = 0;
    let total = 0;
    template?.checklist_items.forEach(category => category.items.forEach(item => {
      const saved = checklist[`${category.id}.${item.id}`];
      const hasPhoto = !item.photo_required || Boolean(saved?.media_urls?.length);
      total++;
      if (saved?.completed && hasPhoto) done++;
      if ((item.required && !saved?.completed) || !hasPhoto) missing.push(item.task);
    }));
    effectiveTask.additionalTasks.forEach(item => {
      const saved = checklist[`additional.${item.id}`];
      total++;
      const hasPhoto = !item.photoRequired || Boolean(saved?.media_urls?.length || item.mediaUrls?.length);
      if (item.completed && hasPhoto) done++;
      else missing.push(item.text);
    });
    return { missing, percentage: total ? Math.round(done / total * 100) : 100 };
  }, [template, checklist, effectiveTask.additionalTasks]);

  const save = useCallback((change: (current: CleanerDraft | undefined) => CleanerDraft) => {
    setSaving(count => count + 1);
    setError(null);
    const operation = saveChain.current.then(() => changeDraft(key, change));
    saveChain.current = operation.catch(() => undefined);
    return operation.then(saved => { saveErrorRef.current = null; setError(null); applyDraft(saved); return saved; })
      .catch(reason => { saveErrorRef.current = reason.message || 'No se ha podido guardar el avance. Mantén esta pantalla abierta y vuelve a intentarlo.'; setError(saveErrorRef.current); throw reason; })
      .finally(() => setSaving(count => count - 1));
  }, [key, applyDraft]);

  const updateReport = useCallback((updates: Partial<TaskReport>) => save(current => {
    if (!current) throw new Error('Inicia la tarea antes de guardar el avance.');
    return {
      ...current, revision: current.revision + 1, error: undefined,
      report: { ...current.report, ...updates, updated_at: new Date().toISOString() },
    };
  }), [save]);

  const start = async () => {
    if (!loadedLocal || preparationError || !identity.data || task.date !== formatMadridDate(new Date()) || !bundle.data || completed || virtual || missingTemplate || recovery) return;
    const now = new Date().toISOString();
    await save(current => current ? { ...current, revision: current.revision + 1, error: undefined,
      report: { ...current.report, overall_status: 'in_progress', start_time: current.report.start_time || now, updated_at: now } } : {
      key, ownerId: identity.ownerId, sedeId: identity.sedeId, task,
      revision: 1, syncedRevision: 0, finishRequested: false, subtasks: {}, base: null, checklistTemplate: template,
      report: {
        id: crypto.randomUUID(), task_id: taskId, cleaner_id: identity.data.id,
        checklist_template_id: template?.id, checklist_completed: {}, notes: '',
        overall_status: 'in_progress', start_time: now, created_at: now, updated_at: now,
      },
    }).catch(() => undefined);
    void navigator.storage?.persist?.().catch(() => undefined);
  };

  const uploadPhoto = useCallback(async (file: File, checklistItemId?: string): Promise<TaskMedia> => {
    if (!file.size || file.size > 200 * 1024 * 1024 || !/^(image|video)\//.test(getMimeType(file))) {
      throw new Error('Elige una foto o un vídeo válido de menos de 200 MB.');
    }
    setPreparingPhotos(count => count + 1);
    try {
      await saveChain.current;
      const id = crypto.randomUUID();
      const capturedAt = new Date().toISOString();
      const saved = await savePhotoWithDraft(key, {
        key: `${identity.ownerId}:${id}`, id, ownerId: identity.ownerId, taskId,
        checklistItemId, file, name: file.name, mimeType: getMimeType(file), capturedAt,
      });
      applyDraft(saved);
      setPhotoErrors(current => {
        const next = { ...current };
        delete next[checklistItemId || 'general'];
        return next;
      });
      void navigator.storage?.persist?.().catch(() => undefined);
      return {
        id, task_report_id: saved.report.id, file_url: `${LOCAL_PHOTO_PREFIX}${id}`,
        checklist_item_id: checklistItemId, media_type: getMimeType(file).startsWith('video/') ? 'video' : 'photo',
        timestamp: capturedAt, created_at: capturedAt, file_size: file.size,
      };
    } catch (reason) {
      const message = localPhotoErrorMessage(reason);
      setPhotoErrors(current => ({ ...current, [checklistItemId || 'general']: message }));
      throw new Error(message);
    } finally { setPreparingPhotos(count => count - 1); }
  }, [key, identity.ownerId, taskId, applyDraft]);

  const close = async () => {
    if (preparingPhotos || closingRef.current) return;
    closingRef.current = true;
    await saveChain.current;
    closingRef.current = false;
    if (!saveErrorRef.current) onClose();
  };
  const finish = async () => {
    if (!draft || !started || completed || task.date !== formatMadridDate(new Date()) || validation.missing.length || saving || preparingPhotos || !bundle.data || missingTemplate || recovery) return;
    await save(current => {
      if (!current) throw new Error('Inicia la tarea antes de finalizarla.');
      if (current.finishRequested || current.report.overall_status === 'completed') return current;
      const now = new Date().toISOString();
      return {
        ...current, revision: current.revision + 1, finishRequested: true, error: undefined,
        report: { ...current.report, checklist_completed: checklist, notes, overall_status: 'completed', end_time: now, updated_at: now },
      };
    }).catch(() => undefined);
  };

  const busy = saving > 0 || preparingPhotos > 0;
  const loading = !preparationError && (!loadedLocal || identity.isLoading || (!virtual && bundle.isLoading && !bundle.data));
  return <CleanerWorkContext.Provider value={{ uploadPhoto, isPreparingPhoto: preparingPhotos > 0, changePhotoPreparation: delta => setPreparingPhotos(count => Math.max(0, count + delta)) }}>
    <Dialog open onOpenChange={open => { if (!open) void close(); }}>
      <DialogContent translate="no" lang="es" className="notranslate flex h-[100dvh] max-h-[100dvh] w-full max-w-full flex-col gap-0 rounded-none p-0 sm:h-[90dvh] sm:max-w-2xl sm:rounded-2xl" onEscapeKeyDown={event => { if (busy) event.preventDefault(); }} aria-describedby="cleaner-work-description">
        <DialogHeader className="shrink-0 border-b px-4 py-4 pr-12 text-left">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 space-y-1.5">
              <DialogTitle className="break-words">{task.propertyCode || task.property}</DialogTitle>
              <DialogDescription id="cleaner-work-description">{task.propertyName || task.property} · {task.startTime.slice(0, 5)}</DialogDescription>
            </div>
            <CleanerTaskHeaderActions property={bundle.data?.property} taskNotes={task.notes} propertyName={task.propertyName || task.property}
              loading={loading} status={offlineStatus} showNotes={started || Boolean(completed)} />
          </div>
          <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(task.address)}`} target="_blank" rel="noopener noreferrer" className="mt-1 flex min-h-8 items-center gap-1 text-xs text-muted-foreground"><MapPin className="h-3 w-3 shrink-0" />{task.address}</a>
        </DialogHeader>
        <div className="flex-1 overflow-y-auto overscroll-contain px-3 py-3">
          {(preparationError || (!bundle.data && bundle.error) || (!identity.data && identity.error)) && <div role="alert" className="mb-3 rounded-xl bg-amber-50 p-3 text-sm text-amber-900">
            <p>{preparationError || 'No se ha podido preparar la tarea. Comprueba la conexión y vuelve a intentarlo.'}</p>
            <button className="mt-1 min-h-11 font-semibold underline" onClick={() => {
              setPreparationError(null);
              setPreparationAttempt(attempt => attempt + 1);
              void identity.refetch();
              if (identity.data) void bundle.refetch();
            }}>Reintentar preparación</button>
          </div>}
          {recovery && <p className="mb-3 rounded-xl bg-amber-50 p-3 text-sm">Este trabajo está guardado en el móvil y su envío sigue pendiente. Puedes revisar las fotos y notas para consultarlo con coordinación.</p>}
          {photoError && <div role="alert" className="mb-3 rounded-xl bg-red-50 p-3 text-sm text-red-800">
            <p>{photoError}</p>
            <p className="mt-1">La foto no está guardada. Vuelve a adjuntarla en el apartado correspondiente; guardar el checklist no recupera esa foto.</p>
          </div>}
          {error && <div role="alert" className="mb-3 rounded-xl bg-red-50 p-3 text-sm text-red-800">{error}
            {draft && <button className="mt-1 min-h-11 font-semibold underline" onClick={() => void updateReport({ checklist_completed: checklist, notes }).catch(() => undefined)}>Reintentar guardar</button>}
          </div>}
          {bundle.error && !bundle.data && <p role="alert" className="mb-3 rounded-xl bg-amber-50 p-3 text-sm">No se ha descargado la ficha de esta tarea. Recupera cobertura y vuelve a abrirla para preparar el checklist.</p>}
          {missingTemplate && <p role="alert" className="mb-3 rounded-xl bg-amber-50 p-3 text-sm">El checklist de este reporte ya no está disponible. Tu avance sigue guardado; consulta con coordinación.</p>}
          {virtual && <p className="rounded-xl bg-muted p-4 text-sm">Esta es una previsión recurrente. Podrás iniciar la limpieza cuando coordinación o la programación diaria genere la tarea.</p>}
          {!started && !completed && <CleanerPropertyDetails property={bundle.data?.property} taskNotes={task.notes} />}
          {loading ? <div role="status" className="flex items-center justify-center gap-2 py-12"><Loader2 className="h-5 w-5 animate-spin" />Preparando la tarea…</div>
            : !started && !completed ? <div className="space-y-4 py-3">
              {!identity.data && <p role="alert" className="text-sm text-amber-900">No se ha encontrado tu ficha de trabajadora. Consulta con coordinación.</p>}
              {!fromToday && <p className="text-sm text-muted-foreground">Solo puedes iniciar las tareas del día de hoy.</p>}
            </div>
            : draft && (!completed || recovery) ? <>
              <ChecklistSection template={template} checklist={checklist}
                onChecklistChange={next => { setChecklist(next); void updateReport({ checklist_completed: next }).catch(() => undefined); }}
                reportId={draft.report.id} isReadOnly={completed || !fromToday || recovery}
                task={effectiveTask}
                onAdditionalTaskComplete={(id, isCompleted, notes, mediaUrls) => {
                  const item = effectiveTask.additionalTasks.find(extra => extra.id === id);
                  if (!item) return;
                  void save(current => ({ ...current!, revision: current!.revision + 1, error: undefined,
                    subtasks: { ...current!.subtasks, [id]: { ...item, completed: isCompleted, notes, mediaUrls,
                      completedAt: isCompleted ? new Date().toISOString() : undefined,
                      completedBy: isCompleted ? user?.id : undefined, completedByName: isCompleted ? user?.email : undefined } },
                  })).catch(() => undefined);
                }} />
              {isOnline && !recovery ? <IncidentReportTrigger task={effectiveTask} hasStartedTask isTaskCompleted={completed} className="mt-4" />
                : !completed && <p className="mt-4 text-xs text-muted-foreground">El parte de incidencia se puede enviar cuando recuperes cobertura.</p>}
            </> : draft ? <ReportSummary task={effectiveTask} template={template} checklist={checklist} notes={notes} completionPercentage={validation.percentage} currentReport={draft.report} timeOnly /> : <p className="py-4 text-sm">Esta tarea ya está finalizada.</p>}
        </div>
        <div className="shrink-0 space-y-2 border-t bg-background px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          {(!started || busy || error || photoError || completed) && <p role="status" className="text-center text-xs text-muted-foreground">{busy ? 'Guardando en el móvil…' : photoError ? 'Hay una foto que no se ha podido guardar' : error ? 'Hay cambios que no se han podido guardar' : completed ? 'Limpieza finalizada · revisa arriba el estado del envío' : 'La tarea se inicia al pulsar el botón'}</p>}
          {draft && !completed && validation.missing.length > 0 && <p className="text-xs text-amber-900">Faltan {validation.missing.length} puntos o fotos obligatorias.</p>}
          {completed || virtual || recovery ? <Button className="min-h-12 w-full" onClick={() => void close()} disabled={busy}>Volver a mis tareas</Button>
            : !started ? <Button className="min-h-12 w-full" onClick={() => void start()} disabled={loading || !loadedLocal || Boolean(preparationError) || busy || !bundle.data || !identity.data || !fromToday || missingTemplate}><Play className="mr-2 h-4 w-4" />Iniciar limpieza</Button>
            : <div className="flex gap-2">
              <Button className="min-h-12 flex-1" disabled={busy || !fromToday || !bundle.data || missingTemplate || Boolean(validation.missing.length)} onClick={() => void finish()}>
                <CheckCircle2 className="mr-2 h-4 w-4" />Revisar y finalizar
              </Button></div>}
        </div>
      </DialogContent>
    </Dialog>
  </CleanerWorkContext.Provider>;
}
