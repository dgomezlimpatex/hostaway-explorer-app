import type { StockLevel } from '@/types/stock';

export type CountLineStatus = 'pending' | 'same' | 'difference' | 'invalid';

export interface CountLine {
  level: StockLevel;
  counted: number | null;
  difference: number;
  valueDifference: number;
  status: CountLineStatus;
}

export interface CountSummary {
  pending: number;
  same: number;
  withDifference: number;
  invalid: number;
  unitsDifference: number;
  valueDifference: number;
}

const round2 = (value: number) => Math.round(value * 100) / 100;

/** '' = sin contar; admite coma decimal; máximo 2 decimales y no negativo. */
export const parseCountedQuantity = (raw: string | undefined): number | null | 'invalid' => {
  const text = (raw ?? '').trim().replace(',', '.');
  if (text === '') return null;
  if (!/^\d+(\.\d{1,2})?$/.test(text)) return 'invalid';
  const value = Number(text);
  return Number.isFinite(value) && value < 10_000_000 ? value : 'invalid';
};

export const buildCountLines = (levels: StockLevel[], drafts: Record<string, string>): CountLine[] =>
  levels.map((level) => {
    const parsed = parseCountedQuantity(drafts[level.id]);
    if (parsed === 'invalid') return { level, counted: null, difference: 0, valueDifference: 0, status: 'invalid' };
    if (parsed === null) return { level, counted: null, difference: 0, valueDifference: 0, status: 'pending' };
    const difference = round2(parsed - level.current_quantity);
    return {
      level,
      counted: parsed,
      difference,
      valueDifference: round2(difference * (level.cost_per_unit || 0)),
      status: difference === 0 ? 'same' : 'difference',
    };
  });

export const summarizeCount = (lines: CountLine[]): CountSummary => {
  const summary: CountSummary = { pending: 0, same: 0, withDifference: 0, invalid: 0, unitsDifference: 0, valueDifference: 0 };
  for (const line of lines) {
    if (line.status === 'pending') summary.pending += 1;
    else if (line.status === 'same') summary.same += 1;
    else if (line.status === 'invalid') summary.invalid += 1;
    else {
      summary.withDifference += 1;
      summary.unitsDifference = round2(summary.unitsDifference + line.difference);
      summary.valueDifference = round2(summary.valueDifference + line.valueDifference);
    }
  }
  return summary;
};

export const linesToApply = (lines: CountLine[]): CountLine[] => lines.filter((line) => line.status === 'difference');

export const countReason = (madridDate: string, note: string): string => {
  const [year, month, day] = madridDate.split('-');
  const base = `Recuento físico ${day}/${month}/${year}`;
  const trimmed = note.trim();
  return trimmed ? `${base} · ${trimmed}` : base;
};
