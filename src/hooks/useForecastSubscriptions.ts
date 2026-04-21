import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { useSede } from '@/contexts/SedeContext';

export interface ForecastSubscriber {
  id: string;
  user_id: string;
  email: string;
  sede_id: string | null;
  daily_digest: boolean;
  instant_red_alerts: boolean;
  min_days_advance: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export const useForecastSubscriptions = () => {
  const { activeSede } = useSede();
  return useQuery({
    queryKey: ['forecast-subscribers', activeSede?.id ?? null],
    queryFn: async () => {
      let q = supabase.from('forecast_subscribers').select('*').order('created_at');
      if (activeSede?.id) q = q.eq('sede_id', activeSede.id);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as ForecastSubscriber[];
    },
  });
};

export const useMyForecastSubscription = () => {
  const { user } = useAuth();
  const { activeSede } = useSede();
  return useQuery({
    queryKey: ['forecast-subscriber', user?.id, activeSede?.id ?? null],
    enabled: !!user?.id,
    queryFn: async () => {
      let q = supabase.from('forecast_subscribers').select('*').eq('user_id', user!.id);
      if (activeSede?.id) q = q.eq('sede_id', activeSede.id);
      const { data, error } = await q.maybeSingle();
      if (error) throw error;
      return data as ForecastSubscriber | null;
    },
  });
};

export const useUpsertForecastSubscription = () => {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { activeSede } = useSede();

  return useMutation({
    mutationFn: async (input: {
      email: string;
      daily_digest?: boolean;
      instant_red_alerts?: boolean;
      min_days_advance?: number;
      is_active?: boolean;
    }) => {
      if (!user) throw new Error('No autenticado');
      const payload = {
        user_id: user.id,
        email: input.email,
        sede_id: activeSede?.id ?? null,
        daily_digest: input.daily_digest ?? true,
        instant_red_alerts: input.instant_red_alerts ?? true,
        min_days_advance: input.min_days_advance ?? 7,
        is_active: input.is_active ?? true,
      };
      const { data, error } = await supabase
        .from('forecast_subscribers')
        .upsert(payload, { onConflict: 'user_id,sede_id' })
        .select()
        .single();
      if (error) throw error;
      return data as ForecastSubscriber;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['forecast-subscribers'] });
      queryClient.invalidateQueries({ queryKey: ['forecast-subscriber'] });
      toast({ title: 'Suscripción guardada', description: 'Recibirás alertas según tus preferencias.' });
    },
    onError: (e: Error) => {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    },
  });
};

export const useForecastAlertsLog = (limit: number = 30) => {
  const { activeSede } = useSede();
  return useQuery({
    queryKey: ['forecast-alerts-log', activeSede?.id ?? null, limit],
    queryFn: async () => {
      let q = supabase
        .from('forecast_alerts_log')
        .select('*')
        .order('sent_at', { ascending: false })
        .limit(limit);
      if (activeSede?.id) q = q.eq('sede_id', activeSede.id);
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
  });
};
