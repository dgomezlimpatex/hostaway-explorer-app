import { ABSENCE_TYPE_LABELS } from '@/types/workerAbsence';

/**
 * Dani (20/10/2026): supervision sees who is absent, but not medical leave
 * details. Roles without access to absence details see a medical leave as a
 * generic "Ausencia" and never its notes. This only changes what the calendar
 * shows; protecting the stored data needs server rules (pending backend work).
 */
export const MEDICAL_ABSENCE_TYPES = new Set(['sick']);
export const GENERIC_ABSENCE_TYPE = 'unspecified';
export const GENERIC_ABSENCE_LABEL = 'Ausencia';

/** Columns the calendar reads from worker_absences (never notes unless allowed). */
export const ABSENCE_COLUMNS = 'cleaner_id,absence_type,start_date,end_date,start_time,end_time,location_name' as const;
export const ABSENCE_COLUMNS_WITH_NOTES = 'cleaner_id,absence_type,start_date,end_date,start_time,end_time,location_name,notes' as const;

export const maskAbsenceType = (type: string, canSeeAbsenceDetails: boolean) =>
  !canSeeAbsenceDetails && MEDICAL_ABSENCE_TYPES.has(type) ? GENERIC_ABSENCE_TYPE : type;

export const getAbsenceLabel = (type: string | undefined | null) =>
  (type && ABSENCE_TYPE_LABELS[type as keyof typeof ABSENCE_TYPE_LABELS]) || GENERIC_ABSENCE_LABEL;
