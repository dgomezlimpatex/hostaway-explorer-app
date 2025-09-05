import { ReactNode } from 'react';
import { useAuthGuard } from '@/hooks/useAuthGuard';
import { NoSedeWarning } from '@/components/common/NoSedeWarning';
import { Loader2 } from 'lucide-react';

interface ProtectedRouteProps {
  children: ReactNode;
  requiredRoles?: string[];
  fallback?: ReactNode;
}

export const ProtectedRoute = ({ 
  children, 
  requiredRoles,
  fallback 
}: ProtectedRouteProps) => {
  const { 
    isLoading, 
    isAuthenticated, 
    hasRole, 
    hasSedeAccess, 
    canAccessRoute,
    user 
  } = useAuthGuard();

  // Show loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2" />
          <p className="text-muted-foreground">Cargando...</p>
        </div>
      </div>
    );
  }

  // Check authentication
  if (!isAuthenticated) {
    return fallback || (
      <div className="flex items-center justify-center min-h-[400px]">
        <p>Acceso no autorizado</p>
      </div>
    );
  }

  // Check role requirement
  if (!hasRole || !canAccessRoute(requiredRoles)) {
    return fallback || (
      <div className="flex items-center justify-center min-h-[400px]">
        <p>No tienes permisos para acceder a esta página</p>
      </div>
    );
  }

  // Check sede access
  if (!hasSedeAccess) {
    return (
      <NoSedeWarning 
        userEmail={user?.email} 
        userName={user?.user_metadata?.full_name}
      />
    );
  }

  return <>{children}</>;
};