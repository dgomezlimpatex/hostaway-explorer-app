import type { CleaningTurnoverInput, CleaningWindow } from '../../types/planningV2';

export const DEFAULT_TURNOVER_BUFFER_MINUTES = 30;

function parseDateTime(value: string | Date | null | undefined): Date | null {
  if (!value) return null;
  const date = value instanceof Date ? new Date(value.getTime()) : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function combineDateAndTime(date: string | undefined, time: string | undefined): Date | null {
  if (!date || !time) return null;
  return parseDateTime(`${date}T${time.length === 5 ? `${time}:00` : time}`);
}

function addMinutes(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * 60_000);
}

function differenceInWholeMinutes(start: Date, end: Date): number {
  return Math.floor((end.getTime() - start.getTime()) / 60_000);
}

export function buildCleaningWindow(
  input: CleaningTurnoverInput,
  bufferMinutes = DEFAULT_TURNOVER_BUFFER_MINUTES,
): CleaningWindow {
  const checkoutAt = parseDateTime(input.checkoutAt) ?? combineDateAndTime(input.fallbackDate, input.fallbackStartTime);
  const checkinAt = parseDateTime(input.checkinAt) ?? combineDateAndTime(input.fallbackDate, input.fallbackEndTime);
  const reasons: string[] = [];

  if (!checkoutAt) {
    return {
      taskId: input.taskId,
      propertyId: input.propertyId,
      startsAt: null,
      endsAt: checkinAt,
      durationMinutes: input.durationMinutes ?? null,
      availableMinutes: null,
      bufferMinutes,
      status: 'missing_checkout',
      reasons: ['Falta check-out o inicio de respaldo para abrir ventana de limpieza.'],
    };
  }

  if (!checkinAt) {
    return {
      taskId: input.taskId,
      propertyId: input.propertyId,
      startsAt: checkoutAt,
      endsAt: null,
      durationMinutes: input.durationMinutes ?? null,
      availableMinutes: null,
      bufferMinutes,
      status: 'missing_checkin',
      reasons: ['Falta check-in o fin de respaldo para cerrar ventana de limpieza.'],
    };
  }

  const startsAt = addMinutes(checkoutAt, bufferMinutes);
  const endsAt = addMinutes(checkinAt, -bufferMinutes);
  const availableMinutes = differenceInWholeMinutes(startsAt, endsAt);

  reasons.push(`Buffer fijo de ${bufferMinutes} min aplicado después del check-out y antes del check-in.`);

  if (endsAt <= startsAt) {
    return {
      taskId: input.taskId,
      propertyId: input.propertyId,
      startsAt,
      endsAt,
      durationMinutes: input.durationMinutes ?? null,
      availableMinutes,
      bufferMinutes,
      status: 'invalid',
      reasons: [...reasons, 'La ventana resultante no tiene tiempo positivo.'],
    };
  }

  if (input.durationMinutes != null && input.durationMinutes > availableMinutes) {
    return {
      taskId: input.taskId,
      propertyId: input.propertyId,
      startsAt,
      endsAt,
      durationMinutes: input.durationMinutes,
      availableMinutes,
      bufferMinutes,
      status: 'insufficient_time',
      reasons: [...reasons, `Duración requerida (${input.durationMinutes} min) supera la ventana (${availableMinutes} min).`],
    };
  }

  return {
    taskId: input.taskId,
    propertyId: input.propertyId,
    startsAt,
    endsAt,
    durationMinutes: input.durationMinutes ?? null,
    availableMinutes,
    bufferMinutes,
    status: 'ready',
    reasons,
  };
}

export function canFitCleaningInWindow(window: CleaningWindow, durationMinutes: number): boolean {
  return window.status === 'ready' && window.availableMinutes != null && durationMinutes <= window.availableMinutes;
}
