
import { useMutation } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import type { AppRole } from './types';

export const useAcceptInvitation = () => {
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (token: string) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Usuario no autenticado');

      const { data, error } = await supabase.rpc('accept_invitation', {
        token,
        user_id: user.id,
      });

      if (error) throw error;
      return data as AppRole;
    },
    onSuccess: () => {
      toast({
        title: 'Invitación aceptada',
        description: 'Tu cuenta ha sido activada exitosamente.',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Error al aceptar la invitación',
        variant: 'destructive',
      });
    },
  });
};
