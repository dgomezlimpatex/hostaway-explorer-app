
import { useState, useEffect, createContext, useContext } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';

type AppRole = Database['public']['Enums']['app_role'];

interface Profile {
  id: string;
  email: string | null;
  full_name: string | null;
  avatar_url: string | null;
  phone: string | null;
  created_at: string;
  updated_at: string;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  userRole: AppRole | null;
  isLoading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: any }>;
  signUp: (email: string, password: string, fullName?: string) => Promise<{ error: any }>;
  signOut: () => Promise<void>;
  updateProfile: (updates: Partial<Profile>) => Promise<{ error: any }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const useAuthProvider = (): AuthContextType => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [userRole, setUserRole] = useState<AppRole | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const processUser = async (userId: string) => {
    try {
      console.log('🔍 Processing user authentication:', userId);
      
      // Obtener perfil del usuario
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (profileError) {
        console.error('❌ Error fetching profile:', profileError);
        throw profileError;
      }

      console.log('👤 Profile data found:', !!profileData, profileData?.email);

      // Verificar si hay invitaciones pendientes para este email
      if (profileData?.email) {
        console.log('🔍 Checking for pending invitations for:', profileData.email);
        
        const { data: pendingInvitations, error: invitationError } = await supabase
          .from('user_invitations')
          .select('*')
          .eq('email', profileData.email)
          .eq('status', 'pending')
          .gt('expires_at', new Date().toISOString());

        if (invitationError) {
          console.error('❌ Error checking invitations:', invitationError);
        } else if (pendingInvitations && pendingInvitations.length > 0) {
          console.log('📧 Found pending invitations:', pendingInvitations.length);
          
          // Procesar la invitación más reciente
          const latestInvitation = pendingInvitations[0];
          console.log('🎯 Processing invitation:', latestInvitation.invitation_token);
          
          try {
            const { data: assignedRole, error: acceptError } = await supabase
              .rpc('accept_invitation', {
                invitation_token: latestInvitation.invitation_token,
                input_user_id: userId
              });

            if (acceptError) {
              console.error('❌ Error auto-accepting invitation:', acceptError);
            } else {
              console.log('✅ Auto-accepted invitation, assigned role:', assignedRole);
            }
          } catch (acceptError) {
            console.error('❌ Error in auto-accept process:', acceptError);
          }
        }
      }

      // Obtener rol del usuario (después de procesar invitaciones)
      const { data: roleData, error: roleError } = await supabase
        .rpc('get_user_role', { _user_id: userId });

      if (roleError) {
        console.error('❌ Error fetching role:', roleError);
      } else {
        console.log('🎭 Role data found:', roleData);
      }

      setProfile(profileData);
      setUserRole(roleData || null);
    } catch (error) {
      console.error('❌ Error in processUser:', error);
      setProfile(null);
      setUserRole(null);
    }
  };

  useEffect(() => {
    // Set up auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('Auth state changed:', event, session?.user?.id);
        setSession(session);
        setUser(session?.user ?? null);

        if (session?.user) {
          // Defer user processing to avoid blocking auth state change
          setTimeout(() => {
            processUser(session.user.id);
          }, 0);
        } else {
          setProfile(null);
          setUserRole(null);
        }
        
        setIsLoading(false);
      }
    );

    // Check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      
      if (session?.user) {
        processUser(session.user.id);
      }
      
      setIsLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    setIsLoading(true);
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    setIsLoading(false);
    return { error };
  };

  const signUp = async (email: string, password: string, fullName?: string) => {
    setIsLoading(true);
    const redirectUrl = `${window.location.origin}/`;
    
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl,
        data: fullName ? { full_name: fullName } : undefined,
      },
    });
    setIsLoading(false);
    return { error };
  };

  const signOut = async () => {
    setIsLoading(true);
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setProfile(null);
    setUserRole(null);
    setIsLoading(false);
  };

  const updateProfile = async (updates: Partial<Profile>) => {
    if (!user) return { error: new Error('No authenticated user') };

    const { error } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', user.id);

    if (!error && profile) {
      setProfile({ ...profile, ...updates });
    }

    return { error };
  };

  return {
    user,
    session,
    profile,
    userRole,
    isLoading,
    signIn,
    signUp,
    signOut,
    updateProfile,
  };
};

export { AuthContext };
