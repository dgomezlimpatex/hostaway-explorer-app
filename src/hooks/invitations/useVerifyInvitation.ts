
import { useMutation } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export const useVerifyInvitation = () => {
  return useMutation({
    mutationFn: async ({ token, email }: { token: string; email: string }) => {
      console.log('Verifying invitation with token:', token, 'and email:', email);
      
      const { data, error } = await supabase.rpc('verify_invitation', {
        token: token, // El token viene como string desde la URL
        email,
      });

      console.log('Verification result:', { data, error });

      if (error) {
        console.error('Verification error:', error);
        throw error;
      }
      return data as boolean;
    },
  });
};
