
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
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center max-w-md mx-auto p-6">
          <AlertTriangle className="h-16 w-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Acceso Denegado</h2>
          <p className="text-gray-600 mb-4">
            No tienes permisos para acceder a esta sección del sistema.
          </p>
          <p className="text-sm text-gray-500 mb-6">
            Tu rol actual: <span className="font-medium">{userRole}</span>
          </p>
          <Navigate to={fallbackPath} replace />
        </div>
      </div>
    );
  }

  return <>{children}</>;
};
