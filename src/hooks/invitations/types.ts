
import type { Database } from '@/integrations/supabase/types';

export type AppRole = Database['public']['Enums']['app_role'];
export type InvitationStatus = Database['public']['Enums']['invitation_status'];

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
  sede_id?: string; // Opcional para otros roles, requerido para cleaner
}
