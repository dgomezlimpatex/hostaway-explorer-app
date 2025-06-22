
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export const useVerifyInvitation = (token: string, email: string) => {
  return useQuery({
    queryKey: ['verify-invitation', token, email],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('verify_invitation', {
        token,
        email,
      });

      if (error) throw error;
      return data as boolean;
    },
    enabled: !!(token && email),
  });
};
