
import React from 'react';
import { Navigate } from 'react-router-dom';
import { useRolePermissions } from '@/hooks/useRolePermissions';
import { useAuth } from '@/hooks/useAuth';
import { Loader2, AlertTriangle } from 'lucide-react';

interface RoleProtectedRouteProps {
  children: React.ReactNode;
  requiredModule?: string;
  requiredAction?: 'canView' | 'canCreate' | 'canEdit' | 'canDelete';
  fallbackPath?: string;
}

export const RoleProtectedRoute: React.FC<RoleProtectedRouteProps> = ({
  children,
  requiredModule,
  requiredAction = 'canView',
  fallbackPath = '/',
}) => {
  const { hasPermission, userRole } = useRolePermissions();
  const { isLoading } = useAuth();

  // Si no hay módulo requerido, mostrar contenido
  if (!requiredModule) {
    return <>{children}</>;
  }

  // Mientras se carga el rol, mostrar loading en lugar de redirigir
  if (!userRole) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Verificar permisos
  const hasAccess = hasPermission(requiredModule as any, requiredAction);

  if (!hasAccess) {
    return <Navigate to={fallbackPath} replace />;
  }

  return <>{children}</>;
};
