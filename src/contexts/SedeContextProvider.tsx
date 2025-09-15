import { useEffect, useCallback } from 'react';
import { SedeProvider } from './SedeContext';

/**
 * Provider simple que solo envuelve SedeProvider
 */
export const SedeContextProvider = ({ children }: { children: React.ReactNode }) => {
  console.log('🏗️ SedeContextProvider: Component mounting');
  return (
    <SedeProvider>
      {children}
    </SedeProvider>
  );
};