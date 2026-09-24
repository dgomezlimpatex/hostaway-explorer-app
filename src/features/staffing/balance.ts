import type { StaffingDay, StaffingWorker } from './types';
import { availableMinutesForPeriod } from './StaffingTeam';

export interface BalanceRow {
  worker: StaffingWorker;
  /** Horas semanales de ficha que se están usando en la simulación. */
  weeklyMinutes: number;
  /** Horas del periodo elegido que esa persona debe trabajar. */
  periodMinutes: number;
  /** Margen disponible dentro del tope del +30 %. */
  headroomMinutes: number;
}

export interface BalanceResult {
  factor: number;
  /** Carga prevista del periodo (trabajo registrado + estimado). */
  workloadMinutes: number;
  /** Objetivo de plantilla: carga prevista + colchón. */
  targetMinutes: number;
  /** Horas comprometidas del equipo con las horas actuales de la simulación. */
  actualMinutes: number;
  /** actual − objetivo: positivo sobra plantilla, negativo falta. */
  differenceMinutes: number;
  rows: BalanceRow[];
}

/** Cuadre de plantilla: carga prevista, objetivo con colchón y horas comprometidas del equipo. */
export function staffingBalance(workers: StaffingWorker[], days: StaffingDay[], workloadMinutes: number, cushionPercent: number): BalanceResult {
  const factor = days.length / 7;
  const rows: BalanceRow[] = workers.map(worker => ({
    worker,
    weeklyMinutes: worker.weeklyMinutes,
    periodMinutes: availableMinutesForPeriod(worker, days, worker.weeklyMinutes * factor),
    headroomMinutes: Math.max(0, availableMinutesForPeriod(worker, days, (worker.weeklyMinutesMax ?? worker.weeklyMinutes) * factor) - availableMinutesForPeriod(worker, days, worker.weeklyMinutes * factor)),
  }));
  const actualMinutes = rows.reduce((total, row) => total + row.periodMinutes, 0);
  const targetMinutes = workloadMinutes * (1 + Math.max(0, cushionPercent) / 100);
  return { factor, workloadMinutes, targetMinutes, actualMinutes, differenceMinutes: actualMinutes - targetMinutes, rows };
}

/** Reparto sugerido: recorta o amplía horas de forma proporcional y editable. */
export function suggestedWeeklyMinutes(balance: BalanceResult): Record<string, number> {
  const { rows, factor, differenceMinutes } = balance;
  const plan: Record<string, number> = {};
  const round = (minutes: number) => Math.round(minutes / 15) * 15;
  if (Math.abs(differenceMinutes) < 1) return plan;
  if (differenceMinutes > 0) {
    const payable = rows.filter(row => row.periodMinutes > 0);
    const total = payable.reduce((sum, row) => sum + row.periodMinutes, 0);
    if (!total) return plan;
    for (const row of payable) {
      const target = Math.max(0, row.periodMinutes - differenceMinutes * (row.periodMinutes / total));
      plan[row.worker.id] = Math.max(0, round(row.weeklyMinutes * (row.periodMinutes ? target / row.periodMinutes : 1)));
    }
    return plan;
  }
  const shortfall = -differenceMinutes;
  const totalHeadroom = rows.reduce((sum, row) => sum + row.headroomMinutes, 0);
  for (const row of rows) {
    if (row.headroomMinutes <= 0) continue;
    const take = totalHeadroom <= shortfall ? row.headroomMinutes : shortfall * (row.headroomMinutes / totalHeadroom);
    plan[row.worker.id] = round(row.weeklyMinutes + take / factor);
  }
  return plan;
}
