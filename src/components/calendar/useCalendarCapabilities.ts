import { useMemo } from "react";
import { useRolePermissions } from "@/hooks/useRolePermissions";
import type { CalendarPermissions } from "./CalendarActionsContext";

/**
 * Calendar permissions of the session role, from the role matrix (calendar
 * module). Kept apart from the context so the grid components never pull in
 * the auth client.
 */
export const useCalendarPermissions = (): CalendarPermissions => {
  const { hasPermission, isAdminOrManager } = useRolePermissions();
  const canCreate = hasPermission('calendar', 'canCreate');
  const canEdit = hasPermission('calendar', 'canEdit');
  const canDelete = hasPermission('calendar', 'canDelete');
  const canSeeAbsenceDetails = isAdminOrManager();
  return useMemo(
    () => ({ canCreate, canEdit, canDelete, canSeeAbsenceDetails }),
    [canCreate, canEdit, canDelete, canSeeAbsenceDetails],
  );
};
