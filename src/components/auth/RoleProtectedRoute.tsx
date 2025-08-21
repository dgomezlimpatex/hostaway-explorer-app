
import React from 'react';
import { Navigate } from 'react-router-dom';
import { useRolePermissions } from '@/hooks/useRolePermissions';
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

  // Si no hay módulo requerido, mostrar contenido
  if (!requiredModule) {
    return <>{children}</>;
  }

  // Verificar permisos
  const hasAccess = hasPermission(requiredModule as any, requiredAction);

  if (!hasAccess) {
    return <Navigate to={fallbackPath} replace />;
  }

  return <>{children}</>;
};
