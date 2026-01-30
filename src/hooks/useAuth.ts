
import { useState, useEffect, createContext, useContext } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';

// Password validation utility
const validatePassword = (password: string): string[] => {
  const errors: string[] = [];
  if (password.length < 8) errors.push('at least 8 characters');
  if (!/[A-Z]/.test(password)) errors.push('one uppercase letter');
  if (!/[a-z]/.test(password)) errors.push('one lowercase letter');
  if (!/\d/.test(password)) errors.push('one number');
  if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) errors.push('one special character');
  return errors;
};

// Login attempt tracking
const LOGIN_ATTEMPTS_KEY = 'login_attempts';
const MAX_ATTEMPTS = 5;
const LOCKOUT_DURATION = 15 * 60 * 1000; // 15 minutes

const checkLoginAttempts = async (email: string): Promise<boolean> => {
  const attempts = JSON.parse(localStorage.getItem(LOGIN_ATTEMPTS_KEY) || '{}');
  const userAttempts = attempts[email];
  
  if (!userAttempts) return true;
  
  const now = Date.now();
  if (userAttempts.count >= MAX_ATTEMPTS) {
    if (now - userAttempts.lastAttempt < LOCKOUT_DURATION) {
      return false;
    }
    // Reset after lockout period
    delete attempts[email];
    localStorage.setItem(LOGIN_ATTEMPTS_KEY, JSON.stringify(attempts));
  }
  
  return true;
};

const logLoginAttempt = async (email: string, success: boolean): Promise<void> => {
  const attempts = JSON.parse(localStorage.getItem(LOGIN_ATTEMPTS_KEY) || '{}');
  
  if (success) {
    // Reset attempts on successful login
    delete attempts[email];
  } else {
    // Increment failed attempts
    attempts[email] = {
      count: (attempts[email]?.count || 0) + 1,
      lastAttempt: Date.now()
    };
  }
  
  localStorage.setItem(LOGIN_ATTEMPTS_KEY, JSON.stringify(attempts));
};

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

  // Add state to prevent multiple processing calls
  const [processingUser, setProcessingUser] = useState<string | null>(null);
  // Track if initial session check is complete
  const [initialCheckComplete, setInitialCheckComplete] = useState(false);

  const processUser = async (userId: string, setLoadingFalseWhenDone = false) => {
    // Prevent multiple calls for the same user
    if (processingUser === userId) {
      console.log('🔍 Already processing user:', userId);
      return;
    }

    try {
      setProcessingUser(userId);
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
    } finally {
      setProcessingUser(null);
      // Only set loading to false after user processing is complete
      if (setLoadingFalseWhenDone) {
        setIsLoading(false);
      }
    }
  };

  useEffect(() => {
    let mounted = true;
    
    // Set up auth state listener FIRST (as per Supabase best practices)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, currentSession) => {
        if (!mounted) return;
        
        console.log('Auth state changed:', event, currentSession?.user?.id);
        setSession(currentSession);
        setUser(currentSession?.user ?? null);

        if (currentSession?.user) {
          // For subsequent auth changes (not initial load), process user
          if (initialCheckComplete) {
            await processUser(currentSession.user.id, true);
          }
        } else {
          setProfile(null);
          setUserRole(null);
          setProcessingUser(null);
          setIsLoading(false);
        }
      }
    );

    // Check for existing session AFTER setting up listener
    const initializeAuth = async () => {
      try {
        const { data: { session: existingSession } } = await supabase.auth.getSession();
        
        if (!mounted) return;
        
        setSession(existingSession);
        setUser(existingSession?.user ?? null);
        
        if (existingSession?.user) {
          // Process user and WAIT for it to complete before setting loading false
          await processUser(existingSession.user.id, true);
        } else {
          setIsLoading(false);
        }
      } catch (error) {
        console.error('Error initializing auth:', error);
        if (mounted) {
          setIsLoading(false);
        }
      } finally {
        if (mounted) {
          setInitialCheckComplete(true);
        }
      }
    };

    initializeAuth();

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const signIn = async (email: string, password: string) => {
    setIsLoading(true);
    
    // Rate limiting check
    const canAttempt = await checkLoginAttempts(email);
    if (!canAttempt) {
      setIsLoading(false);
      return { error: { message: 'Too many login attempts. Please try again later.' } };
    }
    
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    
    // Log login attempt
    await logLoginAttempt(email, !error);
    
    setIsLoading(false);
    return { error };
  };

  const signUp = async (email: string, password: string, fullName?: string) => {
    setIsLoading(true);
    
    // Enhanced password validation
    const passwordErrors = validatePassword(password);
    if (passwordErrors.length > 0) {
      setIsLoading(false);
      return { error: { message: `Password requirements: ${passwordErrors.join(', ')}` } };
    }
    
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
