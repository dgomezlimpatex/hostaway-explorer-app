import { useAuth } from './useAuth';
import { getEffectiveRole } from '@/auth/operationalMode';
import {
  getRolePermissions,
  type ModulePermission,
  type RolePermissions,
} from '@/lib/rolePermissions';

export type { ModulePermission, RolePermissions } from '@/lib/rolePermissions';

export const useRolePermissions = () => {
  const {
    userRole,
    userRoles,
    operationalMode,
    canSwitchOperationalMode,
    setOperationalMode,
  } = useAuth();

  const effectiveRole = (): string | null => (
    getEffectiveRole(userRoles, userRole, operationalMode)
  );

  const getPermissions = (): RolePermissions => getRolePermissions(effectiveRole());

  const hasPermission = (
    module: keyof RolePermissions,
    action: keyof ModulePermission,
  ): boolean => getPermissions()[module]?.[action] ?? false;

  const canAccessModule = (module: keyof RolePermissions): boolean => (
    hasPermission(module, 'canView')
  );

  const isAdminOrManager = (): boolean => effectiveRole() === 'admin' || effectiveRole() === 'manager';
  const isSupervisor = (): boolean => effectiveRole() === 'supervisor';
  const isCleaner = (): boolean => effectiveRole() === 'cleaner';

  return {
    permissions: getPermissions(),
    hasPermission,
    canAccessModule,
    isAdminOrManager,
    isSupervisor,
    isCleaner,
    userRole,
    userRoles,
    operationalMode,
    canSwitchOperationalMode,
    setOperationalMode,
  };
};
