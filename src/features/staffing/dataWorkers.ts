import type { StaffingRow } from './data';
import type { StaffingIssue, StaffingWorker } from './types';
import { datePlus, timeMinutes, validDate } from './dataUtils';

export interface WorkerInputs {
  /** Explicit sede rule; mobility is not inferred from missing exclusions. */
  allowCrossCenterMobility?: boolean;
  workers: StaffingRow[]; availability: StaffingRow[]; rests: StaffingRow[]; staffing: StaffingRow[];
  absences: StaffingRow[]; maintenance: StaffingRow[]; maintenanceTypes: StaffingRow[];
  planning: StaffingRow[]; groupIds: string[];
  from: string; to: string; issues: StaffingIssue[];
}
const text = (value: unknown) => typeof value === 'string' ? value : '';
const number = (value: unknown) => value == null || value === '' ? NaN : Number(value);
const weekday = (value: unknown) => Number.isInteger(number(value)) && number(value) >= 0 && number(value) <= 6;

/** Input rows have already been scoped by parent ids. Overlaps remain intervals for the engine's union, never summed here.
 * Capacity comes ONLY from ficha or contract hours (rule confirmed by Dani: recorded
 * availability never generates capacity). Availability still shapes blocks/engines.
 */
export function mapStaffingWorkers(input: WorkerInputs): StaffingWorker[] {
  const { issues, from, to } = input;
  const kept: StaffingWorker[] = [];
  const excludedZeroHour: string[] = [];
  for (const row of input.workers) {
    if (row.is_active !== true) continue;
    const id = text(row.id);
    const workerIssues: StaffingIssue[] = [];
    const blockedSlots: NonNullable<StaffingWorker['blockedSlots']> = [];
    const slots = input.availability.filter(item => item.cleaner_id === id);
    const rests = input.rests.filter(item => item.cleaner_id === id && item.is_active === true && weekday(item.day_of_week));
    const declaredRestDays = [...new Set(rests.map(item => number(item.day_of_week)))].sort();
    // Libranza en los siete días junto a horas en ficha: dato contradictorio.
    // Se conserva la persona y se avisa, pero no se anula su semana entera.
    const restCoverWholeWeek = declaredRestDays.length >= 7;
    const restDays = restCoverWholeWeek ? [] : declaredRestDays;
    if (restCoverWholeWeek) workerIssues.push({ code: 'rest-every-day', message: `${text(row.name)}: libranza registrada en los 7 días con horas en ficha; dato contradictorio, se ignoran las libranzas para no anular su capacidad. Revisa su ficha.` });
    for (const day of restDays) blockedSlots.push({ day, startMinute: 0, endMinute: 1440, consumesContract: false });
    const availability: StaffingWorker['availability'] = [];
    for (const slot of slots) {
      const day = number(slot.day_of_week);
      const startMinute = timeMinutes(slot.start_time); const endMinute = timeMinutes(slot.end_time);
      if (!weekday(day)) { workerIssues.push({ code: 'invalid-availability', message: 'Disponibilidad con día inválido; capacidad incompleta.' }); continue; }
      if (slot.is_available === false) {
        blockedSlots.push({ day, startMinute: Number.isFinite(startMinute) && endMinute > startMinute ? startMinute : 0, endMinute: Number.isFinite(startMinute) && endMinute > startMinute ? endMinute : 1440, consumesContract: false });
      } else if (slot.is_available === true && Number.isFinite(startMinute) && endMinute > startMinute) availability.push({ day, startMinute, endMinute });
      else workerIssues.push({ code: 'invalid-availability', message: 'Disponibilidad sin intervalo válido; no se infiere jornada completa.' });
    }
    if (slots.length < 7) workerIssues.push({ code: 'availability-incomplete', message: 'Faltan días de disponibilidad explícita; ausencia de fila no implica jornada disponible.' });
    if (!declaredRestDays.length) workerIssues.push({ code: 'missing-rest', message: 'Libranza semanal no confirmada; no se infiere modalidad flexible.' });
    const unavailableDates = new Set<string>(); const confirmedRestDates = new Set<string>();
    for (const absence of input.absences.filter(item => item.cleaner_id === id)) {
      const start = text(absence.start_date); const end = text(absence.end_date);
      if (!validDate(start) || !validDate(end) || end < start) { workerIssues.push({ code: 'invalid-absence', message: 'Ausencia con fechas inválidas; capacidad incompleta.' }); continue; }
      const fullDay = absence.start_time == null && absence.end_time == null;
      const startMinute = timeMinutes(absence.start_time); const endMinute = timeMinutes(absence.end_time);
      const valid = Number.isFinite(startMinute) && endMinute > startMinute;
      if (!fullDay && !valid) workerIssues.push({ code: 'invalid-absence', message: 'Ausencia parcial inválida: se bloquea el día como hipótesis prudente.' });
      for (let date = start < from ? from : start; date <= end && date <= to; date = datePlus(date, 1)) {
        if (fullDay && absence.absence_type === 'day_off') confirmedRestDates.add(date);
        else if ((fullDay || !valid) && absence.absence_type !== 'external_work') unavailableDates.add(date);
        else blockedSlots.push({ date, startMinute: fullDay || !valid ? 0 : startMinute, endMinute: fullDay || !valid ? 1440 : endMinute, consumesContract: absence.absence_type === 'external_work' });
      }
    }
    const maintenanceTypes = new Map(input.maintenanceTypes.map(item => [text(item.id), item.schedule_type]));
    for (const item of input.maintenance.filter(item => item.cleaner_id === id && item.is_active === true)) {
      const type = maintenanceTypes.get(text(item.id));
      if (type !== 'maintenance' && type !== 'unavailability') workerIssues.push({ code: 'maintenance-type-assumption', message: 'Compromiso semanal sin schedule_type: bloqueado como hipótesis prudente.' });
      const startMinute = timeMinutes(item.start_time); const endMinute = timeMinutes(item.end_time);
      const valid = Number.isFinite(startMinute) && endMinute > startMinute;
      if (!valid) workerIssues.push({ code: 'invalid-maintenance', message: 'Compromiso semanal con horas inválidas: día bloqueado como hipótesis prudente.' });
      for (const day of Array.isArray(item.days_of_week) ? item.days_of_week : []) {
        if (!weekday(day)) { workerIssues.push({ code: 'invalid-maintenance', message: 'Compromiso semanal con día inválido.' }); continue; }
        blockedSlots.push({ day: number(day), startMinute: valid ? startMinute : 0, endMinute: valid ? endMinute : 1440, consumesContract: type !== 'unavailability' });
      }
    }
    const assignments = input.staffing.filter(item => item.cleaner_id === id && input.groupIds.includes(text(item.property_group_id)));
    const excludedCenterIds = [...new Set(assignments.filter(item => item.is_active === false || number(item.priority) >= 90).map(item => text(item.property_group_id)))];
    // propertyStaffingService: <20 primary, <30 secondary, <90 backup (mobile support).
    const homeCenterIds = [...new Set(assignments.filter(item => item.is_active === true && number(item.priority) < 30 && !excludedCenterIds.includes(text(item.property_group_id))).map(item => text(item.property_group_id)))];
    const fichaHours = number(row.contract_hours_per_week);
    // Los contratos laborales son una herencia en desuso (Dani 17/09/2026): la única
    // fuente de horas es la FICHA (cleaners.contract_hours_per_week), la que ve dirección.
    const maxDaily = number(input.planning.find(item => item.id === id)?.planning_max_daily_minutes);
    // Regla confirmada por Dani: la disponibilidad registrada ya NO genera capacidad
    // y los contratos legacy no aportan horas. Solo cuenta la ficha; quien se queda
    // con 0 h (o sin dato válido) no cuenta en la previsión, da igual que tenga
    // tareas asignadas o disponibilidad: "como si no existiera". Su trabajo sí
    // sigue contando como carga.
    const weeklyMinutes = fichaHours * 60;
    if (!(Number.isFinite(weeklyMinutes) && weeklyMinutes > 0)) {
      excludedZeroHour.push(text(row.name));
      continue;
    }
    issues.push(...workerIssues);
    kept.push({ id, name: text(row.name), engagement: 'employee', weeklyMinutes,
      homeCenterIds, excludedCenterIds, availability, restDay: restDays[0] ?? null, flexibleRest: false, canMove: input.allowCrossCenterMobility === true,
      unavailableDates: [...unavailableDates].sort(), confirmedRestDates: [...confirmedRestDates].sort(), blockedSlots,
      activeFrom: text(row.start_date) || undefined, maxDailyMinutes: Number.isFinite(maxDaily) && maxDaily >= 0 ? maxDaily : undefined });
  }
  if (excludedZeroHour.length) issues.push({ code: 'zero-hour-rule-excluded', message: `Fuera de la previsión por tener 0 h en su ficha: ${excludedZeroHour.join(', ')}. No cuentan como capacidad ni como candidatas aunque tengan disponibilidad o tareas asignadas; su trabajo sí sigue como carga.` });
  return kept;
}
