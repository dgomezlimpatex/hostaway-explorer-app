
import { useMutation } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export const useVerifyInvitation = () => {
  return useMutation({
    mutationFn: async ({ token, email }: { token: string; email: string }) => {
      console.log('🔍 Verifying invitation with token:', token, 'and email:', email);
      
      // Verificar que los parámetros estén presentes
      if (!token || !email) {
        throw new Error('Token y email son requeridos para verificar la invitación');
      }
      
      const { data, error } = await supabase.rpc('verify_invitation', {
        token: token.trim(), // Limpiar espacios y enviar como string
        email: email.trim(),
      });

      console.log('✅ Verification result:', { data, error });

      if (error) {
        console.error('❌ Verification error:', error);
        throw new Error(`Error al verificar invitación: ${error.message}`);
      }
      
      if (data === null || data === undefined) {
        console.warn('⚠️ Verification returned null/undefined, treating as invalid');
        return false;
      }
      
      return Boolean(data);
    },
  });
};
