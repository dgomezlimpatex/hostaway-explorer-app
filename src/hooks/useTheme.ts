
import { useEffect } from 'react';

export const useTheme = () => {
  // Siempre usar tema claro fijo
  const theme = 'light';

  useEffect(() => {
    const root = window.document.documentElement;
    root.classList.remove('light', 'dark');
    root.classList.add('light');
    // Limpiar cualquier preferencia guardada para forzar modo claro
    localStorage.removeItem('theme');
  }, []);

  return { theme };
};
