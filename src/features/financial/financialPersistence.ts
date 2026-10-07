import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { readSettings, type FinanceSettings } from './financialModel';

const db = supabase as unknown as SupabaseClient;
export interface SharedFinance { settings: FinanceSettings; revision: number }
export async function loadFinance(sedeId: string): Promise<SharedFinance | null> {
  const { data, error } = await db.from('financial_settings').select('document,revision').eq('sede_id', sedeId).maybeSingle();
  if (error) throw new Error('No se pudo cargar la configuración compartida. ' + error.message);
  return data ? { settings: readSettings(data.document), revision: data.revision } : null;
}
export async function saveFinance(sedeId: string, settings: FinanceSettings, revision: number | null): Promise<SharedFinance> {
  const document = readSettings(settings);
  const request = revision === null
    ? db.from('financial_settings').insert({ sede_id: sedeId, document, revision: 1 })
    : db.from('financial_settings').update({ document, revision: revision + 1 }).eq('sede_id', sedeId).eq('revision', revision);
  const { data, error } = await request.select('document,revision').maybeSingle();
  if (error || !data) throw new Error(error?.code === '23505' || !data && !error
    ? 'Otra persona ha cambiado este análisis. Exporta tu borrador y recarga antes de volver a guardar.'
    : 'No se pudieron guardar los cambios. Tu borrador se conserva. ' + error?.message);
  return { settings: readSettings(data.document), revision: data.revision };
}
