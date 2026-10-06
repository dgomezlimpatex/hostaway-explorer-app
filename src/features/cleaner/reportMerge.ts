import type { TaskReport } from '@/types/taskReports';
import { LOCAL_PHOTO_PREFIX, type CleanerPhoto } from './offlineStore';

type Item = { completed?: boolean; notes?: string; media_urls?: string[] };
export type CleanerChecklist = Record<string, Item>;
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

export function resolveChecklistPhotos(checklist: CleanerChecklist, photos: CleanerPhoto[], requireUploaded = false): CleanerChecklist {
  const urls = new Map(photos.map(photo => [`${LOCAL_PHOTO_PREFIX}${photo.id}`, photo.serverUrl]));
  return Object.fromEntries(Object.entries(checklist).map(([key, item]) => [key, {
    ...item,
    media_urls: (item.media_urls || []).map(url => {
      if (!url.startsWith(LOCAL_PHOTO_PREFIX)) {
        if (url.startsWith('blob:')) throw new Error('Hay una foto antigua sin guardar. Vuelve a adjuntarla.');
        return url;
      }
      const remoteUrl = urls.get(url);
      if (!remoteUrl && requireUploaded) throw new Error('Quedan fotos por enviar. El reporte está guardado en el móvil.');
      return remoteUrl || url;
    }),
  }]));
}

// Only fields edited on this device overwrite the remote report. Never reopen a completed report.
export function mergeCleanerReport(base: TaskReport | null, local: TaskReport, remote: TaskReport): Partial<TaskReport> {
  if (base?.checklist_template_id && remote.checklist_template_id !== base.checklist_template_id) {
    throw new Error('El checklist de esta tarea ha cambiado. Tu avance sigue guardado; consulta con coordinación.');
  }
  const baseline = (base?.checklist_completed || {}) as CleanerChecklist;
  const own = local.checklist_completed as CleanerChecklist;
  const merged = { ...remote.checklist_completed } as CleanerChecklist;
  new Set([...Object.keys(baseline), ...Object.keys(own)]).forEach(key => {
    if (same(baseline[key], own[key])) return;
    const serverItem = merged[key];
    if (!same(baseline[key], serverItem) && !same(own[key], serverItem)) {
      if (own[key]?.completed !== serverItem?.completed || (own[key]?.notes || '') !== (serverItem?.notes || '')) {
        throw new Error('Este reporte también se ha cambiado desde otro dispositivo. Tu avance está guardado; consulta con coordinación antes de enviarlo.');
      }
    }
    if (own[key]) merged[key] = { ...own[key], media_urls: Array.from(new Set([...(serverItem?.media_urls || []), ...(own[key].media_urls || [])])) };
    else delete merged[key];
  });
  const notesChanged = (local.notes || '') !== (base?.notes || '');
  if (notesChanged && (remote.notes || '') !== (base?.notes || '') && (remote.notes || '') !== (local.notes || '')) {
    throw new Error('Las notas también se han cambiado desde otro dispositivo. Tu texto está guardado; consulta con coordinación.');
  }
  const completed = local.overall_status === 'completed' || remote.overall_status === 'completed';
  return {
    checklist_completed: merged,
    notes: notesChanged ? local.notes : remote.notes,
    checklist_template_id: remote.checklist_template_id || local.checklist_template_id,
    start_time: remote.start_time || local.start_time,
    overall_status: completed ? 'completed' : local.overall_status,
    end_time: completed ? (remote.end_time || local.end_time) : undefined,
  };
}
