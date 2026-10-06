import { useCallback, useEffect, useRef } from 'react';
import { useAuth } from './useAuth';
import { useCleanerOfflineStatus } from '@/features/cleaner/CleanerOfflineProvider';

const INACTIVITY_TIMEOUT = 30 * 60 * 1000; // 30 minutes
const WARNING_TIMEOUT = 25 * 60 * 1000; // 25 minutes (5 minute warning)

export const useSessionTimeout = () => {
  const { signOut, user } = useAuth();
  const cleanerOffline = useCleanerOfflineStatus();
  const cleanerRef = useRef(Boolean(cleanerOffline));
  cleanerRef.current = Boolean(cleanerOffline);
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>();
  const warningTimeoutRef = useRef<ReturnType<typeof setTimeout>>();
  const lastActivityRef = useRef<number>(Date.now());

  const resetTimer = useCallback(function reset() {
    lastActivityRef.current = Date.now();
    
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    if (warningTimeoutRef.current) {
      clearTimeout(warningTimeoutRef.current);
    }

    if (user) {
      // Set warning timeout
      warningTimeoutRef.current = setTimeout(() => {
        if (cleanerRef.current && !navigator.onLine) return;
        const userConfirm = confirm(
          'Tu sesión se cerrará en 5 minutos por inactividad. Pulsa Aceptar para seguir trabajando.'
        );
        if (userConfirm) {
          reset();
        }
      }, WARNING_TIMEOUT);

      // Set logout timeout
      timeoutRef.current = setTimeout(() => {
        // Offline cleaners must be able to reopen their locally saved work.
        if (cleanerRef.current && !navigator.onLine) { reset(); return; }
        signOut();
        alert('La sesión se ha cerrado por inactividad. Vuelve a entrar para continuar.');
      }, INACTIVITY_TIMEOUT);
    }
  }, [user, signOut]);

  useEffect(() => {
    if (!user) return;

    const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click'];
    
    const resetOnActivity = () => {
      const now = Date.now();
      // Only reset if enough time has passed to avoid excessive resets
      if (now - lastActivityRef.current > 1000) {
        resetTimer();
      }
    };

    events.forEach(event => {
      document.addEventListener(event, resetOnActivity, true);
    });

    resetTimer();

    return () => {
      events.forEach(event => {
        document.removeEventListener(event, resetOnActivity, true);
      });
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      if (warningTimeoutRef.current) clearTimeout(warningTimeoutRef.current);
    };
  }, [user, resetTimer]);

  return { resetTimer };
};
