import { useCallback, useEffect, useRef } from 'react';
import { useAuth } from './useAuth';
import { useCleanerOfflineStatus } from '@/features/cleaner/CleanerOfflineProvider';

const INACTIVITY_TIMEOUT = 30 * 60 * 1000; // 30 minutes
const WARNING_TIMEOUT = 25 * 60 * 1000; // 25 minutes (5 minute warning)

// Decisión de Dani (12/10/2026): las limpiadoras no se desconectan por inactividad.
// Una limpieza dura más de 30 minutos con el móvil guardado y, al volver, la app pedía
// entrar de nuevo, perdía la tarea abierta y no podía enviar el reporte. Solo salen al
// cerrar sesión. El resto de roles mantiene el cierre a los 30 minutos.

export const useSessionTimeout = () => {
  const { signOut, user } = useAuth();
  const cleanerOffline = useCleanerOfflineStatus();
  const isCleaner = Boolean(cleanerOffline);
  const cleanerRef = useRef(isCleaner);
  cleanerRef.current = isCleaner;
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

    if (user && !cleanerRef.current) {
      // Set warning timeout
      warningTimeoutRef.current = setTimeout(() => {
        if (cleanerRef.current) return;
        const userConfirm = confirm(
          'Tu sesión se cerrará en 5 minutos por inactividad. Pulsa Aceptar para seguir trabajando.'
        );
        if (userConfirm) {
          reset();
        }
      }, WARNING_TIMEOUT);

      // Set logout timeout
      timeoutRef.current = setTimeout(() => {
        // The role can load after the timers were scheduled: never sign out a cleaner.
        if (cleanerRef.current) return;
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
  }, [user, resetTimer, isCleaner]);

  return { resetTimer };
};
