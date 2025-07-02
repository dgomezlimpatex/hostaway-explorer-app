
import { useMutation } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export const useVerifyInvitation = () => {
  return useMutation({
    mutationFn: async ({ token, email }: { token: string; email: string }) => {
      const { data, error } = await supabase.rpc('verify_invitation', {
        token,
        email,
      });

      if (error) throw error;
      return data as boolean;
    },
  });
};
