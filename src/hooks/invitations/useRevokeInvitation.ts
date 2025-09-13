
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export const useRevokeInvitation = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (invitationId: string) => {
      console.log('🔍 Attempting to revoke invitation:', invitationId);
      
      // First, check current user and role
      const { data: { user } } = await supabase.auth.getUser();
      console.log('🔍 Current user:', user?.id);
      
      if (!user) {
        throw new Error('No hay usuario autenticado');
      }

      // Check user role
      const { data: userRole, error: roleError } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .single();
      
      console.log('🔍 User role:', userRole, 'Role error:', roleError);
      
      if (roleError || !userRole) {
        throw new Error('No se pudo verificar el rol del usuario');
      }

      if (!['admin', 'manager'].includes(userRole.role)) {
        throw new Error('No tienes permisos para revocar invitaciones');
      }

      const { data, error } = await supabase
        .from('user_invitations')
        .update({ status: 'revoked' })
        .eq('id', invitationId)
        .select();

      console.log('🔍 Revoke result:', { data, error });

      if (error) throw error;
      
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invitations'] });
      toast({
        title: 'Invitación revocada',
        description: 'La invitación ha sido revocada exitosamente.',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Error al revocar la invitación',
        variant: 'destructive',
      });
    },
  });
};
