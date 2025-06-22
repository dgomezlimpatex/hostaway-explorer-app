
import { useAuth } from './useAuth';

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
  hostaway: ModulePermission;
  propertyGroups: ModulePermission;
};

const createPermission = (canView: boolean, canCreate: boolean = false, canEdit: boolean = false, canDelete: boolean = false): ModulePermission => ({
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
    hostaway: createPermission(true, true, true, true),
    propertyGroups: createPermission(true, true, true, true),
  },
  manager: {
    dashboard: createPermission(true, true, true, true),
    calendar: createPermission(true, true, true, true),
    tasks: createPermission(true, true, true, true),
    workers: createPermission(true, true, true, true),
    clients: createPermission(true, true, true, true),
    properties: createPermission(true, true, true, true),
    reports: createPermission(true, true, true, true),
    hostaway: createPermission(true, true, true, true),
    propertyGroups: createPermission(true, true, true, true),
  },
  supervisor: {
    dashboard: createPermission(false),
    calendar: createPermission(true), // Solo lectura
    tasks: createPermission(true), // Solo lectura
    workers: createPermission(true), // Solo lectura
    clients: createPermission(false),
    properties: createPermission(false),
    reports: createPermission(false),
    hostaway: createPermission(false),
    propertyGroups: createPermission(false),
  },
  cleaner: {
    dashboard: createPermission(false),
    calendar: createPermission(true), // Solo su calendario personal
    tasks: createPermission(true), // Solo sus tareas
    workers: createPermission(false),
    clients: createPermission(false),
    properties: createPermission(false),
    reports: createPermission(false),
    hostaway: createPermission(false),
    propertyGroups: createPermission(false),
  },
};

export const useRolePermissions = () => {
  const { userRole } = useAuth();
  
  const getPermissions = (): RolePermissions => {
    if (!userRole) {
      // Sin rol, sin permisos
      return Object.keys(ROLE_PERMISSIONS.cleaner).reduce((acc, key) => {
        acc[key as keyof RolePermissions] = createPermission(false);
        return acc;
      }, {} as RolePermissions);
    }
    
    return ROLE_PERMISSIONS[userRole] || ROLE_PERMISSIONS.cleaner;
  };

  const hasPermission = (module: keyof RolePermissions, action: keyof ModulePermission): boolean => {
    const permissions = getPermissions();
    return permissions[module]?.[action] ?? false;
  };

  const canAccessModule = (module: keyof RolePermissions): boolean => {
    return hasPermission(module, 'canView');
  };

  const isAdminOrManager = (): boolean => {
    return userRole === 'admin' || userRole === 'manager';
  };

  const isSupervisor = (): boolean => {
    return userRole === 'supervisor';
  };

  const isCleaner = (): boolean => {
    return userRole === 'cleaner';
  };

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
