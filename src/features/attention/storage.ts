import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { taskStorageService } from '@/services/storage/taskStorage';
import type { TaskReport } from '@/types/taskReports';
import type { AttentionAlert, AttentionReview, AlertKind } from './domain';

// Local contract for the proposed additive table. Do not edit generated types.
type ReviewInsert = Pick<AttentionReview, 'sede_id' | 'task_id' | 'task_date' | 'alert_key' | 'kind' | 'snapshot'>;
type AttentionDatabase = { public: {
  Tables: { operational_alert_reviews: { Row: {[K in keyof AttentionReview]: AttentionReview[K]}; Insert: ReviewInsert; Update: Record<string, never>; Relationships: [] } };
  Views: Record<string, never>; Functions: Record<string, never>;
} };
const reviewClient = supabase as unknown as SupabaseClient<AttentionDatabase>;
function fail(error: { code?: string; message: string } | null) {
  if (!error) return;
  if (['42P01', 'PGRST205'].includes(error.code || '')) throw new Error('El historial de revisiones aún no está activado. Falta aplicar el SQL de este bloque.');
  throw new Error('No se pudieron cargar o guardar los avisos. Vuelve a intentarlo.');
}
export async function readAttentionDay(sedeId: string, date: string) {
  if (!sedeId) throw new Error('Selecciona una sede para consultar los avisos.');
  const [tasks, reportResult, reviewResult] = await Promise.all([
    taskStorageService.getTasks({sedeId, dateFrom: date, dateTo: date}),
    readReports(sedeId, date),
    readDayReviewKeys(sedeId, date),
  ]);
  return {tasks, reports: reportResult, reviews: reviewResult};
}
async function readDayReviewKeys(sedeId: string, date: string): Promise<Pick<AttentionReview, 'alert_key'>[]> {
  const keys: Pick<AttentionReview, 'alert_key'>[] = [];
  for (let offset = 0; ; offset += 1000) {
    const {data, error} = await reviewClient.from('operational_alert_reviews').select('alert_key')
      .eq('sede_id', sedeId).eq('task_date', date).order('id').range(offset, offset + 999)
      .returns<Pick<AttentionReview, 'alert_key'>[]>();
    fail(error);
    keys.push(...data || []);
    if ((data?.length || 0) < 1000) return keys;
  }
}
async function readReports(sedeId: string, date: string): Promise<TaskReport[]> {
  const reports: TaskReport[] = [];
  for (let offset = 0; ; offset += 1000) {
    const {data, error} = await supabase.from('task_reports')
      .select('id,task_id,cleaner_id,overall_status,start_time,end_time,created_at,updated_at,checklist_completed,tasks!inner(sede_id,date)')
      .eq('tasks.sede_id', sedeId).eq('tasks.date', date).order('id').range(offset, offset + 999);
    fail(error);
    const rows = (data || []) as unknown as TaskReport[];
    reports.push(...rows);
    if (rows.length < 1000) return reports;
  }
}
export async function reviewAlert(alert: AttentionAlert): Promise<void> {
  const {error} = await reviewClient.from('operational_alert_reviews').insert({
    sede_id: alert.sedeId, task_id: alert.taskId, task_date: alert.taskDate,
    alert_key: alert.key, kind: alert.kind, snapshot: alert,
  });
  // Two coordinators reviewing the same occurrence are an idempotent success.
  if (error?.code !== '23505') fail(error);
}
export async function readReviewHistory(sedeId: string, from: string, to: string, kind: AlertKind | 'all', offset = 0): Promise<AttentionReview[]> {
  let query = reviewClient.from('operational_alert_reviews').select('*').eq('sede_id', sedeId)
    .gte('task_date', from).lte('task_date', to).order('reviewed_at', {ascending: false}).order('id').range(offset, offset + 99);
  if (kind !== 'all') query = query.eq('kind', kind);
  const {data, error} = await query.returns<AttentionReview[]>();
  fail(error);
  return data || [];
}
