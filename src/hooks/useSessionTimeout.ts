import { useEffect, useRef } from 'react';
import { useAuth } from './useAuth';

const INACTIVITY_TIMEOUT = 30 * 60 * 1000; // 30 minutes
const WARNING_TIMEOUT = 25 * 60 * 1000; // 25 minutes (5 minute warning)

export const useSessionTimeout = () => {
  const { signOut, user } = useAuth();
  const timeoutRef = useRef<NodeJS.Timeout>();
  const warningTimeoutRef = useRef<NodeJS.Timeout>();
  const lastActivityRef = useRef<number>(Date.now());

  const resetTimer = () => {
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
        const userConfirm = confirm(
          'Your session will expire in 5 minutes due to inactivity. Click OK to continue your session.'
        );
        if (userConfirm) {
          resetTimer();
        }
      }, WARNING_TIMEOUT);

      // Set logout timeout
      timeoutRef.current = setTimeout(() => {
        signOut();
        alert('Your session has expired due to inactivity. Please log in again.');
      }, INACTIVITY_TIMEOUT);
    }
  };

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
  }, [user, signOut]);

  return { resetTimer };
};