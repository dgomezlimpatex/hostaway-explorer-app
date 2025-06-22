
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import type { Database } from '@/integrations/supabase/types';

type AppRole = Database['public']['Enums']['app_role'];
type InvitationStatus = Database['public']['Enums']['invitation_status'];

export interface UserInvitation {
  id: string;
  email: string;
  role: AppRole;
  invited_by: string;
  invitation_token: string;
  status: InvitationStatus;
  expires_at: string;
  created_at: string;
  accepted_at?: string;
}

export interface CreateInvitationData {
  email: string;
  role: AppRole;
}

export const useInvitations = () => {
  return useQuery({
    queryKey: ['invitations'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('user_invitations')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as UserInvitation[];
    },
  });
};

export const useCreateInvitation = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (invitationData: CreateInvitationData) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Usuario no autenticado');

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
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invitations'] });
      toast({
        title: 'Invitación enviada',
        description: 'La invitación ha sido creada exitosamente.',
      });
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

export const useRevokeInvitation = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (invitationId: string) => {
      const { error } = await supabase
        .from('user_invitations')
        .update({ status: 'revoked' })
        .eq('id', invitationId);

      if (error) throw error;
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

export const useVerifyInvitation = (token: string, email: string) => {
  return useQuery({
    queryKey: ['verify-invitation', token, email],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('verify_invitation', {
        token,
        email,
      });

      if (error) throw error;
      return data as boolean;
    },
    enabled: !!(token && email),
  });
};

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
