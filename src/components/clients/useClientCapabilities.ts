import { useRolePermissions } from '@/hooks/useRolePermissions';
import { getClientCapabilities } from './clientRules';

/** Acciones disponibles en /clients según el rol efectivo (solo interfaz; la base de datos decide). */
export function useClientCapabilities() {
  const { hasPermission, isAdminOrManager } = useRolePermissions();
  return getClientCapabilities({
    canCreate: hasPermission('clients', 'canCreate'),
    canEdit: hasPermission('clients', 'canEdit'),
    canDelete: hasPermission('clients', 'canDelete'),
    // Solo administración tiene el módulo de administración.
    isAdmin: hasPermission('admin', 'canView'),
    isAdminOrManager: isAdminOrManager(),
  });
}
