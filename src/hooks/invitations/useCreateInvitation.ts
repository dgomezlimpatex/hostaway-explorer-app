
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import type { CreateInvitationData } from './types';

export const useCreateInvitation = () => {
  const { toast } = useToast();
  const { profile } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (invitationData: CreateInvitationData) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Usuario no autenticado');

      // Revocar cualquier invitación anterior para este email (pendiente, expirada)
      await supabase
        .from('user_invitations')
        .update({ status: 'revoked' })
        .eq('email', invitationData.email)
        .in('status', ['pending', 'expired']);

      // Crear la nueva invitación
      const { data, error } = await supabase
        .from('user_invitations')
        .insert({
          email: invitationData.email,
          role: invitationData.role,
          invited_by: user.id,
        })
        .select()
        .single();

      if (error) throw error;

      // Enviar email de invitación
      const appUrl = window.location.origin;
      const inviterName = profile?.full_name || profile?.email || 'Un administrador';

      const { error: emailError } = await supabase.functions.invoke('send-invitation-email', {
        body: {
          email: invitationData.email,
          inviterName,
          role: invitationData.role,
          token: data.invitation_token,
          appUrl,
        },
      });

      if (emailError) {
        console.error('Error sending invitation email:', emailError);
        // No lanzamos error aquí para que la invitación se cree aunque falle el email
        toast({
          title: 'Invitación creada',
          description: 'La invitación se ha creado pero hubo un problema enviando el email. Puedes compartir el enlace manualmente.',
          variant: 'destructive',
        });
      }

      return data;
    },
    onSuccess: (data, variables, context) => {
      queryClient.invalidateQueries({ queryKey: ['invitations'] });
      
      // Solo mostrar éxito si no hubo problemas con el email (el error del email se maneja arriba)
      if (!context) {
        toast({
          title: 'Invitación enviada',
          description: `Se ha enviado una invitación por email a ${variables.email}.`,
        });
      }
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Error al crear la invitación',
        variant: 'destructive',
      });
    },
  });
};
