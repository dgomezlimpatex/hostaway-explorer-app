import { publicSupabase } from '@/integrations/supabase/client';

export async function fetchPublicLaundryLink(token: string) {
  const { data, error } = await publicSupabase
    .from('laundry_share_links')
    .select('*')
    .eq('token', token)
    .eq('is_active', true)
    .maybeSingle();

  if (error) throw error;
  if (!data) throw new Error('Este enlace no está disponible. Solicita un enlace vigente a tu responsable.');
  if (data.expires_at && new Date(data.expires_at) <= new Date()) {
    throw new Error('Este enlace ha expirado');
  }
  return data;
}
