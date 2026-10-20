import { useMemo } from "react";
import { useRolePermissions } from "@/hooks/useRolePermissions";
import { canViewSensitiveWorkerData } from "@/lib/roleCapabilities";
import { getEffectiveRole } from "@/auth/operationalMode";
import type { CalendarPermissions } from "./CalendarActionsContext";

/**
 * Calendar permissions of the session role, from the role matrix (calendar
 * module). Kept apart from the context so the grid components never pull in
 * the auth client.
 */
export const useCalendarPermissions = (): CalendarPermissions => {
  const { hasPermission, userRole, userRoles, operationalMode } = useRolePermissions();
  const canCreate = hasPermission('calendar', 'canCreate');
  const canEdit = hasPermission('calendar', 'canEdit');
  const canDelete = hasPermission('calendar', 'canDelete');
  // Shared rule with Trabajadores: sensitive absence reason and notes for management only.
  const canSeeAbsenceDetails = canViewSensitiveWorkerData(getEffectiveRole(userRoles ?? [], userRole, operationalMode));
  return useMemo(
    () => ({ canCreate, canEdit, canDelete, canSeeAbsenceDetails }),
    [canCreate, canEdit, canDelete, canSeeAbsenceDetails],
  );
};
