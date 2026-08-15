import { useAuth } from './useAuth';
import { getEffectiveRole } from '@/auth/operationalMode';

export type ModulePermission = {
  canView: boolean;
  canCreate: boolean;
  canEdit: boolean;
  canDelete: boolean;
};

export type RolePermissions = {
  dashboard: ModulePermission;
  calendar: ModulePermission;
  tasks: ModulePermission;
  workers: ModulePermission;
  clients: ModulePermission;
  properties: ModulePermission;
  reports: ModulePermission;
  supervision: ModulePermission;
  hostaway: ModulePermission;
  propertyGroups: ModulePermission;
  users: ModulePermission;
  inventory: ModulePermission;
  logistics: ModulePermission;
  admin: ModulePermission;
};

const createPermission = (canView: boolean, canCreate = false, canEdit = false, canDelete = false): ModulePermission => ({
  canView,
  canCreate,
  canEdit,
  canDelete,
});

const ROLE_PERMISSIONS: Record<string, RolePermissions> = {
  admin: {
    dashboard: createPermission(true, true, true, true),
    calendar: createPermission(true, true, true, true),
    tasks: createPermission(true, true, true, true),
    workers: createPermission(true, true, true, true),
    clients: createPermission(true, true, true, true),
    properties: createPermission(true, true, true, true),
    reports: createPermission(true, true, true, true),
    supervision: createPermission(true, true, true, true),
    hostaway: createPermission(true, true, true, true),
    propertyGroups: createPermission(true, true, true, true),
    users: createPermission(true, true, true, true),
    inventory: createPermission(true, true, true, true),
    logistics: createPermission(true, true, true, true),
    admin: createPermission(true, true, true, true),
  },
  manager: {
    dashboard: createPermission(true, true, true, true),
    calendar: createPermission(true, true, true, true),
    tasks: createPermission(true, true, true, true),
    workers: createPermission(true, true, true, true),
    clients: createPermission(true, true, true, true),
    properties: createPermission(true, true, true, true),
    reports: createPermission(true, true, true, true),
    supervision: createPermission(true, true, true, true),
    hostaway: createPermission(true, true, true, true),
    propertyGroups: createPermission(true, true, true, true),
    users: createPermission(true, true, true, true),
    inventory: createPermission(true, true, true, true),
    logistics: createPermission(true, true, true, true),
    admin: createPermission(false),
  },
  supervisor: {
    dashboard: createPermission(false),
    calendar: createPermission(true),
    tasks: createPermission(true),
    workers: createPermission(true),
    clients: createPermission(false),
    properties: createPermission(false),
    reports: createPermission(false),
    supervision: createPermission(true, true, true, false),
    hostaway: createPermission(false),
    propertyGroups: createPermission(false),
    users: createPermission(false),
    inventory: createPermission(true),
    logistics: createPermission(true),
    admin: createPermission(false),
  },
  cleaner: {
    dashboard: createPermission(false),
    calendar: createPermission(true),
    tasks: createPermission(true),
    workers: createPermission(false),
    clients: createPermission(false),
    properties: createPermission(false),
    reports: createPermission(false),
    supervision: createPermission(false),
    hostaway: createPermission(false),
    propertyGroups: createPermission(false),
    users: createPermission(false),
    inventory: createPermission(false),
    logistics: createPermission(false),
    admin: createPermission(false),
  },
  logistics: {
    dashboard: createPermission(false),
    calendar: createPermission(false),
    tasks: createPermission(false),
    workers: createPermission(false),
    clients: createPermission(false),
    properties: createPermission(false),
    reports: createPermission(false),
    supervision: createPermission(false),
    hostaway: createPermission(false),
    propertyGroups: createPermission(false),
    users: createPermission(false),
    inventory: createPermission(false),
    logistics: createPermission(true, true, true, true),
    admin: createPermission(false),
  },
};

export const useRolePermissions = () => {
  const {
    userRole,
    userRoles,
    operationalMode,
    canSwitchOperationalMode,
    setOperationalMode,
  } = useAuth();

  const getPermissions = (): RolePermissions => {
    const effectiveRole = getEffectiveRole(userRoles, userRole, operationalMode);
    if (!effectiveRole) {
      return Object.keys(ROLE_PERMISSIONS.cleaner).reduce((acc, key) => {
        acc[key as keyof RolePermissions] = createPermission(false);
        return acc;
      }, {} as RolePermissions);
    }
    return ROLE_PERMISSIONS[effectiveRole] || ROLE_PERMISSIONS.cleaner;
  };

  const hasPermission = (module: keyof RolePermissions, action: keyof ModulePermission): boolean => {
    const permissions = getPermissions();
    return permissions[module]?.[action] ?? false;
  };

  const canAccessModule = (module: keyof RolePermissions): boolean => hasPermission(module, 'canView');
  const effectiveRole = (): string | null => getEffectiveRole(userRoles, userRole, operationalMode);
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
