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
  users: ModulePermission;
  inventory: ModulePermission;
  logistics: ModulePermission;
  admin: ModulePermission;
};

const createPermission = (
  canView: boolean,
  canCreate: boolean = false,
  canEdit: boolean = false,
  canDelete: boolean = false,
): ModulePermission => ({ canView, canCreate, canEdit, canDelete });

const NO_PERMISSIONS = Object.keys({
  dashboard: true,
  calendar: true,
  tasks: true,
  workers: true,
  clients: true,
  properties: true,
  reports: true,
  hostaway: true,
  propertyGroups: true,
  users: true,
  inventory: true,
  logistics: true,
  admin: true,
}).reduce((permissions, key) => {
  permissions[key as keyof RolePermissions] = createPermission(false);
  return permissions;
}, {} as RolePermissions);

export const ROLE_PERMISSIONS: Record<string, RolePermissions> = {
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
    hostaway: createPermission(false),
    propertyGroups: createPermission(false),
    users: createPermission(false),
    inventory: createPermission(false),
    logistics: createPermission(true, true, true, true),
    admin: createPermission(false),
  },
};

export const getRolePermissions = (role: string | null | undefined): RolePermissions => (
  role ? ROLE_PERMISSIONS[role] ?? NO_PERMISSIONS : NO_PERMISSIONS
);

export const canRoleAccessModule = (
  role: string | null | undefined,
  module: keyof RolePermissions,
): boolean => getRolePermissions(role)[module]?.canView ?? false;
