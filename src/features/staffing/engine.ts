import type { StaffingDataset, StaffingOptions, StaffingResult, StaffingDay, StaffingWorker, StaffingAssignment, StaffingService } from './types';
// Date keys describe Madrid civil days; UTC arithmetic never traverses DST hours.
function validDate(value: string): boolean {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value))
        return false;
    const time = new Date(`${value}T00:00:00Z`).getTime();
    return Number.isFinite(time) && new Date(time).toISOString().slice(0, 10) === value;
}
function dateKey(value: string): string {
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
        if (!validDate(value))
            throw new RangeError('Fecha civil inválida.');
        return value;
    }
    return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Madrid', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(value));
}
function addDays(date: string, count: number): string {
    const d = new Date(`${date}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() + count);
    return d.toISOString().slice(0, 10);
}
function weekday(date: string): number { return new Date(`${date}T00:00:00Z`).getUTCDay(); }
function weekKey(date: string): string { return addDays(date, -((weekday(date) + 6) % 7)); }
function validWindow(slot: {
    startMinute: number;
    endMinute: number;
}): boolean {
    return Number.isFinite(slot.startMinute) && Number.isFinite(slot.endMinute)
        && slot.startMinute >= 0 && slot.endMinute <= 1440 && slot.startMinute < slot.endMinute;
}
function validWeekday(day: number | null | undefined): boolean {
    return day !== null && day !== undefined && Number.isInteger(day) && day >= 0 && day <= 6;
}
function validWorker(w: StaffingWorker): boolean {
    return (w.maxDailyMinutes === undefined || Number.isFinite(w.maxDailyMinutes) && w.maxDailyMinutes >= 0)
        && (!w.activeFrom || validDate(w.activeFrom))
        && (!w.activeTo || validDate(w.activeTo))
        && (!w.activeFrom || !w.activeTo || w.activeFrom <= w.activeTo)
        && [...w.unavailableDates, ...w.confirmedRestDates].every(validDate)
        && (w.blockedSlots ?? []).every(b => (b.date ? validDate(b.date) : validWeekday(b.day)) && validWindow(b))
        && w.availability.length > 0
        && w.availability.every(a => validWeekday(a.day) && validWindow(a))
        // A missing fixed rest row is incomplete planning data, not zero capacity.
        // Assignment still enforces the six-day continuity limit below.
        && Number.isFinite(w.weeklyMinutes) && w.weeklyMinutes >= 0;
}
function active(worker: StaffingWorker, date: string): boolean {
    return (!worker.activeFrom || date >= worker.activeFrom) && (!worker.activeTo || date <= worker.activeTo);
}
function unionMinutes(slots: {
    startMinute: number;
    endMinute: number;
}[]): number {
    let end = 0;
    let total = 0;
    for (const slot of [...slots].sort((a, b) => a.startMinute - b.startMinute)) {
        total += Math.max(0, slot.endMinute - Math.max(end, slot.startMinute));
        end = Math.max(end, slot.endMinute);
    }
    return total;
}

function resting(worker: StaffingWorker, date: string): boolean {
    return worker.confirmedRestDates.includes(date) || (!worker.flexibleRest && worker.restDay === weekday(date));
}
function duplicateIds(rows: { id: string }[]): Set<string> {
    const seen = new Set<string>();
    const duplicates = new Set<string>();
    for (const row of rows) {
        if (seen.has(row.id)) duplicates.add(row.id);
        seen.add(row.id);
    }
    return duplicates;
}
function groupBy<T>(rows: T[], key: (row: T) => string): Map<string, T[]> {
    const groups = new Map<string, T[]>();
    for (const row of rows) {
        const k = key(row);
        const group = groups.get(k);
        if (group) group.push(row);
        else groups.set(k, [row]);
    }
    return groups;
}
export function buildStaffingForecast(dataset: StaffingDataset, options: StaffingOptions): StaffingResult {
    const deadline = performance.now() + 200;
    if (!Number.isInteger(options.weeks) || options.weeks <= 0 || options.weeks > 28 || ![options.travelMinutes, options.lateReservePercent, options.seasonalPercent].every(n => Number.isFinite(n) && n >= 0))
        throw new RangeError('Horizonte de 1 a 28 semanas enteras; traslado y porcentajes finitos y no negativos.');
    // Bound allocation and input validation too, not just the scheduling search.
    if (dataset.workers.length > 100 || dataset.centers.length > 100 || dataset.services.length > 10000 || dataset.issues.length > 10000
        || dataset.workers.some(w => [w.availability, w.blockedSlots ?? [], w.homeCenterIds, w.excludedCenterIds ?? [], w.unavailableDates, w.confirmedRestDates].some(rows => rows.length > 512)))
        return incompleteForecast();
    const exhausted = Symbol('staffing-work-budget');
    const checkpoint = () => { if (performance.now() >= deadline) throw exhausted; };
    try {
        checkpoint();
        const result = computeStaffingForecast(dataset, options, checkpoint);
        checkpoint();
        return result;
    } catch (error) {
        if (error !== exhausted) throw error;
        // Never let a truncated search masquerade as a complete forecast.
        return incompleteForecast();
    }
}
function computeStaffingForecast(dataset: StaffingDataset, options: StaffingOptions, checkpoint: () => void): StaffingResult {
    const start = dateKey(options.dateFrom);
    const days: StaffingDay[] = Array.from({ length: options.weeks * 7 }, (_, index) => ({ date: addDays(start, index), knownMinutes: 0, estimatedMinutes: 0, capacityMinutes: 0, uncoveredMinutes: 0, assignments: [], reasons: [], rests: [] }));
    const dayByDate = new Map(days.map(d => [d.date, d]));
    const calendar = new Map<string, { week: string; day: number; previous: string[]; next: string[] }>();
    const dateInfo = (date: string) => {
        let info = calendar.get(date);
        if (!info) {
            checkpoint();
            info = { week: weekKey(date), day: weekday(date), previous: Array.from({ length: 6 }, (_, i) => addDays(date, -i - 1)), next: Array.from({ length: 6 }, (_, i) => addDays(date, i + 1)) };
            calendar.set(date, info);
        }
        return info;
    };
    const daysByWeek = groupBy(days, d => dateInfo(d.date).week);
    const calendarWeeks = new Map([...daysByWeek.keys()].map(week => [week, Array.from({ length: 7 }, (_, i) => addDays(week, i))]));
    const issues = dataset.issues.map(i => ({ ...i }));
    issues.push({ code: 'boundary-history', message: 'Sin historial de asignaciones anterior al rango: continuidad verificada dentro de la propuesta y bloqueos conocidos, no jornadas previas desconocidas. Semanas parciales muestran el total semanal completo, no prorrateado.' });
    const unknownCenters = new Set(dataset.centers.filter(c => dataset.issues.some(i => !i.centerId || i.centerId === c.id)).map(c => c.id));
    const duplicateWorkers = duplicateIds(dataset.workers);
    const duplicateCenters = duplicateIds(dataset.centers);
    const duplicateServices = duplicateIds(dataset.services);
    for (const id of duplicateWorkers) {
        issues.push({ code: 'duplicate-worker', message: `${id}: identidad repetida; todas sus filas excluidas de asignación y coste, sin fusionar restricciones.` });
        dataset.centers.forEach(c => unknownCenters.add(c.id));
    }
    for (const id of duplicateCenters) {
        unknownCenters.add(id);
        issues.push({ code: 'duplicate-center', centerId: id, message: `${id}: identidad repetida; ventanas excluidas, sin elegir una fila arbitraria.` });
    }
    for (const s of dataset.services.filter(s => duplicateServices.has(s.id))) {
        checkpoint();
        unknownCenters.add(s.centerId);
        issues.push({ code: 'duplicate-service', centerId: s.centerId, message: `${s.id}: identidad repetida; demanda excluida e incierta, sin sumar filas ni elegir duración.` });
    }
    const uniqueWorkers = dataset.workers.filter(w => !duplicateWorkers.has(w.id));
    const centerRows = [...new Map(dataset.centers.map(c => [c.id, c])).values()];
    const validCenters = centerRows.filter(c => !duplicateCenters.has(c.id) && validWindow(c));
    const centerById = new Map(validCenters.map(c => [c.id, c]));
    const workers = [...uniqueWorkers].sort((a, b) => a.id.localeCompare(b.id)).filter(w => {
        checkpoint();
        const valid = validWorker(w);
        if (!valid) {
            issues.push({ code: 'incomplete-worker', message: `${w.id}: faltan disponibilidad, libranza u horas válidas; capacidad excluida.` });
            dataset.centers.forEach(c => unknownCenters.add(c.id));
        }
        if (w.blockedSlots?.some(b => b.consumesContract)) {
            issues.push({ code: 'maintenance-unreconciled', message: `${w.id}: mantenimiento descontado; no hay vínculo directo con las tareas para descartar duplicados. Revisar antes de decidir refuerzos.` });
        }
        return valid && w.id !== options.absenceWorkerId;
    });
    const knownServices = dataset.services.filter(s => !duplicateServices.has(s.id)).filter(s => {
        checkpoint();
        if (validDate(s.date))
            return true;
        unknownCenters.add(s.centerId);
        issues.push({ code: 'invalid-service-date', centerId: s.centerId, message: `${s.id}: fecha civil inválida; servicio excluido del calendario, demanda incierta.` });
        return false;
    }).map(s => {
        checkpoint();
        const center = centerById.get(s.centerId);
        const windowValid = validWindow(s) && !!center && validWindow(center);
        return { ...s, startMinute: windowValid ? Math.max(s.startMinute, center.startMinute) : NaN, endMinute: windowValid ? Math.min(s.endMinute, center.endMinute) : NaN, personMinutes: Number.isFinite(s.personMinutes) && s.personMinutes > 0 ? s.personMinutes : 0 };
    });
    const asOf = dateKey(options.asOf);
    const nearEnd = addDays(asOf, 7);
    const knownByDate = groupBy(knownServices, s => s.date);
    const estimatedServices: StaffingService[] = [];
    const reserveGroups = new Map<string, StaffingService[]>();
    for (const s of knownServices.filter(s => s.kind === 'checkout' && s.date >= asOf && s.date <= nearEnd && options.lateReservePercent > 0)) {
        const key = JSON.stringify([s.date, s.centerId]);
        if (reserveGroups.has(key)) reserveGroups.get(key)!.push(s);
        else reserveGroups.set(key, [s]);
    }
    for (const group of reserveGroups.values()) {
        checkpoint();
        const reconstructible = group.every(s => !!s.receivedDate && /^\d{4}-\d{2}-\d{2}$/.test(s.receivedDate));
        const baseline = reconstructible ? group.filter(s => s.receivedDate! <= addDays(s.date, -7)) : group;
        const additions = reconstructible ? group.length - baseline.length : 0;
        const remaining = Math.max(0, baseline.length * options.lateReservePercent / 100 - additions);
        issues.push({ code: reconstructible ? 'reserve-baseline' : 'provisional-reserve', centerId: group[0].centerId, message: reconstructible ? `${group[0].date}: referencia D-7 reconstruida con fechas de recepción; ${additions} altas consumen margen. No reconstruye cancelaciones ni cambios históricos; hipótesis no calibrada.` : `${group[0].date}: reserva provisional sobre demanda actual, sin instantánea D-7; no calibrada.` });
        if (!baseline.length) {
            unknownCenters.add(group[0].centerId);
            issues.push({ code: 'empty-baseline', centerId: group[0].centerId, message: 'Base D-7 vacía: el porcentaje no permite dimensionar nuevas reservas.' });
        }
        if (remaining > 0)
            for (const s of baseline) {
                checkpoint();
                estimatedServices.push({ ...s, id: `estimated:late:${s.id}`, personMinutes: s.personMinutes * remaining / baseline.length });
            }
    }
    if (options.seasonalPercent > 0) {
        for (const s of knownServices.filter(s => s.date > nearEnd && s.kind !== 'fixed')) {
            checkpoint();
            estimatedServices.push({ ...s, id: `estimated:seasonal:${s.id}`, personMinutes: s.personMinutes * options.seasonalPercent / 100 });
        }
        issues.push({ code: 'seasonal-scenario', message: `Escenario lejano adicional +${options.seasonalPercent} % sobre servicios variables; no estacionalidad aprendida. Base cero sigue incierta. Minutos esperados agregados, sin prueba de encaje de servicios enteros.` });
    }
    const proposedRest = new Map<string, Set<string>>();
    for (const w of workers.filter(w => w.flexibleRest)) {
        const rests = new Set<string>();
        for (const weekDates of calendarWeeks.values()) {
            checkpoint();
            const dates = weekDates.filter(d => active(w, d));
            if (dates.some(d => w.confirmedRestDates.includes(d)))
                continue;
            const load = new Map(dates.map(date => [date, w.unavailableDates.includes(date) ? -1 : (knownByDate.get(date) ?? []).filter(s => w.canMove || w.homeCenterIds.includes(s.centerId)).reduce((n, s) => n + s.personMinutes, 0)]));
            dates.sort((a, b) => load.get(a)! - load.get(b)! || a.localeCompare(b));
            if (dates[0])
                rests.add(dates[0]);
        }
        proposedRest.set(w.id, rests);
    }
    const isRest = (w: StaffingWorker, date: string) => resting(w, date) || !!proposedRest.get(w.id)?.has(date);
    type WorkerDay = { blocks: NonNullable<StaffingWorker['blockedSlots']>; paid: number; availability: StaffingWorker['availability']; available: boolean; route: StaffingAssignment[]; routePaid: number };
    const workerDays = new Map(workers.map(w => [w.id, new Map<string, WorkerDay>()]));
    const state = (w: StaffingWorker, date: string): WorkerDay => {
        const cache = workerDays.get(w.id)!;
        let value = cache.get(date);
        if (!value) {
            checkpoint();
            const day = dateInfo(date).day;
            const blocked = (w.blockedSlots ?? []).filter(b => b.date ? b.date === date : b.day === day);
            value = { blocks: blocked, paid: active(w, date) ? unionMinutes(blocked.filter(b => b.consumesContract)) : 0, availability: w.availability.filter(a => a.day === day), available: active(w, date) && !isRest(w, date) && !w.unavailableDates.includes(date), route: [], routePaid: 0 };
            cache.set(date, value);
        }
        return value;
    };
    const weekBudgets = new Map(workers.map(w => [w.id, new Map([...calendarWeeks].map(([week, dates]) => [week, dates.reduce((n, date) => n + state(w, date).paid, 0)]))]));
    const routeMinutes = (assignments: StaffingAssignment[]) => {
        const sorted = [...assignments].sort((a, b) => a.startMinute - b.startMinute);
        return sorted.reduce((n, a, i) => n + a.personMinutes + (i && sorted[i - 1].centerId !== a.centerId ? options.travelMinutes : 0), 0);
    };
    const travelFits = (w: StaffingWorker, date: string, route: StaffingAssignment[]) => {
        const current = state(w, date);
        const sorted = [...route].sort((a, b) => a.startMinute - b.startMinute);
        return sorted.every((next, i) => {
            if (!i || sorted[i - 1].centerId === next.centerId || options.travelMinutes === 0)
                return true;
            const earliest = sorted[i - 1].endMinute;
            const candidates = [earliest, ...current.availability.map(a => Math.max(earliest, a.startMinute)), ...current.blocks.map(b => Math.max(earliest, b.endMinute))];
            return candidates.some(start => {
                checkpoint();
                const end = start + options.travelMinutes;
                return end <= next.startMinute && current.availability.some(a => a.startMinute <= start && a.endMinute >= end) && !current.blocks.some(b => b.startMinute < end && b.endMinute > start);
            });
        });
    };
    const paidWeek = (w: StaffingWorker, date: string) => weekBudgets.get(w.id)!.get(dateInfo(date).week)!;
    const consecutiveAllowed = (w: StaffingWorker, date: string) => {
        let count = 1;
        for (const adjacentDates of [dateInfo(date).previous, dateInfo(date).next]) {
            for (const adjacent of adjacentDates) {
                const adjacentState = state(w, adjacent);
                if (!adjacentState.paid && !adjacentState.route.length)
                    break;
                count++;
            }
        }
        return count <= 6;
    };
    const eligibleWorkers = new Map(knownServices.filter(s => dayByDate.has(s.date)).map(s => {
        checkpoint();
        return [s.id, workers.filter(w => state(w, s.date).available && !w.excludedCenterIds?.includes(s.centerId) && (w.canMove || w.homeCenterIds.includes(s.centerId)) && state(w, s.date).availability.some(a => Math.min(a.endMinute, s.endMinute) - Math.max(a.startMinute, s.startMinute) >= s.personMinutes / s.requiredWorkers))];
    }));
    const eligibleCount = (s: StaffingService) => (eligibleWorkers.get(s.id)?.length ?? 0) - s.requiredWorkers;
    const estimatedByDate = groupBy(estimatedServices, s => s.date);
    for (const estimated of [false, true])
        for (const day of days) {
            checkpoint();
            day.rests = workers.filter(w => active(w, day.date) && isRest(w, day.date)).map(w => ({ workerId: w.id, proposed: !resting(w, day.date) }));
            for (const service of [...((estimated ? estimatedByDate : knownByDate).get(day.date) ?? [])].sort((a, b) => (estimated ? 0 : eligibleCount(a) - eligibleCount(b)) || (a.endMinute - a.startMinute - a.personMinutes / a.requiredWorkers) - (b.endMinute - b.startMinute - b.personMinutes / b.requiredWorkers) || a.startMinute - b.startMinute || a.id.localeCompare(b.id))) {
                checkpoint();
                if (estimated) {
                    day.estimatedMinutes += service.personMinutes;
                    // Expected effort is not a schedulable fractional service. Never use it as coverage evidence.
                    day.uncoveredMinutes += service.personMinutes;
                    day.reasons.push(`${service.id}: demanda esperada agregada; cobertura de servicios enteros no verificada.`);
                    continue;
                } else
                    day.knownMinutes += service.personMinutes;
                const duration = service.personMinutes / service.requiredWorkers;
                if (!Number.isInteger(service.requiredWorkers) || service.requiredWorkers < 1 || !Number.isFinite(duration) || duration <= 0 || !Number.isFinite(service.startMinute) || !Number.isFinite(service.endMinute) || service.startMinute < 0 || service.endMinute > 1440 || service.startMinute + duration > service.endMinute) {
                    unknownCenters.add(service.centerId);
                    issues.push({ code: 'invalid-service', centerId: service.centerId, message: `${service.id}: duración o ventana incompleta/inválida.` });
                    day.uncoveredMinutes += service.personMinutes;
                    continue;
                }
                let best: StaffingAssignment[] = [];
                const eligible = eligibleWorkers.get(service.id) ?? [];
                const starts = new Set([service.startMinute]);
                for (const w of eligible) {
                    checkpoint();
                    const current = state(w, day.date);
                    current.blocks.forEach(b => starts.add(Math.max(service.startMinute, b.endMinute)));
                    current.availability.forEach(a => starts.add(Math.max(service.startMinute, a.startMinute)));
                    current.route.forEach(a => starts.add(Math.max(service.startMinute, a.endMinute + (a.centerId === service.centerId ? 0 : options.travelMinutes))));
                }
                for (const startMinute of [...starts].sort((a, b) => a - b)) {
                    checkpoint();
                    const endMinute = startMinute + duration;
                    if (endMinute > service.endMinute)
                        continue;
                    const assignment = (w: StaffingWorker): StaffingAssignment => ({ serviceId: service.id, workerId: w.id, centerId: service.centerId, date: day.date, startMinute, endMinute, personMinutes: duration, support: !w.homeCenterIds.includes(service.centerId), estimated });
                    const team = eligible.filter(w => {
                        checkpoint();
                        const current = state(w, day.date);
                        if (current.blocks.some(b => b.startMinute < endMinute && b.endMinute > startMinute))
                            return false;
                        if (!consecutiveAllowed(w, day.date))
                            return false;
                        if (!current.availability.some(a => a.startMinute <= startMinute && a.endMinute >= endMinute))
                            return false;
                        const route = current.route;
                        if (route.some(a => a.startMinute < endMinute + (a.centerId === service.centerId ? 0 : options.travelMinutes) && a.endMinute + (a.centerId === service.centerId ? 0 : options.travelMinutes) > startMinute))
                            return false;
                        if (!travelFits(w, day.date, [...route, assignment(w)]))
                            return false;
                        const nextPaid = routeMinutes([...route, assignment(w)]);
                        if (w.maxDailyMinutes !== undefined && current.paid + nextPaid > w.maxDailyMinutes)
                            return false;
                        return paidWeek(w, day.date) + nextPaid - current.routePaid <= w.weeklyMinutes;
                    }).sort((a, b) => Number(b.homeCenterIds.includes(service.centerId)) - Number(a.homeCenterIds.includes(service.centerId)) || a.id.localeCompare(b.id)).slice(0, service.requiredWorkers);
                    if (team.length !== service.requiredWorkers)
                        continue;
                    const candidate = team.map(assignment);
                    if (!best.length || candidate.filter(a => a.support).length < best.filter(a => a.support).length)
                        best = candidate;
                    if (best.every(a => !a.support))
                        break;
                }
                day.assignments.push(...best);
                for (const a of best) {
                    const current = workerDays.get(a.workerId)!.get(day.date)!;
                    current.route.push(a);
                    const nextPaid = routeMinutes(current.route);
                    const budget = weekBudgets.get(a.workerId)!;
                    const week = dateInfo(day.date).week;
                    budget.set(week, budget.get(week)! + nextPaid - current.routePaid);
                    current.routePaid = nextPaid;
                }
                if (!best.length) {
                    day.uncoveredMinutes += service.personMinutes;
                    day.reasons.push(`${service.id}: sin hueco compatible (ventana, traslado, disponibilidad, presupuesto semanal o límite de seis días); búsqueda heurística, no prueba de imposibilidad.`);
                }
            }
        }
    if (days.some(d => d.estimatedMinutes > 0))
        issues.push({ code: 'estimated-coverage-unverified', message: 'Los minutos adicionales son una expectativa agregada, no trabajos fraccionarios asignables. Su cobertura no está verificada; sin encaje incluye esta demanda pendiente de evaluar, no un déficit demostrado.' });
    if (!days.some(d => d.knownMinutes))
        issues.push({ code: 'empty-demand', message: 'Sin demanda conocida: no se puede afirmar cobertura.' });
    // This is a window/budget upper bound, not a second coverage proof. Only assignments prove a slot.
    const centersByWorker = new Map(workers.map(w => [w.id, validCenters.filter(c => !w.excludedCenterIds?.includes(c.id) && (w.canMove || w.homeCenterIds.includes(c.id)))]));
    const potential = (w: StaffingWorker, day: StaffingDay): number => {
        checkpoint();
        const current = state(w, day.date);
        if (!current.available || !consecutiveAllowed(w, day.date))
            return 0;
        const centers = centersByWorker.get(w.id)!;
        const windows = current.availability.flatMap(a => {
            checkpoint();
            return centers.map(c => ({ startMinute: Math.max(a.startMinute, c.startMinute), endMinute: Math.min(a.endMinute, c.endMinute) })).filter(s => s.endMinute > s.startMinute);
        });
        const blocked = current.blocks;
        const free = unionMinutes([...windows, ...blocked]) - unionMinutes(blocked);
        return Math.max(0, Math.min(free, (w.maxDailyMinutes ?? 1440) - current.paid));
    };
    const weeks = [...daysByWeek].map(([week, matching]) => {
        const activeWorkers = workers.filter(w => matching.some(d => active(w, d.date)));
        let collaboratorCapacityMinutes = 0;
        for (const w of activeWorkers) {
            const assigned = matching.map(d => state(w, d.date).route.reduce((n, a) => n + a.personMinutes, 0));
            const cleaning = assigned.reduce((n, m) => n + m, 0);
            const paid = paidWeek(w, matching[0].date);
            const raw = matching.map(d => potential(w, d));
            const capacity = Math.max(cleaning, Math.min(raw.reduce((n, m) => n + m, 0), w.weeklyMinutes - paid + cleaning));
            if (w.engagement === 'collaborator') collaboratorCapacityMinutes += capacity;
            const spare = raw.map((m, i) => Math.max(0, m - assigned[i]));
            const totalSpare = spare.reduce((n, m) => n + m, 0);
            matching.forEach((d, i) => { d.capacityMinutes += assigned[i] + (totalSpare ? (capacity - cleaning) * spare[i] / totalSpare : 0); });
        }
        const capacityMinutes = Math.round(matching.reduce((n, d) => n + d.capacityMinutes, 0) * 1e6) / 1e6;
        const cleaningMinutes = matching.flatMap(d => d.assignments).reduce((n, a) => n + a.personMinutes, 0);
        const contractedWorkers = uniqueWorkers.filter(w => w.engagement !== 'collaborator' && Number.isFinite(w.weeklyMinutes) && w.weeklyMinutes >= 0 && matching.some(d => active(w, d.date)));
        const contractedMinutes = contractedWorkers.reduce((n, w) => n + w.weeklyMinutes, 0);
        // costPerHour is an employee payroll input, never a collaborator service quote.
        const collaboratorWork = activeWorkers.some(w => w.engagement === 'collaborator' && matching.some(d => state(w, d.date).route.length > 0 || state(w, d.date).paid > 0));
        if (collaboratorWork) issues.push({ code: 'collaborator-cost-unconfirmed', message: `${week}: actividad de colaboración con coste de servicio no confirmado; coste total no evaluable. No se remunera toda la disponibilidad como nómina.` });
        const cost = !collaboratorWork && !duplicateWorkers.size && contractedWorkers.length && contractedWorkers.every(w => Number.isFinite(w.costPerHour) && w.costPerHour! >= 0) ? contractedWorkers.reduce((n, w) => n + w.weeklyMinutes / 60 * w.costPerHour!, 0) : null;
        return { week, knownMinutes: matching.reduce((n, d) => n + d.knownMinutes, 0), estimatedMinutes: matching.reduce((n, d) => n + d.estimatedMinutes, 0), capacityMinutes, collaboratorCapacityMinutes: Math.round(collaboratorCapacityMinutes * 1e6) / 1e6, contractedMinutes, uncoveredMinutes: matching.reduce((n, d) => n + d.uncoveredMinutes, 0), criticalDays: matching.filter(d => d.uncoveredMinutes > 0).length, idleMinutes: Math.max(0, capacityMinutes - cleaningMinutes), cost };
    });
    const centerWeekKey = (row: { centerId: string; date: string }) => {
        checkpoint();
        return JSON.stringify([row.centerId, dateInfo(row.date).week]);
    };
    const knownByCenterWeek = groupBy<StaffingService>(knownServices.filter(s => dayByDate.has(s.date)), centerWeekKey);
    const estimatedByCenterWeek = groupBy<StaffingService>(estimatedServices.filter(s => dayByDate.has(s.date)), centerWeekKey);
    const assignedByCenterWeek = groupBy<StaffingAssignment>(days.flatMap(d => d.assignments), centerWeekKey);
    const centers = weeks.flatMap(w => centerRows.map(c => {
        checkpoint();
        const key = JSON.stringify([c.id, w.week]);
        const services = knownByCenterWeek.get(key) ?? [];
        const knownMinutes = services.reduce((n, s) => n + s.personMinutes, 0);
        const assignments = assignedByCenterWeek.get(key) ?? [];
        const estimatedMinutes = (estimatedByCenterWeek.get(key) ?? []).reduce((n, s) => n + s.personMinutes, 0);
        const uncoveredMinutes = knownMinutes + estimatedMinutes - assignments.reduce((n, a) => n + a.personMinutes, 0);
        const supportMinutes = assignments.filter(a => a.support).reduce((n, a) => n + a.personMinutes, 0);
        return { centerId: c.id, week: w.week, knownMinutes, estimatedMinutes, uncoveredMinutes, supportMinutes, status: !knownMinutes || estimatedMinutes > 0 || unknownCenters.has(c.id) ? 'unknown' as const : uncoveredMinutes ? 'shortage' as const : supportMinutes ? 'support' as const : 'covered' as const };
    }));
    return { days, weeks, centers, issues };
}
function incompleteForecast(): StaffingResult {
    return { days: [], weeks: [], centers: [], issues: [{ code: 'workload-limit', message: 'Cálculo incompleto: límite de trabajo local alcanzado. Cobertura, demanda y capacidad no evaluables; no se muestran totales parciales. Reduzca el horizonte o el ámbito.' }] };
}