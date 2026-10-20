import { createContext, useContext } from "react";
import type { Task } from "@/types/calendar";
import { DEFAULT_SCALE, type TimelineScale } from "./utils/timelineScale";

/**
 * What the current role may do from /calendar. Read from the role matrix
 * (calendar module): canEdit covers moving, resizing and (re)assigning;
 * canCreate covers new and duplicated tasks; canDelete covers deleting.
 * Hiding a button does not protect the database: server rules still apply.
 */
export interface CalendarPermissions {
  canCreate: boolean;
  canEdit: boolean;
  canDelete: boolean;
  /** Medical leave type and absence notes (admin/manager only, Dani 20/10/2026). */
  canSeeAbsenceDetails: boolean;
}

export const FULL_CALENDAR_PERMISSIONS: CalendarPermissions = { canCreate: true, canEdit: true, canDelete: true, canSeeAbsenceDetails: true };
export const READ_ONLY_CALENDAR_PERMISSIONS: CalendarPermissions = { canCreate: false, canEdit: false, canDelete: false, canSeeAbsenceDetails: false };

export interface CalendarActionsValue {
  permissions: CalendarPermissions;
  /** Warns (and lets the person cancel) before a quick schedule change is saved. */
  validateScheduleChange?: (task: Task, next: { date: string; startTime: string; endTime: string }) => Promise<boolean>;
  scale: TimelineScale;
}

// Components rendered without a provider (isolated tests) keep the previous
// behaviour; the calendar page always provides the real permissions.
const CalendarActionsContext = createContext<CalendarActionsValue>({
  permissions: FULL_CALENDAR_PERMISSIONS,
  scale: DEFAULT_SCALE,
});

export const CalendarActionsProvider = CalendarActionsContext.Provider;
export const useCalendarActions = () => useContext(CalendarActionsContext);
