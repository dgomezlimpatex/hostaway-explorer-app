import React, { Component, ReactNode } from 'react';
import { MobileErrorDisplay } from './MobileErrorDisplay';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: any;
}

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

export class MobileErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      error,
      errorInfo: null
    };
  }

  componentDidCatch(error: Error, errorInfo: any) {
    this.setState({
      error,
      errorInfo
    });
    
    // Solo en móvil, mostrar error visual
    if (this.isMobile()) {
      console.error('🚨 REACT ERROR BOUNDARY:', error, errorInfo);
    }
  }

  private isMobile(): boolean {
    return window.innerWidth <= 768 || /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  }

  private createMobileError(): MobileError {
    const { error, errorInfo } = this.state;
    
    return {
      id: `boundary-${Date.now()}`,
      timestamp: new Date().toISOString(),
      type: 'general',
      title: 'Error Crítico de la Aplicación',
      message: 'La aplicación encontró un error inesperado. Por favor, reinicia la app o contacta al administrador.',
      details: {
        errorMessage: error?.message || 'Error desconocido',
        errorName: error?.name || 'UnknownError',
        componentStack: errorInfo?.componentStack || 'No disponible'
      },
      context: {
        url: window.location.href,
        userAgent: navigator.userAgent,
        timestamp: new Date().toISOString()
      },
      stackTrace: error?.stack,
      userAction: 'Navegando por la aplicación',
      deviceInfo: {
        platform: navigator.platform,
        language: navigator.language,
        onLine: navigator.onLine,
        screenResolution: `${screen.width}x${screen.height}`,
        windowSize: `${window.innerWidth}x${window.innerHeight}`
      }
    };
  }

  private handleDismiss = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  private handleDismissAll = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  render() {
    if (this.state.hasError && this.isMobile()) {
      const mobileError = this.createMobileError();
      
      return (
        <MobileErrorDisplay
          errors={[mobileError]}
          onDismiss={this.handleDismiss}
          onDismissAll={this.handleDismissAll}
        />
      );
    }

    if (this.state.hasError) {
      // Fallback para desktop
      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
          <div className="max-w-md w-full bg-white shadow-lg rounded-lg p-6">
            <div className="text-center">
              <div className="text-red-600 text-6xl mb-4">⚠️</div>
              <h1 className="text-xl font-bold text-gray-900 mb-4">
                Error en la Aplicación
              </h1>
              <p className="text-gray-600 mb-6">
                Se produjo un error inesperado. Por favor, recarga la página.
              </p>
              <button
                onClick={() => window.location.reload()}
                className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
              >
                Recargar Página
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}