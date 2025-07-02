
import { useMutation } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import type { AppRole } from './types';

export const useAcceptInvitation = () => {
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (token: string) => {
      console.log('Starting invitation acceptance process for token:', token);
      
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Usuario no autenticado');

      console.log('User authenticated:', user.id);

      // 1. First, let's get the invitation without filters to see what we have
      const { data: allInvitations, error: fetchError } = await supabase
        .from('user_invitations')
        .select('*')
        .eq('invitation_token', token);

      if (fetchError) {
        console.error('Error fetching invitation:', fetchError);
        throw new Error('Error al buscar la invitación');
      }

      console.log('All invitations found for token:', allInvitations);

      if (!allInvitations || allInvitations.length === 0) {
        throw new Error('Token de invitación no encontrado');
      }

      const invitation = allInvitations[0];
      console.log('Invitation data:', invitation);

      // 2. Check if invitation is still valid
      if (invitation.status !== 'pending') {
        throw new Error(`La invitación ya fue ${invitation.status === 'accepted' ? 'aceptada' : 'procesada'}`);
      }

      if (new Date(invitation.expires_at) < new Date()) {
        throw new Error('La invitación ha expirado');
      }

      // 3. Verify email matches
      if (user.email !== invitation.email) {
        throw new Error('El email no coincide con la invitación');
      }

      console.log('Email matches, proceeding with role assignment');

      // 4. Mark invitation as accepted
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

      // 5. Assign role to user
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
