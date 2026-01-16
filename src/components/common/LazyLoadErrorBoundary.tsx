import React, { Component, ReactNode, Suspense, startTransition } from 'react';
import { Button } from '@/components/ui/button';
import { RefreshCw, AlertTriangle } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  isLazyLoadError: boolean;
  retryCount: number;
}

// Loading component for lazy components
const LazyLoader = () => (
  <div className="flex items-center justify-center min-h-screen">
    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
  </div>
);

// Error component for failed lazy loads
const LazyLoadError = ({ onRetry, error }: { onRetry: () => void; error: Error | null }) => (
  <div className="flex flex-col items-center justify-center min-h-screen p-6">
    <div className="bg-background/80 backdrop-blur-sm border rounded-lg p-8 max-w-md w-full shadow-lg">
      <div className="flex items-center gap-3 mb-4">
        <AlertTriangle className="h-6 w-6 text-destructive" />
        <h2 className="text-lg font-semibold">Error al cargar la página</h2>
      </div>

      <p className="text-muted-foreground mb-6 text-sm">
        Ha ocurrido un error al cargar esta sección. Esto puede deberse a problemas de conexión o de servidor.
      </p>

      {error && (
        <details className="mb-4">
          <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground">
            Detalles técnicos
          </summary>
          <pre className="text-xs mt-2 p-2 bg-muted rounded text-muted-foreground overflow-auto">
            {error.message}
          </pre>
        </details>
      )}

      <div className="flex gap-2">
        <Button onClick={onRetry} className="flex-1">
          <RefreshCw className="h-4 w-4 mr-2" />
          Reintentar
        </Button>
        <Button variant="outline" onClick={() => window.location.reload()} className="flex-1">
          Recargar página
        </Button>
      </div>
    </div>
  </div>
);

export class LazyLoadErrorBoundary extends Component<Props, State> {
  private retryTimeoutId: number | null = null;

  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      isLazyLoadError: false,
      retryCount: 0,
    };
  }

  static getDerivedStateFromError(thrown: unknown): State {
    const error = thrown instanceof Error ? thrown : new Error(typeof thrown === 'string' ? thrown : JSON.stringify(thrown));

    const message = error?.message || '';
    const isLazyLoadError =
      message.includes('Failed to fetch dynamically imported module') ||
      message.includes('Loading chunk') ||
      message.includes('Loading CSS chunk') ||
      message.includes('suspended while responding to synchronous input') ||
      error.name === 'ChunkLoadError' ||
      message.includes('Minified React error #426');

    return {
      hasError: true,
      error,
      isLazyLoadError,
      retryCount: 0,
    };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('LazyLoadErrorBoundary caught an error:', error, errorInfo);
  }

  handleRetry = () => {
    const { retryCount } = this.state;

    if (retryCount >= 3) {
      window.location.reload();
      return;
    }

    startTransition(() => {
      if (this.retryTimeoutId) {
        clearTimeout(this.retryTimeoutId);
      }

      this.retryTimeoutId = window.setTimeout(() => {
        this.setState({
          hasError: false,
          error: null,
          isLazyLoadError: false,
          retryCount: retryCount + 1,
        });
      }, 1000 * (retryCount + 1));
    });
  };

  componentWillUnmount() {
    if (this.retryTimeoutId) {
      clearTimeout(this.retryTimeoutId);
    }
  }

  render() {
    if (this.state.hasError) {
      // For ANY error, show a safe fallback instead of throwing `null`
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return <LazyLoadError onRetry={this.handleRetry} error={this.state.error} />;
    }

    return <>{this.props.children}</>;
  }
}