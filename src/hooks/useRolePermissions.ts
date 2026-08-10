import { useAuth } from './useAuth';
import {
  getRolePermissions,
  type ModulePermission,
  type RolePermissions,
} from '@/lib/rolePermissions';

export type { ModulePermission, RolePermissions } from '@/lib/rolePermissions';

export const useRolePermissions = () => {
  const { userRole } = useAuth();

  const getPermissions = (): RolePermissions => getRolePermissions(userRole);

  const hasPermission = (
    module: keyof RolePermissions,
    action: keyof ModulePermission,
  ): boolean => getPermissions()[module]?.[action] ?? false;

  const canAccessModule = (module: keyof RolePermissions): boolean => (
    hasPermission(module, 'canView')
  );

  const isAdminOrManager = (): boolean => userRole === 'admin' || userRole === 'manager';
  const isSupervisor = (): boolean => userRole === 'supervisor';
  const isCleaner = (): boolean => userRole === 'cleaner';

  return {
    permissions: getPermissions(),
    hasPermission,
    canAccessModule,
    isAdminOrManager,
    isSupervisor,
    isCleaner,
    userRole,
  };
};
