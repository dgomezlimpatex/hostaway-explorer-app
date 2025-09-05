import { toast } from 'sonner';

export interface AppError {
  code: string;
  message: string;
  details?: any;
  isUserFriendly?: boolean;
}

export class AppErrorHandler {
  static handle(error: unknown, context?: string): AppError {
    console.error(`Error in ${context || 'unknown context'}:`, error);

    // Handle known error types
    if (error instanceof Error) {
      // Supabase auth errors
      if (error.message.includes('AuthApiError')) {
        return this.handleAuthError(error);
      }

      // Network errors
      if (error.message.includes('fetch')) {
        return this.handleNetworkError(error);
      }

      // Database errors
      if (error.message.includes('violates')) {
        return this.handleDatabaseError(error);
      }

      // Generic error
      return {
        code: 'GENERIC_ERROR',
        message: error.message,
        isUserFriendly: false
      };
    }

    // Unknown error type
    return {
      code: 'UNKNOWN_ERROR',
      message: 'Ha ocurrido un error inesperado',
      isUserFriendly: true,
      details: error
    };
  }

  private static handleAuthError(error: Error): AppError {
    if (error.message.includes('User not allowed')) {
      return {
        code: 'AUTH_INSUFFICIENT_PERMISSIONS',
        message: 'No tienes permisos suficientes para realizar esta acción',
        isUserFriendly: true
      };
    }

    if (error.message.includes('Invalid token')) {
      return {
        code: 'AUTH_INVALID_TOKEN',
        message: 'Tu sesión ha expirado. Por favor, inicia sesión nuevamente',
        isUserFriendly: true
      };
    }

    return {
      code: 'AUTH_ERROR',
      message: 'Error de autenticación',
      isUserFriendly: true
    };
  }

  private static handleNetworkError(error: Error): AppError {
    return {
      code: 'NETWORK_ERROR',
      message: 'Error de conexión. Verifica tu conexión a internet',
      isUserFriendly: true
    };
  }

  private static handleDatabaseError(error: Error): AppError {
    if (error.message.includes('unique constraint')) {
      return {
        code: 'DB_DUPLICATE_ENTRY',
        message: 'Ya existe un registro con estos datos',
        isUserFriendly: true
      };
    }

    if (error.message.includes('foreign key')) {
      return {
        code: 'DB_INVALID_REFERENCE',
        message: 'No se puede realizar la operación: referencia inválida',
        isUserFriendly: true
      };
    }

    return {
      code: 'DB_ERROR',
      message: 'Error en la base de datos',
      isUserFriendly: false
    };
  }

  static showError(error: AppError, context?: string) {
    const message = error.isUserFriendly 
      ? error.message 
      : 'Ha ocurrido un error inesperado';

    toast.error(message, {
      description: context ? `En: ${context}` : undefined,
      duration: 5000,
    });
  }

  static handleAndShow(error: unknown, context?: string): AppError {
    const appError = this.handle(error, context);
    this.showError(appError, context);
    return appError;
  }
}

// Helper function for common usage
export const handleError = (error: unknown, context?: string) => {
  return AppErrorHandler.handleAndShow(error, context);
};