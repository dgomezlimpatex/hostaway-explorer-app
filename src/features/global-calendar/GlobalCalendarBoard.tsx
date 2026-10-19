import { memo, useEffect, useRef, useState, type CSSProperties } from 'react';
import { AlertTriangle, ChevronDown, CircleDashed, LogIn, LogOut } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  HALF_DAYS,
  NIGHT_STATE_LABEL,
  formatDayNumber,
  formatMonthShort,
  formatShortDate,
  formatWeekday,
  formatWeekdayLong,
  nightsLabel,
  type Cleaning,
  type PropertyDay,
  type PropertyWeek,
  type RowGroup,
  type Stay,
  type StaySegment,
} from './globalCalendarModel';
import { BLOCK_CLASS, CLEANING_CLASS, CLEANING_ICON, STAY_CLASS, UNKNOWN_CLASS, cleaningSummary, shortSources, staySummary } from './globalCalendarStyles';

export type CalendarSelection =
  | { kind: 'stay'; stay: Stay; row: PropertyWeek }
  | { kind: 'cleaning'; cleaning: Cleaning; row: PropertyWeek | null }
  | { kind: 'property'; row: PropertyWeek };

const LANE_HEIGHT = 30;
const TRACK_PADDING = 6;

const firstNames = (names: string[]) => {
  if (!names.length) return 'Sin asignar';
  const short = names.map((name) => name.split(/\s+/)[0]);
  return short.length > 2 ? `${short.slice(0, 2).join(', ')} +${short.length - 2}` : short.join(', ');
};

// ---------------------------------------------------------------------------

const StayBar = memo(function StayBar({ segment, onSelect }: { segment: StaySegment; onSelect: () => void }) {
  const { stay, start, end, lane, continuesBefore, continuesAfter } = segment;
  const left = (start / HALF_DAYS) * 100;
  const width = ((end - start) / HALF_DAYS) * 100;
  const slant = 7;
  const clip = `polygon(${continuesBefore ? '0 0' : `${slant}px 0`}, 100% 0, ${continuesAfter ? '100% 100%' : `calc(100% - ${slant}px) 100%`}, 0 100%)`;
  const flagged = stay.notes.includes('overlap') || stay.notes.includes('shared-task');
  const style: CSSProperties = {
    left: `calc(${left}% + 1px)`,
    width: `calc(${width}% - 2px)`,
    top: TRACK_PADDING + lane * LANE_HEIGHT,
  };
  return (
    <button
      type="button"
      onClick={onSelect}
      style={style}
      aria-label={`${staySummary(stay)}${flagged ? '. Requiere revisión' : ''}`}
      title={staySummary(stay)}
      className={cn(
        'group/stay absolute h-6 rounded-md text-left outline-none',
        'focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface',
        'motion-safe:transition-transform motion-safe:duration-150 motion-safe:hover:-translate-y-px',
      )}
    >
      <span
        aria-hidden
        style={{ clipPath: clip }}
        className={cn(
          'absolute inset-0 rounded-[5px] motion-safe:transition-[filter] group-hover/stay:brightness-110',
          stay.kind === 'block' ? cn(BLOCK_CLASS, 'ring-1 ring-inset ring-warning/40') : STAY_CLASS,
        )}
      />
      <span
        className={cn(
          'relative flex h-full items-center gap-1 truncate px-2.5 text-[11px] font-semibold leading-none',
          stay.kind === 'block' ? 'text-warning' : 'text-primary-foreground',
        )}
      >
        {continuesBefore && <span aria-hidden>‹</span>}
        {flagged && <AlertTriangle aria-hidden className="h-3 w-3 shrink-0 text-amber-300" />}
        <span className="truncate">
          {stay.kind === 'block' ? 'Bloqueo' : nightsLabel(stay.nights)}
          <span className="font-normal opacity-80"> · {shortSources(stay)}</span>
        </span>
        {continuesAfter && <span aria-hidden className="ml-auto">›</span>}
      </span>
    </button>
  );
});

const CleaningChip = memo(function CleaningChip({ cleaning, onSelect }: { cleaning: Cleaning; onSelect: () => void }) {
  const Icon = CLEANING_ICON[cleaning.state];
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-label={cleaningSummary(cleaning)}
      title={cleaningSummary(cleaning)}
      className={cn(
        'relative flex w-full min-w-0 items-center gap-1 rounded-md border px-1.5 py-1 text-left text-[11px] leading-tight outline-none',
        'focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1',
        'motion-safe:transition motion-safe:duration-150 motion-safe:hover:-translate-y-px hover:shadow-sm',
        CLEANING_CLASS[cleaning.state],
      )}
    >
      {cleaning.state === 'in-progress' ? (
        <span aria-hidden className="relative flex h-2 w-2 shrink-0">
          <span className="absolute inline-flex h-full w-full rounded-full bg-info/50 motion-safe:animate-ping" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-info" />
        </span>
      ) : (
        <Icon aria-hidden className="h-3 w-3 shrink-0" />
      )}
      <span className="shrink-0 font-semibold tabular-nums">{cleaning.start ?? '--:--'}</span>
      <span className="min-w-0 truncate text-ink-2">{firstNames(cleaning.cleaners)}</span>
      {cleaning.needsReview && <span aria-hidden className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-warning ring-2 ring-surface" />}
    </button>
  );
});

function MissingCleaning({ onSelect }: { onSelect: () => void }) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-label="Salida registrada sin limpieza ese día"
      className={cn(
        'flex w-full items-center gap-1 rounded-md border border-dashed border-warning/50 px-1.5 py-1 text-left text-[11px] leading-tight text-warning outline-none',
        'focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 hover:bg-tint-warning motion-safe:transition-colors',
      )}
    >
      <CircleDashed aria-hidden className="h-3 w-3 shrink-0" />
      <span className="truncate">Sin limpieza</span>
    </button>
  );
}

// ---------------------------------------------------------------------------

interface RowProps {
  row: PropertyWeek;
  today: string;
  secondary: 'building' | 'client';
  cleaningsUnavailable: boolean;
  onSelect: (selection: CalendarSelection) => void;
}

const DayBackground = ({ days, today }: { days: PropertyDay[]; today: string }) => (
  <div aria-hidden className="pointer-events-none absolute inset-0 grid grid-cols-7">
    {days.map((day, index) => {
      const weekend = index >= 5;
      return (
        <div
          key={day.day}
          className={cn(
            'border-l border-line-soft first:border-l-0',
            weekend && 'bg-paper/70',
            day.day === today && 'bg-primary/[0.045]',
            day.night === 'unknown' && UNKNOWN_CLASS,
          )}
        />
      );
    })}
  </div>
);

const PropertyRow = memo(function PropertyRow({ row, today, secondary, cleaningsUnavailable, onSelect }: RowProps) {
  const { property } = row;
  const secondaryText = secondary === 'building' ? property.buildingName : property.clientName;
  const trackHeight = TRACK_PADDING * 2 + row.lanes * LANE_HEIGHT - 6;
  const nightSummary = row.days.map((day) => `${formatWeekdayLong(day.day)}: ${NIGHT_STATE_LABEL[day.night]}`).join('; ');
  return (
    <div role="row" className="group/row contents">
      <div
        role="rowheader"
        className="sticky left-0 z-10 flex min-w-0 items-stretch border-b border-r border-line bg-surface group-hover/row:bg-paper motion-safe:transition-colors"
      >
        <button
          type="button"
          onClick={() => onSelect({ kind: 'property', row })}
          className="flex min-w-0 flex-1 flex-col justify-center gap-0.5 px-3 py-2 text-left outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary"
          aria-label={`${property.name}${property.code ? `, ${property.code}` : ''}. ${nightSummary}`}
        >
          <span className="flex min-w-0 items-center gap-1.5">
            <span className="truncate text-[13px] font-semibold text-ink">{property.name}</span>
            {!property.isActive && (
              <span className="shrink-0 rounded border border-line px-1 text-[10px] font-medium uppercase tracking-wide text-ink-3">Inactiva</span>
            )}
          </span>
          <span className="flex min-w-0 items-center gap-1.5 text-[11px] text-ink-3">
            {property.code && <span className="shrink-0 font-mono tabular-nums">{property.code}</span>}
            {secondaryText && <span className="truncate">· {secondaryText}</span>}
          </span>
        </button>
      </div>
      <div role="cell" className="relative col-span-7 border-b border-line">
        <DayBackground days={row.days} today={today} />
        <div className="relative" style={{ height: trackHeight }}>
          {row.segments.map((segment) => (
            <StayBar key={segment.stay.id} segment={segment} onSelect={() => onSelect({ kind: 'stay', stay: segment.stay, row })} />
          ))}
        </div>
        <div className="relative grid grid-cols-7 gap-0 pb-1.5">
          {row.days.map((day) => {
            const departure = day.departures[0];
            return (
              <div key={day.day} className="flex min-w-0 flex-col gap-1 px-1">
                {cleaningsUnavailable ? (
                  <span className="px-1 py-1 text-[11px] text-ink-4">No disponible</span>
                ) : (
                  <>
                    {day.cleanings.map((cleaning) => (
                      <CleaningChip key={cleaning.id} cleaning={cleaning} onSelect={() => onSelect({ kind: 'cleaning', cleaning, row })} />
                    ))}
                    {day.departureWithoutCleaning && departure && (
                      <MissingCleaning onSelect={() => onSelect({ kind: 'stay', stay: departure, row })} />
                    )}
                  </>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
});

// ---------------------------------------------------------------------------

function DayHeader({ day, today, rows, index }: { day: string; today: string; rows: PropertyWeek[]; index: number }) {
  let arrivals = 0;
  let departures = 0;
  let cleanings = 0;
  for (const row of rows) {
    const entry = row.days[index];
    arrivals += entry.arrivals.length;
    departures += entry.departures.length;
    cleanings += entry.cleanings.length;
  }
  const isToday = day === today;
  return (
    <div
      role="columnheader"
      data-day-index={index}
      aria-label={`${formatWeekdayLong(day)} ${formatDayNumber(day)}${isToday ? ', hoy' : ''}: ${arrivals} entradas, ${departures} salidas, ${cleanings} limpiezas`}
      className={cn(
        'sticky top-0 z-20 flex flex-col gap-1 border-b border-l border-line bg-surface/95 px-2 pb-2 pt-2.5 backdrop-blur',
        index >= 5 && 'bg-paper/95',
        isToday && 'bg-[hsl(259_60%_97%/0.96)]',
      )}
    >
      <div className="flex items-baseline gap-1.5">
        <span className={cn('text-[11px] font-semibold uppercase tracking-[0.08em]', isToday ? 'text-primary' : 'text-ink-3')}>
          {formatWeekday(day)}
        </span>
        <span
          className={cn(
            'font-[Manrope,sans-serif] text-lg font-bold leading-none tabular-nums',
            isToday ? 'rounded-full bg-primary px-1.5 py-0.5 text-primary-foreground' : 'text-ink',
          )}
        >
          {formatDayNumber(day)}
        </span>
        <span className="text-[11px] text-ink-3">{formatMonthShort(day)}</span>
      </div>
      <div aria-hidden className="flex items-center gap-2 text-[11px] tabular-nums text-ink-3">
        <span className="inline-flex items-center gap-0.5" title="Entradas">
          <LogIn className="h-3 w-3" />
          {arrivals}
        </span>
        <span className="inline-flex items-center gap-0.5" title="Salidas">
          <LogOut className="h-3 w-3" />
          {departures}
        </span>
        <span className="inline-flex items-center gap-0.5" title="Limpiezas">
          <span className="h-2 w-2 rounded-sm border border-ink-4" />
          {cleanings}
        </span>
      </div>
    </div>
  );
}

function GroupSection({
  group,
  today,
  secondary,
  cleaningsUnavailable,
  onSelect,
  showHeader,
}: {
  group: RowGroup;
  today: string;
  secondary: 'building' | 'client';
  cleaningsUnavailable: boolean;
  onSelect: (selection: CalendarSelection) => void;
  showHeader: boolean;
}) {
  const [open, setOpen] = useState(true);
  const bodyId = `gc-group-${group.key}`;
  return (
    <div role="rowgroup" className="contents">
      {showHeader && (
        <div role="row" className="contents">
          <div role="rowheader" className="sticky left-0 z-10 col-span-8 border-b border-line bg-paper/95 backdrop-blur-sm">
            <button
              type="button"
              aria-expanded={open}
              aria-controls={bodyId}
              onClick={() => setOpen((value) => !value)}
              className="sticky left-0 flex items-center gap-2 px-3 py-1.5 text-left outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary"
            >
              <ChevronDown aria-hidden className={cn('h-3.5 w-3.5 text-ink-3 motion-safe:transition-transform motion-safe:duration-200', !open && '-rotate-90')} />
              <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-2">{group.label}</span>
              <span className="rounded-full bg-surface px-1.5 text-[11px] tabular-nums text-ink-3 ring-1 ring-line">{group.rows.length}</span>
            </button>
          </div>
        </div>
      )}
      {open && (
        <div id={bodyId} className="contents">
          {group.rows.map((row) => (
            <PropertyRow
              key={row.property.id}
              row={row}
              today={today}
              secondary={secondary}
              cleaningsUnavailable={cleaningsUnavailable}
              onSelect={onSelect}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function UnplacedRow({ cleanings, days, onSelect }: { cleanings: Cleaning[]; days: string[]; onSelect: (selection: CalendarSelection) => void }) {
  return (
    <div role="rowgroup" className="contents">
      <div role="row" className="contents">
        <div role="rowheader" className="sticky left-0 z-10 flex flex-col justify-center gap-0.5 border-b border-r border-line bg-tint-warning px-3 py-2">
          <span className="text-[13px] font-semibold text-ink">Sin propiedad en el listado</span>
          <span className="text-[11px] text-ink-3">Limpiezas sin ficha vinculada en esta sede</span>
        </div>
        <div role="cell" className="col-span-7 grid grid-cols-7 border-b border-line bg-tint-warning/40 py-1.5">
          {days.map((day) => (
            <div key={day} className="flex min-w-0 flex-col gap-1 px-1">
              {cleanings
                .filter((cleaning) => cleaning.date === day)
                .map((cleaning) => (
                  <div key={cleaning.id} className="min-w-0">
                    <CleaningChip cleaning={cleaning} onSelect={() => onSelect({ kind: 'cleaning', cleaning, row: null })} />
                    <p className="mt-0.5 truncate px-0.5 text-[10px] text-ink-3">{cleaning.propertyLabel}</p>
                  </div>
                ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------

export interface GlobalCalendarBoardProps {
  days: string[];
  groups: RowGroup[];
  unplaced: Cleaning[];
  today: string;
  groupMode: 'building' | 'client' | 'none';
  cleaningsUnavailable: boolean;
  direction: 'forward' | 'backward' | 'none';
  dimmed: boolean;
  onSelect: (selection: CalendarSelection) => void;
}

export function GlobalCalendarBoard({ days, groups, unplaced, today, groupMode, cleaningsUnavailable, direction, dimmed, onSelect }: GlobalCalendarBoardProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const allRows = groups.flatMap((group) => group.rows);
  const weekKey = days[0];
  const todayIndex = days.indexOf(today);

  // En pantallas estrechas, llevar el día de hoy a la vista al cambiar de semana.
  useEffect(() => {
    const element = scrollRef.current;
    if (!element || todayIndex < 0 || element.scrollWidth <= element.clientWidth) return;
    const header = element.querySelector<HTMLElement>(`[data-day-index="${todayIndex}"]`);
    const label = element.querySelector<HTMLElement>('[data-corner]');
    if (header && label) element.scrollLeft = Math.max(0, header.offsetLeft - label.offsetWidth);
  }, [weekKey, todayIndex]);

  const secondary = groupMode === 'building' ? 'client' : 'building';

  return (
    <div
      ref={scrollRef}
      className={cn(
        'relative max-h-[calc(100dvh-15rem)] min-h-[18rem] overflow-auto overscroll-contain rounded-2xl border border-line bg-surface shadow-sm',
        '[--gc-label:9.25rem] [--gc-day:6.75rem] sm:[--gc-label:13rem] sm:[--gc-day:7.5rem] xl:[--gc-label:15rem]',
        dimmed && 'opacity-60 motion-safe:transition-opacity',
      )}
      aria-busy={dimmed}
    >
      <div
        key={weekKey}
        role="table"
        aria-label={`Calendario de la semana del ${formatShortDate(days[0])} al ${formatShortDate(days[6])}`}
        className={cn(
          'grid grid-cols-[var(--gc-label)_repeat(7,minmax(var(--gc-day),1fr))]',
          'motion-safe:animate-in motion-safe:fade-in-0 motion-safe:duration-300',
          direction === 'forward' && 'motion-safe:slide-in-from-right-4',
          direction === 'backward' && 'motion-safe:slide-in-from-left-4',
        )}
        style={{ minWidth: 'calc(var(--gc-label) + 7 * var(--gc-day))' }}
      >
        <div role="rowgroup" className="contents">
          <div role="row" className="contents">
            <div
              role="columnheader"
              data-corner
              className="sticky left-0 top-0 z-30 flex items-end border-b border-r border-line bg-surface px-3 pb-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-3"
            >
              Propiedad
            </div>
            {days.map((day, index) => (
              <DayHeader key={day} day={day} today={today} rows={allRows} index={index} />
            ))}
          </div>
        </div>
        {groups.map((group) => (
          <GroupSection
            key={group.key}
            group={group}
            today={today}
            secondary={secondary}
            cleaningsUnavailable={cleaningsUnavailable}
            onSelect={onSelect}
            showHeader={groupMode !== 'none'}
          />
        ))}
        {unplaced.length > 0 && <UnplacedRow cleanings={unplaced} days={days} onSelect={onSelect} />}
      </div>
    </div>
  );
}
