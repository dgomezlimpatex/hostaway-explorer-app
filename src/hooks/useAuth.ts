
import { useState, useEffect, useRef, useCallback, createContext, useContext } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { passwordSignIn, type LoginError } from '@/auth/passwordSignIn';
import { useQueryClient } from '@tanstack/react-query';
import { cacheCleanerData, readCleanerCache, withTimeout } from '@/features/cleaner/offlineStore';
import type { Database } from '@/integrations/supabase/types';
import {
  canUseOperationalMode,
  getDefaultOperationalMode,
  type OperationalMode,
} from '@/auth/operationalMode';

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
  userRoles: AppRole[];
  operationalMode: OperationalMode;
  canSwitchOperationalMode: boolean;
  setOperationalMode: (mode: OperationalMode) => void;
  isLoading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: LoginError | null }>;
  signUp: (email: string, password: string, fullName?: string) => Promise<{ error: any }>;
  signOut: () => Promise<void>;
  updateProfile: (updates: Partial<Profile>) => Promise<{ error: Error | { message: string } | null }>;
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
  const [userRoles, setUserRoles] = useState<AppRole[]>([]);
  const [operationalMode, setOperationalModeState] = useState<OperationalMode>('supervision');
  const [isLoading, setIsLoading] = useState(true);

  const queryClient = useQueryClient();
  const activeUserRef = useRef<string | null>(null);
  const processedUserRef = useRef<string | null>(null);
  const processingRef = useRef<{ id: string; promise: Promise<void> } | null>(null);

  const processUser = useCallback((authUser: User, force = false): Promise<void> => {
    const userId = authUser.id;
    if (processingRef.current?.id === userId) return processingRef.current.promise;
    if (!force && processedUserRef.current === userId) return Promise.resolve();

    const applyIdentity = (profileData: Profile | null, role: AppRole | null, roles: AppRole[]) => {
      if (activeUserRef.current !== userId) return;
      const defaultMode = getDefaultOperationalMode(roles, role);
      const storedMode = localStorage.getItem(`limpatex-operational-mode:${userId}`);
      const mode = storedMode === 'cleaning' || storedMode === 'supervision' ? storedMode : defaultMode;
      setProfile(profileData);
      setUserRole(role);
      setUserRoles(roles);
      setOperationalModeState(canUseOperationalMode(roles, mode) ? mode : defaultMode);
    };

    const operation = (async () => {
      const cached = await readCleanerCache<{ profile: Profile | null; role: AppRole; roles: AppRole[] }>(`${userId}:auth`).catch(() => undefined);
      // Restore only the cleaning UI and only for the user in the SDK's existing session.
      if (!navigator.onLine && cached?.data.roles.includes('cleaner')) {
        applyIdentity(cached.data.profile, 'cleaner', ['cleaner']);
        processedUserRef.current = userId;
        return;
      }
      try {
        const [profileResult, primaryRole, roleRows, invitations] = await withTimeout(Promise.all([
          supabase.from('profiles').select('*').eq('id', userId).maybeSingle(),
          supabase.rpc('get_user_role', { _user_id: userId }),
          supabase.from('user_roles').select('role').eq('user_id', userId),
          authUser.email ? supabase.from('user_invitations').select('invitation_token')
            .eq('email', authUser.email).eq('status', 'pending').gt('expires_at', new Date().toISOString())
            .order('created_at', { ascending: false }).limit(1) : Promise.resolve({ data: [], error: null }),
        ]));
        if (profileResult.error) throw profileResult.error;
        if (primaryRole.error) throw primaryRole.error;
        if (roleRows.error) throw roleRows.error;
        let role = primaryRole.data;
        let roles = roleRows.data.map(row => row.role) as AppRole[];
        if (!roles.length && role) roles = [role];
        if (invitations.data?.[0] && activeUserRef.current === userId) {
          const { error } = await supabase.rpc('accept_invitation', {
            invitation_token: invitations.data[0].invitation_token, input_user_id: userId,
          });
          if (!error) {
            const [nextPrimary, nextRoles] = await Promise.all([
              supabase.rpc('get_user_role', { _user_id: userId }),
              supabase.from('user_roles').select('role').eq('user_id', userId),
            ]);
            if (nextPrimary.error) throw nextPrimary.error;
            if (nextRoles.error) throw nextRoles.error;
            role = nextPrimary.data;
            roles = nextRoles.data.map(row => row.role);
            if (!roles.length && role) roles = [role];
          }
        }
        if (activeUserRef.current !== userId) return;
        applyIdentity(profileResult.data, role, roles);
        processedUserRef.current = userId;
        if (roles.includes('cleaner')) {
          await cacheCleanerData(`${userId}:auth`, { profile: profileResult.data, role, roles }).catch(() => undefined);
        }
      } catch (error) {
        if (activeUserRef.current !== userId) return;
        if (cached?.data.roles.includes('cleaner')) applyIdentity(cached.data.profile, 'cleaner', ['cleaner']);
        else applyIdentity(null, null, []);
        console.error('No se pudo actualizar el perfil de acceso', error);
      }
    })().finally(() => {
      if (processingRef.current?.id === userId) processingRef.current = null;
      if (activeUserRef.current === userId) setIsLoading(false);
    });
    processingRef.current = { id: userId, promise: operation };
    return operation;
  }, []);

  useEffect(() => {
    let cancelled = false;
    const timers = new Set<ReturnType<typeof setTimeout>>();
    const applySession = (nextSession: Session | null, force = false) => {
      if (cancelled) return;
      const userId = nextSession?.user.id || null;
      if (activeUserRef.current !== userId) {
        activeUserRef.current = userId;
        processedUserRef.current = null;
        queryClient.clear();
        setProfile(null); setUserRole(null); setUserRoles([]);
        setOperationalModeState('supervision');
        setIsLoading(Boolean(userId));
      }
      setSession(nextSession);
      setUser(nextSession?.user ?? null);
      if (nextSession?.user) {
        // Never await Supabase queries inside its auth callback.
        const timer = setTimeout(() => {
          timers.delete(timer);
          if (!cancelled) void processUser(nextSession.user, force);
        }, 0);
        timers.add(timer);
      } else setIsLoading(false);
    };

    // The SDK's persisted session can still identify local drafts while offline, even if token refresh waits.
    if (!navigator.onLine) {
      try {
        const stored = localStorage.getItem('sb-qyipyygojlfhdghnraus-auth-token');
        const existing = stored ? JSON.parse(stored) as Session : null;
        if (existing?.user?.id && existing.access_token) applySession(existing);
      } catch { /* The SDK handles an absent/corrupt session normally. */ }
    }
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, nextSession) => {
      applySession(nextSession, event === 'USER_UPDATED');
    });
    void supabase.auth.getSession().then(({ data: { session: existing }, error }) => {
      if (!error) applySession(existing);
      else if (!activeUserRef.current) setIsLoading(false);
    }).catch(() => { if (!activeUserRef.current) setIsLoading(false); });
    const refreshIdentity = () => {
      if (navigator.onLine) void supabase.auth.getSession().then(({ data }) => {
        if (data.session && !cancelled) void processUser(data.session.user, true);
      });
    };
    window.addEventListener('online', refreshIdentity);
    return () => { cancelled = true; timers.forEach(clearTimeout); subscription.unsubscribe(); window.removeEventListener('online', refreshIdentity); };
  }, [processUser, queryClient]);

  const signIn = (email: string, password: string) => passwordSignIn({
    email,
    storage: {
      getItem: (key) => localStorage.getItem(key),
      setItem: (key, value) => localStorage.setItem(key, value),
    },
    authenticate: async () => {
      const result = await supabase.auth.signInWithPassword({ email, password });
      if (!result.error && result.data.user && activeUserRef.current === result.data.user.id) {
        await processUser(result.data.user);
      }
      return result;
    },
    setLoading: setIsLoading,
  });

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

  const signOut = useCallback(async () => {
    setIsLoading(true);
    await supabase.auth.signOut();
    activeUserRef.current = null;
    processedUserRef.current = null;
    queryClient.clear();
    setUser(null);
    setSession(null);
    setProfile(null);
    setUserRole(null);
    setUserRoles([]);
    setOperationalModeState('supervision');
    setIsLoading(false);
  }, [queryClient]);

  const canSwitchOperationalMode =
    canUseOperationalMode(userRoles, 'supervision') && canUseOperationalMode(userRoles, 'cleaning');

  const setOperationalMode = (mode: OperationalMode) => {
    if (!canUseOperationalMode(userRoles, mode)) return;
    setOperationalModeState(mode);
    if (user?.id && typeof window !== 'undefined') {
      window.localStorage.setItem(`limpatex-operational-mode:${user.id}`, mode);
    }
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
    userRoles,
    operationalMode,
    canSwitchOperationalMode,
    setOperationalMode,
    isLoading,
    signIn,
    signUp,
    signOut,
    updateProfile,
  };
};

export { AuthContext };
