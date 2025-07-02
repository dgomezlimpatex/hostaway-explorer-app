
import { useMutation } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import type { AppRole } from './types';

export const useAcceptInvitation = () => {
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (token: string) => {
      console.log('Starting simplified invitation acceptance process');
      
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Usuario no autenticado');

      console.log('User authenticated:', user.id);

      // 1. Verificar y obtener datos de la invitación
      const { data: invitation, error: invitationError } = await supabase
        .from('user_invitations')
        .select('role, email, id')
        .eq('invitation_token', token)
        .eq('status', 'pending')
        .gt('expires_at', new Date().toISOString())
        .single();

      if (invitationError || !invitation) {
        console.error('Invitation error:', invitationError);
        throw new Error('Invitación inválida o expirada');
      }

      console.log('Invitation found:', invitation);

      // 2. Verificar que el email coincida
      if (user.email !== invitation.email) {
        throw new Error('El email no coincide con la invitación');
      }

      console.log('Email matches, proceeding with role assignment');

      // 3. Marcar invitación como aceptada
      const { error: updateError } = await supabase
        .from('user_invitations')
        .update({ 
          status: 'accepted', 
          accepted_at: new Date().toISOString() 
        })
        .eq('invitation_token', token);

      if (updateError) {
        console.error('Error updating invitation:', updateError);
        throw new Error('Error al actualizar la invitación');
      }

      console.log('Invitation marked as accepted');

      // 4. Asignar rol al usuario
      const { error: roleError } = await supabase
        .from('user_roles')
        .upsert({ 
          user_id: user.id, 
          role: invitation.role 
        }, { 
          onConflict: 'user_id,role' 
        });

      if (roleError) {
        console.error('Error assigning role:', roleError);
        throw new Error('Error al asignar el rol');
      }

      console.log('Role assigned successfully:', invitation.role);

      return invitation.role as AppRole;
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
