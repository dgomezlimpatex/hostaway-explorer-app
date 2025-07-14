
import { useMutation } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import type { AppRole } from './types';

export const useAcceptInvitation = () => {
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (token: string) => {
      console.log('🎯 Starting invitation acceptance process for token:', token);
      
      if (!token || token.trim() === '') {
        throw new Error('Token de invitación es requerido');
      }
      
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('Usuario no autenticado. Por favor, inicia sesión primero.');
      }

      console.log('👤 User authenticated:', user.email, 'ID:', user.id);

      // Usar la función accept_invitation que tiene SECURITY DEFINER
      const { data: role, error } = await supabase.rpc('accept_invitation', {
        invitation_token: token.trim(), // Enviar como string limpio
        input_user_id: user.id
      });

      if (error) {
        console.error('❌ Error accepting invitation:', error);
        throw new Error(error.message || 'Error al aceptar la invitación');
      }

      if (!role) {
        throw new Error('No se pudo aceptar la invitación. Por favor, verifica que la invitación sea válida y no haya expirado.');
      }

      console.log('✅ Invitation accepted successfully, role:', role);
      return role as AppRole;
    },
    onSuccess: (role) => {
      console.log('Invitation accepted successfully, role:', role);
      toast({
        title: 'Invitación aceptada',
        description: 'Tu cuenta ha sido activada exitosamente.',
      });
    },
    onError: (error: any) => {
      console.error('Error in invitation acceptance:', error);
      toast({
        title: 'Error',
        description: error.message || 'Error al aceptar la invitación',
        variant: 'destructive',
      });
    },
  });
};
