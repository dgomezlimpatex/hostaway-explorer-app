
import React from 'react';
import { Navigate } from 'react-router-dom';
import { useRolePermissions, type RolePermissions } from '@/hooks/useRolePermissions';
import { useAuth } from '@/hooks/useAuth';
import { Loader2, AlertTriangle } from 'lucide-react';

interface RoleProtectedRouteProps {
  children: React.ReactNode;
  requiredModule?: keyof RolePermissions;
  requiredAction?: 'canView' | 'canCreate' | 'canEdit' | 'canDelete';
  excludedRoles?: string[];
  fallbackPath?: string;
}

export const RoleProtectedRoute: React.FC<RoleProtectedRouteProps> = ({
  children,
  requiredModule,
  requiredAction = 'canView',
  excludedRoles = [],
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
  const hasAccess = !excludedRoles.includes(userRole) && hasPermission(requiredModule, requiredAction);

  if (!hasAccess) {
    return <Navigate to={fallbackPath} replace />;
  }

  return <>{children}</>;
};
