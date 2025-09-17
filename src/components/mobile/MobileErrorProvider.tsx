import React, { createContext, useContext, ReactNode } from 'react';
import { useMobileErrorHandler } from '@/hooks/useMobileErrorHandler';
import { MobileErrorDisplay } from './MobileErrorDisplay';
import { useDeviceType } from '@/hooks/use-mobile';

interface MobileErrorContextType {
  addUploadError: (title: string, error: string | Error, context?: any, userAction?: string) => void;
  addIncidentError: (title: string, error: string | Error, context?: any, userAction?: string) => void;
  addSaveError: (title: string, error: string | Error, context?: any, userAction?: string) => void;
  addNetworkError: (title: string, error: string | Error, context?: any, userAction?: string) => void;
  clearErrors: () => void;
  errorCount: number;
}

const MobileErrorContext = createContext<MobileErrorContextType | null>(null);

interface MobileErrorProviderProps {
  children: ReactNode;
}

export const MobileErrorProvider: React.FC<MobileErrorProviderProps> = ({ children }) => {
  const { isMobile } = useDeviceType();
  const {
    errors,
    isVisible,
    addUploadError,
    addIncidentError,
    addSaveError,
    addNetworkError,
    dismissError,
    dismissAllErrors,
  } = useMobileErrorHandler();

  const contextValue: MobileErrorContextType = {
    addUploadError,
    addIncidentError,
    addSaveError,
    addNetworkError,
    clearErrors: dismissAllErrors,
    errorCount: errors.length,
  };

  return (
    <MobileErrorContext.Provider value={contextValue}>
      {children}
      
      {/* Solo mostrar en móviles y cuando hay errores visibles */}
      {isMobile && isVisible && (
        <MobileErrorDisplay
          errors={errors}
          onDismiss={dismissError}
          onDismissAll={dismissAllErrors}
        />
      )}
    </MobileErrorContext.Provider>
  );
};

export const useMobileErrorContext = (): MobileErrorContextType => {
  const context = useContext(MobileErrorContext);
  if (!context) {
    throw new Error('useMobileErrorContext must be used within a MobileErrorProvider');
  }
  return context;
};

// Hook para usar en cualquier componente
export const useGlobalMobileError = () => {
  const { isMobile } = useDeviceType();
  
  // Si no es móvil, devolver funciones vacías
  if (!isMobile) {
    return {
      addUploadError: () => {},
      addIncidentError: () => {},
      addSaveError: () => {},
      addNetworkError: () => {},
      clearErrors: () => {},
      errorCount: 0,
    };
  }
  
  return useMobileErrorContext();
};