import { useState, useCallback, useEffect } from 'react';
import { useDeviceType } from '@/hooks/use-mobile';

interface MobileError {
  id: string;
  timestamp: string;
  type: 'upload' | 'incident' | 'save' | 'network' | 'general';
  title: string;
  message: string;
  details?: any;
  context?: any;
  stackTrace?: string;
  userAction?: string;
  deviceInfo?: any;
}

interface ErrorContext {
  reportId?: string;
  taskId?: string;
  fileName?: string;
  fileSize?: number;
  currentStep?: string;
  userAgent?: string;
  url?: string;
  // Campos adicionales para debugging
  missingField?: string;
  currentIssuesCount?: number;
  totalIssuesAfterAdd?: number;
  attempts?: number;
  errorType?: string;
  isOnline?: boolean;
  userId?: string;
  currentCleanerId?: string;
  hasCurrentReport?: boolean;
  hasExistingReport?: boolean;
  issuesCount?: number;
  completionPercentage?: number;
  hasPropertyId?: boolean;
  newIssueData?: any;
  [key: string]: any; // Para permitir campos adicionales dinámicos
}

export const useMobileErrorHandler = () => {
  const { isMobile } = useDeviceType();
  const [errors, setErrors] = useState<MobileError[]>([]);
  const [isVisible, setIsVisible] = useState(false);

  // Obtener información del dispositivo
  const getDeviceInfo = () => ({
    userAgent: navigator.userAgent,
    platform: navigator.platform,
    language: navigator.language,
    cookieEnabled: navigator.cookieEnabled,
    onLine: navigator.onLine,
    screenResolution: `${screen.width}x${screen.height}`,
    windowSize: `${window.innerWidth}x${window.innerHeight}`,
    timestamp: new Date().toISOString()
  });

  // Generar mensaje amigable basado en el tipo de error
  const generateUserFriendlyMessage = (type: MobileError['type'], originalError: string): string => {
    const messages = {
      upload: {
        network: "No se pudo subir la foto. Verifica tu conexión a internet.",
        size: "La foto es demasiado grande. Intenta con una foto más pequeña.",
        format: "Formato de archivo no válido. Usa JPG, PNG o HEIC.",
        permission: "No hay permisos para subir archivos. Contacta al administrador.",
        storage: "No hay espacio suficiente en el servidor.",
        timeout: "La subida tardó demasiado. Intenta de nuevo.",
        unknown: "Error desconocido al subir la foto. Intenta de nuevo."
      },
      incident: {
        save: "No se pudo guardar la incidencia. Verifica que hayas completado todos los campos.",
        network: "Error de conexión al guardar incidencia. Intenta de nuevo.",
        unknown: "Error al procesar la incidencia."
      },
      save: {
        network: "No se pudo guardar el reporte. Verifica tu conexión.",
        validation: "Faltan campos obligatorios en el reporte.",
        permission: "No tienes permisos para guardar este reporte.",
        unknown: "Error al guardar el reporte."
      },
      network: {
        offline: "Sin conexión a internet. Algunos datos se guardarán cuando tengas conexión.",
        timeout: "Conexión lenta o inestable. Intenta de nuevo.",
        server: "Servidor no disponible temporalmente.",
        unknown: "Error de conexión."
      },
      general: {
        unknown: "Error inesperado en la aplicación."
      }
    };

    const errorLower = originalError.toLowerCase();
    
    if (type === 'upload') {
      if (errorLower.includes('network') || errorLower.includes('fetch') || errorLower.includes('timeout')) {
        return messages.upload.network;
      }
      if (errorLower.includes('413') || errorLower.includes('large') || errorLower.includes('size')) {
        return messages.upload.size;
      }
      if (errorLower.includes('format') || errorLower.includes('type') || errorLower.includes('invalid')) {
        return messages.upload.format;
      }
      if (errorLower.includes('401') || errorLower.includes('403') || errorLower.includes('permission')) {
        return messages.upload.permission;
      }
      if (errorLower.includes('storage') || errorLower.includes('quota') || errorLower.includes('space')) {
        return messages.upload.storage;
      }
      return messages.upload.unknown;
    }
    
    if (type === 'incident') {
      if (errorLower.includes('network') || errorLower.includes('connection')) {
        return messages.incident.network;
      }
      if (errorLower.includes('validation') || errorLower.includes('required')) {
        return messages.incident.save;
      }
      return messages.incident.unknown;
    }
    
    if (type === 'save') {
      if (errorLower.includes('network') || errorLower.includes('connection')) {
        return messages.save.network;
      }
      if (errorLower.includes('validation') || errorLower.includes('required')) {
        return messages.save.validation;
      }
      if (errorLower.includes('permission') || errorLower.includes('unauthorized')) {
        return messages.save.permission;
      }
      return messages.save.unknown;
    }
    
    if (type === 'network') {
      if (errorLower.includes('offline') || !navigator.onLine) {
        return messages.network.offline;
      }
      if (errorLower.includes('timeout') || errorLower.includes('slow')) {
        return messages.network.timeout;
      }
      if (errorLower.includes('server') || errorLower.includes('503') || errorLower.includes('500')) {
        return messages.network.server;
      }
      return messages.network.unknown;
    }
    
    return messages.general.unknown;
  };

  const addError = useCallback((
    type: MobileError['type'],
    title: string,
    error: string | Error,
    context?: ErrorContext,
    userAction?: string
  ) => {
    // Solo mostrar en móvil
    if (!isMobile) {
      console.error(`[${type.toUpperCase()}] ${title}:`, error, context);
      return;
    }

    const errorMessage = error instanceof Error ? error.message : error;
    const stackTrace = error instanceof Error ? error.stack : undefined;
    
    const newError: MobileError = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date().toISOString(),
      type,
      title,
      message: generateUserFriendlyMessage(type, errorMessage),
      details: {
        originalError: errorMessage,
        errorType: error instanceof Error ? error.constructor.name : 'String',
        ...context
      },
      context: {
        url: window.location.href,
        ...context
      },
      stackTrace,
      userAction,
      deviceInfo: getDeviceInfo()
    };

    console.error(`🚨 MOBILE ERROR [${type.toUpperCase()}]:`, {
      title,
      message: newError.message,
      originalError: errorMessage,
      context,
      userAction,
      errorId: newError.id
    });

    setErrors(prev => {
      const updatedErrors = [newError, ...prev];
      // Mantener solo los últimos 10 errores
      return updatedErrors.slice(0, 10);
    });
    
    setIsVisible(true);
  }, [isMobile]);

  const dismissError = useCallback((errorId: string) => {
    setErrors(prev => prev.filter(error => error.id !== errorId));
  }, []);

  const dismissAllErrors = useCallback(() => {
    setErrors([]);
    setIsVisible(false);
  }, []);

  const hideErrorDisplay = useCallback(() => {
    setIsVisible(false);
  }, []);

  const showErrorDisplay = useCallback(() => {
    if (errors.length > 0) {
      setIsVisible(true);
    }
  }, [errors.length]);

  // Auto-ocultar si no hay errores
  useEffect(() => {
    if (errors.length === 0) {
      setIsVisible(false);
    }
  }, [errors.length]);

  // Limpiar errores antiguos automáticamente (más de 30 minutos)
  useEffect(() => {
    const cleanup = setInterval(() => {
      const cutoff = Date.now() - (30 * 60 * 1000); // 30 minutos
      setErrors(prev => prev.filter(error => 
        new Date(error.timestamp).getTime() > cutoff
      ));
    }, 5 * 60 * 1000); // Revisar cada 5 minutos

    return () => clearInterval(cleanup);
  }, []);

  return {
    errors,
    isVisible,
    addError,
    dismissError,
    dismissAllErrors,
    hideErrorDisplay,
    showErrorDisplay,
    
    // Funciones específicas para tipos de error
    addUploadError: (title: string, error: string | Error, context?: ErrorContext, userAction?: string) => 
      addError('upload', title, error, context, userAction),
    
    addIncidentError: (title: string, error: string | Error, context?: ErrorContext, userAction?: string) => 
      addError('incident', title, error, context, userAction),
    
    addSaveError: (title: string, error: string | Error, context?: ErrorContext, userAction?: string) => 
      addError('save', title, error, context, userAction),
    
    addNetworkError: (title: string, error: string | Error, context?: ErrorContext, userAction?: string) => 
      addError('network', title, error, context, userAction),

    // Estadísticas
    getErrorStats: () => ({
      total: errors.length,
      byType: errors.reduce((acc, error) => {
        acc[error.type] = (acc[error.type] || 0) + 1;
        return acc;
      }, {} as Record<string, number>),
      recent: errors.filter(error => 
        Date.now() - new Date(error.timestamp).getTime() < 5 * 60 * 1000
      ).length
    })
  };
};