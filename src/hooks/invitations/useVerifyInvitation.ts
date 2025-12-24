
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
      
      // Primero verificar si la invitación existe y su estado
      const { data: invitation, error: invError } = await supabase
        .from('user_invitations')
        .select('status, accepted_at')
        .eq('invitation_token', token.trim())
        .ilike('email', email.trim())
        .maybeSingle();
      
      if (invError) {
        console.error('❌ Error fetching invitation:', invError);
        throw new Error(`Error al verificar invitación: ${invError.message}`);
      }
      
      // Si no existe la invitación
      if (!invitation) {
        console.warn('⚠️ Invitation not found');
        return { isValid: false, alreadyAccepted: false, message: 'Invitación no encontrada' };
      }
      
      // Si ya fue aceptada
      if (invitation.status === 'accepted') {
        console.log('ℹ️ Invitation already accepted');
        return { 
          isValid: false, 
          alreadyAccepted: true, 
          message: 'Esta invitación ya fue aceptada. Por favor, inicia sesión con tu cuenta.' 
        };
      }
      
      // Ahora verificar con la función RPC (que verifica expiración, etc.)
      const { data, error } = await supabase.rpc('verify_invitation', {
        token: token.trim(),
        email: email.trim(),
      });

      console.log('✅ Verification result:', { data, error });

      if (error) {
        console.error('❌ Verification error:', error);
        throw new Error(`Error al verificar invitación: ${error.message}`);
      }
      
      if (data === null || data === undefined || !data) {
        console.warn('⚠️ Verification returned invalid');
        return { isValid: false, alreadyAccepted: false, message: 'La invitación ha expirado o no es válida' };
      }
      
      return { isValid: true, alreadyAccepted: false };
    },
  });
};
