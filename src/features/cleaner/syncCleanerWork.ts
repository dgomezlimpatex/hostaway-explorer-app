import { supabase } from '@/integrations/supabase/client';
import type { TaskReport } from '@/types/taskReports';
import type { AdditionalTask } from '@/types/calendar';
import type { Json } from '@/integrations/supabase/types';
import {
  acquireSyncLease, changeDraft, listLocal, readLocal, releaseSyncLease, writeLocal,
  type CleanerDraft, type CleanerPhoto,
} from './offlineStore';
import { mergeCleanerReport, resolveChecklistPhotos } from './reportMerge';
import { canCleanerAccessTaskByAssignments, parseTaskAssignmentCounts } from '@/utils/taskAssignments';

type AssignmentCountClient = {
  rpc(name: 'get_task_assignment_counts', args: { _task_ids: string[] }): PromiseLike<{ data: unknown; error: { message: string } | null }>;
};

let syncing: Promise<void> | undefined;
export let cleanerSyncing = false;
const syncListeners = new Set<() => void>();
const controllers = new Set<AbortController>();
let scopeCancelled = false;
export const subscribeCleanerSync = (listener: () => void) => {
  syncListeners.add(listener);
  return () => { syncListeners.delete(listener); };
};
const announceSync = () => syncListeners.forEach(listener => listener());

async function request<T>(run: (signal: AbortSignal) => PromiseLike<T>, ms = 15_000): Promise<T> {
  if (scopeCancelled) throw new Error('La sesión ha cambiado. El trabajo seguirá guardado para su cuenta.');
  const controller = new AbortController();
  controllers.add(controller);
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    const result = await Promise.race([
      Promise.resolve(run(controller.signal)),
      new Promise<never>((_, reject) => controller.signal.addEventListener('abort', () => reject(new Error('La conexión no responde. Conservamos el trabajo en el móvil.')), { once: true })),
    ]);
    if (scopeCancelled) throw new Error('La sesión ha cambiado. El trabajo sigue guardado para su cuenta.');
    return result;
  } finally { clearTimeout(timer); controllers.delete(controller); }
}

const reportFromRow = (row: unknown) => row as TaskReport;
const errorMessage = (error: unknown): string => {
  const message = error instanceof Error ? error.message : String((error as { message?: string })?.message || '');
  if (/fetch|network|abort|timeout/i.test(message)) return 'La conexión no responde. Conservamos el trabajo en el móvil y volveremos a enviarlo.';
  if (/row-level|permission|jwt|unauthorized/i.test(message)) return 'El servidor no permite enviar este trabajo con tu sesión actual. Está guardado; vuelve a entrar o consulta con coordinación.';
  return message || 'No se ha confirmado el envío. El trabajo sigue guardado en el móvil.';
};

async function findRemoteReport(draft: CleanerDraft): Promise<TaskReport | null> {
  const { data, error } = await request(signal => supabase.from('task_reports').select('*')
    .eq('task_id', draft.report.task_id).eq('cleaner_id', draft.report.cleaner_id)
    .abortSignal(signal).maybeSingle());
  if (error) throw error;
  return data ? reportFromRow(data) : null;
}

async function ensureRemoteReport(draft: CleanerDraft): Promise<TaskReport> {
  const existing = await findRemoteReport(draft);
  if (existing) return existing;
  const { data, error } = await request(signal => supabase.from('task_reports').insert({
    id: draft.report.id,
    task_id: draft.report.task_id,
    cleaner_id: draft.report.cleaner_id,
    checklist_template_id: draft.report.checklist_template_id,
    checklist_completed: {},
    notes: '',
    overall_status: 'in_progress',
    start_time: draft.report.start_time,
  }).select().abortSignal(signal).single());
  if (error) {
    // Unique(task_id, cleaner_id) and stable UUIDs make an uncertain retry safe.
    const recovered = await findRemoteReport(draft);
    if (recovered) return recovered;
    throw error;
  }
  return reportFromRow(data);
}

async function sendPhoto(photo: CleanerPhoto, reportId: string): Promise<CleanerPhoto> {
  if (photo.serverUrl) return photo;
  const { data: recorded, error: readError } = await request(signal => supabase.from('task_media')
    .select('file_url,task_report_id').eq('id', photo.id).abortSignal(signal).maybeSingle());
  if (readError) throw readError;
  if (recorded) {
    if (recorded.task_report_id !== reportId) throw new Error('La foto pertenece a otro reporte. Consulta con coordinación.');
    return writeLocal('photos', { ...photo, serverUrl: recorded.file_url });
  }
  const extension = photo.mimeType === 'image/jpeg' ? 'jpg' : photo.name.split('.').pop()?.replace(/[^a-z0-9]/gi, '') || 'bin';
  const path = `${reportId}/${photo.id}.${extension}`;
  // This SDK version cannot abort upload(). Bound the wait and preserve the immutable file for a safe retry.
  const { error: uploadError } = await request(() => supabase.storage.from('task-reports-media')
    .upload(path, photo.file, { contentType: photo.mimeType, upsert: false }), 60_000);
  // An existing object at our immutable UUID path is an earlier upload whose response was lost.
  if (uploadError && !/already exists|duplicate|409/i.test(`${uploadError.statusCode} ${uploadError.message}`)) throw uploadError;
  const { data: { publicUrl } } = supabase.storage.from('task-reports-media').getPublicUrl(path);
  const { data, error } = await request(signal => supabase.from('task_media').insert({
    id: photo.id, task_report_id: reportId, file_url: publicUrl,
    media_type: photo.mimeType.startsWith('video/') ? 'video' : 'photo',
    checklist_item_id: photo.checklistItemId,
    file_size: photo.file.size, timestamp: photo.capturedAt,
  }).select('file_url').abortSignal(signal).single());
  if (error) {
    const { data: recovered, error: recoverError } = await request(signal => supabase.from('task_media')
      .select('file_url,task_report_id').eq('id', photo.id).abortSignal(signal).maybeSingle());
    if (recoverError || !recovered || recovered.task_report_id !== reportId) throw error;
    return writeLocal('photos', { ...photo, serverUrl: recovered.file_url });
  }
  return writeLocal('photos', { ...photo, serverUrl: data.file_url });
}

async function syncDraft(draft: CleanerDraft, ownerId: string, token: string): Promise<void> {
  const { data: taskRow, error: taskError } = await request(signal => supabase.from('tasks')
    .select('id,sede_id,cleaner_id,status,updated_at,additional_tasks,task_assignments(cleaner_id)')
    .eq('id', draft.report.task_id).eq('sede_id', draft.sedeId).abortSignal(signal).maybeSingle());
  if (taskError) throw taskError;
  if (!taskRow) throw new Error('Esta tarea ya no está disponible. Tu trabajo está guardado; consulta con coordinación.');
  const cleanerId = draft.report.cleaner_id;
  const { data: counts, error: countsError } = await request(() => (supabase as unknown as AssignmentCountClient)
    .rpc('get_task_assignment_counts', { _task_ids: [taskRow.id] }));
  if (countsError) throw countsError;
  if (!cleanerId || !canCleanerAccessTaskByAssignments({
    visibleCanonicalCleanerIds: (taskRow.task_assignments || []).map(assignment => assignment.cleaner_id),
    canonicalAssignmentCount: parseTaskAssignmentCounts(counts, [taskRow.id]).get(taskRow.id) ?? 0,
    legacyCleanerId: taskRow.cleaner_id,
  }, cleanerId)) {
    throw new Error('Esta tarea se ha reasignado. Tu trabajo está guardado; consulta con coordinación antes de enviarlo.');
  }
  let remote = await ensureRemoteReport(draft);
  await changeDraft(draft.key, current => ({ ...current!, serverId: remote.id }));
  const photos = (await listLocal<CleanerPhoto>('photos', ownerId)).filter(photo => photo.taskId === draft.report.task_id);
  for (let i = 0; i < photos.length; i++) {
    if (!navigator.onLine || !await acquireSyncLease(ownerId, token)) throw new Error('El envío continuará al recuperar la conexión.');
    photos[i] = await sendPhoto(photos[i], remote.id);
  }
  // Take the latest revision AFTER uploads, then confirm that exact revision only.
  const snapshot = (await readLocal<CleanerDraft>('drafts', draft.key))!;
  const local = { ...snapshot.report, checklist_completed: resolveChecklistPhotos(snapshot.report.checklist_completed, photos, true) };
  const updates = mergeCleanerReport(snapshot.base, local, remote);
  if (!await acquireSyncLease(ownerId, token)) throw new Error('El envío continuará desde la otra pestaña abierta.');
  const { data: updated, error: updateError } = await request(signal => supabase.from('task_reports')
    .update(updates as { checklist_completed?: Json }).eq('id', remote.id)
    .eq('updated_at', remote.updated_at).select().abortSignal(signal).maybeSingle());
  if (updateError) throw updateError;
  if (!updated) throw new Error('El reporte acaba de cambiar. Conservamos tu avance y volveremos a comprobarlo.');
  remote = reportFromRow(updated);

  // Preserve newly added extra tasks. Only update the IDs actually edited on this device.
  const extras = (taskRow.additional_tasks || []) as unknown as AdditionalTask[];
  const editedExtras = Object.keys(snapshot.subtasks).length > 0;
  if (Object.keys(snapshot.subtasks).some(id => !extras.some(item => item.id === id))) {
    throw new Error('Una tarea adicional ha cambiado o se ha eliminado. El avance está guardado; consulta con coordinación.');
  }
  const mergedExtras = extras.map(item => {
    const own = snapshot.subtasks[item.id];
    if (!own) return item;
    const saved = local.checklist_completed[`additional.${item.id}`];
    const itemChecklist = resolveChecklistPhotos({ item: { media_urls: saved?.media_urls || own.mediaUrls || [] } }, photos, true);
    return { ...item, ...own, text: item.text, photoRequired: item.photoRequired, notes: saved?.notes ?? own.notes, mediaUrls: itemChecklist.item.media_urls };
  });
  const taskUpdates: { status?: string; additional_tasks?: Json } = {};
  if (editedExtras) taskUpdates.additional_tasks = mergedExtras as unknown as Json;
  // Secondary assignees may finish their own report; the existing task mapper derives completed from it.
  // RLS allows the primary cleaner to update the task row. Never pretend a refused row update succeeded.
  if (taskRow.cleaner_id === cleanerId && taskRow.status !== 'completed') {
    taskUpdates.status = snapshot.finishRequested || remote.overall_status === 'completed' ? 'completed' : 'in-progress';
  }
  if (Object.keys(taskUpdates).length) {
    const { data: savedTask, error: saveTaskError } = await request(signal => supabase.from('tasks')
      .update(taskUpdates).eq('id', taskRow.id).eq('updated_at', taskRow.updated_at)
      .select('id').abortSignal(signal).maybeSingle());
    if (saveTaskError) throw saveTaskError;
    if (!savedTask) throw new Error('La tarea ha cambiado o no tienes permiso para actualizarla. El avance sigue guardado; consulta con coordinación.');
  }
  await changeDraft(draft.key, current => {
    if (!current) throw new Error('No se encuentra el avance guardado.');
    const unchanged = current.revision === snapshot.revision;
    return {
      ...current, serverId: remote.id, base: remote, error: undefined,
      syncedRevision: snapshot.revision,
      task: { ...current.task, additionalTasks: mergedExtras },
      report: unchanged ? remote : { ...remote, ...mergeCleanerReport(local, {
        ...current.report, checklist_completed: resolveChecklistPhotos(current.report.checklist_completed, photos),
      }, remote) },
      subtasks: unchanged ? {} : current.subtasks,
    };
  });
}

export function syncCleanerWork(ownerId: string): Promise<void> {
  if (syncing) return syncing;
  syncing = (async () => {
    if (!navigator.onLine) return;
    const token = crypto.randomUUID();
    if (!await acquireSyncLease(ownerId, token)) return;
    cleanerSyncing = true;
    announceSync();
    try {
      // SDK refreshes/validates the session before writing. Cached UI roles never grant server access.
      const { data: { session }, error } = await supabase.auth.getSession();
      if (error || !session || session.user.id !== ownerId) return;
      scopeCancelled = false;
      const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, nextSession) => {
        if (nextSession?.user.id !== ownerId) { scopeCancelled = true; controllers.forEach(controller => controller.abort()); }
      });
      try {
      const drafts = await listLocal<CleanerDraft>('drafts', ownerId);
      for (const draft of drafts.filter(item => item.revision > item.syncedRevision)) {
        if (!navigator.onLine) break;
        const { data: { session: currentSession } } = await supabase.auth.getSession();
        if (currentSession?.user.id !== ownerId) break;
        try { await syncDraft(draft, ownerId, token); }
        catch (error) {
          await changeDraft(draft.key, current => ({ ...current!, error: errorMessage(error) }));
        }
      }
      } finally { subscription.unsubscribe(); }
    } finally {
      await releaseSyncLease(ownerId, token);
      cleanerSyncing = false;
      announceSync();
    }
  })().finally(() => { syncing = undefined; });
  return syncing;
}
