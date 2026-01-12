
import { useMutation } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface VerificationResult {
  isValid: boolean;
  alreadyAccepted: boolean;
  message?: string;
}

export const useVerifyInvitation = () => {
  return useMutation({
    mutationFn: async ({ token, email }: { token: string; email: string }): Promise<VerificationResult> => {
      console.log('🔍 Verifying invitation with token:', token, 'and email:', email);
      
      // Verificar que los parámetros estén presentes
      if (!token || !email) {
        throw new Error('Token y email son requeridos para verificar la invitación');
      }
      
      // Nota: esta pantalla es pública (usuario no autenticado).
      // Con RLS, una SELECT directa sobre user_invitations puede devolver vacío aunque la invitación exista.
      // Por eso validamos únicamente vía RPC SECURITY DEFINER.

      // Ahora verificar con la función RPC (que verifica existencia, estado pending y expiración)
      const { data, error } = await supabase.rpc('verify_invitation', {
        token: token.trim(),
        email: email.trim(),
      });

      console.log('✅ Verification result:', { data, error });

      if (error) {
        console.error('❌ Verification error:', error);
        throw new Error(`Error al verificar invitación: ${error.message}`);
      }

      if (!data) {
        console.warn('⚠️ Verification returned invalid');
        return {
          isValid: false,
          alreadyAccepted: false,
          message: 'La invitación no es válida, ya fue utilizada o ha expirado. Solicita una nueva invitación.',
        };
      }

      return { isValid: true, alreadyAccepted: false };

    },
  });
};
