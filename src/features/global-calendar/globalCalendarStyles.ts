import { Check, CircleHelp, Clock3 } from 'lucide-react';
import {
  CLEANING_STATE_LABEL,
  SOURCE_LABEL,
  formatShortDate,
  nightsLabel,
  type Cleaning,
  type CleaningState,
  type Stay,
} from './globalCalendarModel';

/** Clases compartidas por la leyenda y el tablero para que coincidan siempre. */
export const STAY_CLASS = 'bg-primary text-primary-foreground shadow-[0_1px_0_hsl(var(--primary)/0.4)]';
export const BLOCK_CLASS =
  'bg-[repeating-linear-gradient(-45deg,hsl(var(--state-warning)/0.28)_0_5px,hsl(var(--state-warning)/0.12)_5px_10px)] text-warning';
export const UNKNOWN_CLASS =
  'bg-[repeating-linear-gradient(135deg,transparent_0_6px,hsl(var(--ink-4)/0.35)_6px_7px)]';

export const CLEANING_CLASS: Record<CleaningState, string> = {
  pending: 'border-dashed border-ink-4 bg-surface text-ink-2',
  'in-progress': 'border-info/50 bg-tint-info text-info',
  completed: 'border-success/40 bg-tint-success text-success',
  unknown: 'border-ink-3/50 bg-paper text-ink-2',
};

export const CLEANING_ICON: Record<CleaningState, typeof Check> = {
  pending: Clock3,
  'in-progress': Clock3,
  completed: Check,
  unknown: CircleHelp,
};

export const shortSources = (stay: Stay) => [...new Set(stay.sources.map((source) => SOURCE_LABEL[source.source]))].join(' + ');

export function staySummary(stay: Stay) {
  const kind = stay.kind === 'block' ? 'Bloqueo' : 'Estancia';
  return `${kind} del ${formatShortDate(stay.checkIn)} al ${formatShortDate(stay.checkOut)}, ${nightsLabel(stay.nights)}, ${shortSources(stay)}`;
}

export function cleaningSummary(cleaning: Cleaning) {
  const time = cleaning.start ? `a las ${cleaning.start}` : 'sin hora prevista';
  const people = cleaning.cleaners.length ? cleaning.cleaners.join(', ') : 'sin personal asignado';
  const review = cleaning.needsReview ? ', parte pendiente de revisión' : '';
  return `Limpieza ${CLEANING_STATE_LABEL[cleaning.state].toLowerCase()} ${time}, ${people}${review}`;
}

