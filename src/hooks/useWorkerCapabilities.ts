import { useAuth } from './useAuth';
import { getEffectiveRole } from '@/auth/operationalMode';
import {
  canEditOperational,
  canManageWorkerAccounts,
  canViewSensitiveWorkerData,
  canViewWorkerHours,
} from '@/lib/roleCapabilities';

/** Capacidades del rol efectivo (incluido el modo operativo) en Trabajadores. */
export const useWorkerCapabilities = () => {
  const { userRole, userRoles, operationalMode } = useAuth();
  const role = getEffectiveRole(userRoles ?? [], userRole, operationalMode);
  return {
    role,
    canEdit: canEditOperational(role, 'workers'),
    canManageAccounts: canManageWorkerAccounts(role),
    canViewSensitive: canViewSensitiveWorkerData(role),
    canViewHours: canViewWorkerHours(role),
  };
};
