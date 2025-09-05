import React, { Component, ReactNode, Suspense } from 'react';
import { Button } from '@/components/ui/button';
import { RefreshCw, AlertTriangle } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
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
        <Button 
          variant="outline" 
          onClick={() => window.location.reload()}
          className="flex-1"
        >
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
      retryCount: 0
    };
  }

  static getDerivedStateFromError(error: Error): State {
    // Check if it's a dynamic import error (lazy loading failure)
    const isLazyLoadError = error.message?.includes('Failed to fetch dynamically imported module') ||
                           error.message?.includes('Loading chunk') ||
                           error.message?.includes('Loading CSS chunk') ||
                           error.name === 'ChunkLoadError';

    return {
      hasError: true,
      error: isLazyLoadError ? error : null,
      retryCount: 0
    };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('LazyLoadErrorBoundary caught an error:', error, errorInfo);
  }

  handleRetry = () => {
    const { retryCount } = this.state;
    
    // Limit retries to prevent infinite loops
    if (retryCount >= 3) {
      window.location.reload();
      return;
    }

    // Clear any existing timeout
    if (this.retryTimeoutId) {
      clearTimeout(this.retryTimeoutId);
    }

    // Add a delay before retrying to avoid hammering the server
    this.retryTimeoutId = window.setTimeout(() => {
      this.setState({
        hasError: false,
        error: null,
        retryCount: retryCount + 1
      });
    }, 1000 * (retryCount + 1)); // Exponential backoff: 1s, 2s, 3s
  };

  componentWillUnmount() {
    if (this.retryTimeoutId) {
      clearTimeout(this.retryTimeoutId);
    }
  }

  render() {
    if (this.state.hasError) {
      // If it's a lazy load error, show our custom error component
      if (this.state.error) {
        return <LazyLoadError onRetry={this.handleRetry} error={this.state.error} />;
      }
      
      // For other errors, use the provided fallback or throw
      if (this.props.fallback) {
        return this.props.fallback;
      }
      
      throw this.state.error;
    }

    return (
      <Suspense fallback={<LazyLoader />}>
        {this.props.children}
      </Suspense>
    );
  }
}