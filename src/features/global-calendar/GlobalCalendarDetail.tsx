import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, ArrowUpRight, Building2, CalendarDays, CircleDashed, Clock3, Info, LogIn, LogOut, Moon, Tag, UserRound, UsersRound } from 'lucide-react';
import { cn } from '@/lib/utils';
import { entityDetailPath } from '@/components/navigation/entityLinks';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import type { CalendarSelection } from './GlobalCalendarBoard';
import { BLOCK_CLASS, CLEANING_CLASS, CLEANING_ICON, STAY_CLASS, UNKNOWN_CLASS } from './globalCalendarStyles';
import {
  CLEANING_STATE_LABEL,
  NIGHT_STATE_LABEL,
  SOURCE_LABEL,
  formatFullDate,
  formatRecordedTime,
  formatShortDate,
  nightsLabel,
  type Cleaning,
  type PropertyWeek,
  type Stay,
} from './globalCalendarModel';

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-2">
      <h3 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-3">{title}</h3>
      {children}
    </section>
  );
}

function Fact({ icon, label, value }: { icon: ReactNode; label: string; value: ReactNode }) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-line bg-surface px-3 py-2.5">
      <span aria-hidden className="mt-0.5 text-ink-3">
        {icon}
      </span>
      <div className="min-w-0">
        <p className="text-[11px] font-medium uppercase tracking-wide text-ink-3">{label}</p>
        <div className="text-sm font-medium text-ink">{value}</div>
      </div>
    </div>
  );
}

function Notice({ tone, children }: { tone: 'warning' | 'info'; children: ReactNode }) {
  const Icon = tone === 'warning' ? AlertTriangle : Info;
  return (
    <p
      className={cn(
        'flex gap-2 rounded-xl px-3 py-2 text-[13px] leading-snug',
        tone === 'warning' ? 'bg-tint-warning text-warning' : 'bg-tint-info text-info',
      )}
    >
      <Icon aria-hidden className="mt-0.5 h-4 w-4 shrink-0" />
      <span>{children}</span>
    </p>
  );
}

function OpenLink({ to, children }: { to: string; children: ReactNode }) {
  return (
    <Link
      to={to}
      className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-surface px-3 py-2 text-sm font-medium text-primary outline-none hover:bg-secondary focus-visible:ring-2 focus-visible:ring-primary motion-safe:transition-colors"
    >
      {children}
      <ArrowUpRight aria-hidden className="h-3.5 w-3.5" />
    </Link>
  );
}

function CleaningButton({ cleaning, onOpen }: { cleaning: Cleaning; onOpen: (cleaning: Cleaning) => void }) {
  const Icon = CLEANING_ICON[cleaning.state];
  return (
    <button
      type="button"
      onClick={() => onOpen(cleaning)}
      className={cn(
        'flex w-full items-center gap-2 rounded-xl border px-3 py-2 text-left text-sm outline-none focus-visible:ring-2 focus-visible:ring-primary motion-safe:transition hover:shadow-sm',
        CLEANING_CLASS[cleaning.state],
      )}
    >
      <Icon aria-hidden className="h-4 w-4 shrink-0" />
      <span className="font-semibold tabular-nums">{cleaning.start ?? '--:--'}</span>
      <span className="min-w-0 flex-1 truncate text-ink-2">{cleaning.cleaners.join(', ') || 'Sin personal asignado'}</span>
      <span className="shrink-0 text-xs font-medium">{CLEANING_STATE_LABEL[cleaning.state]}</span>
    </button>
  );
}

// ---------------------------------------------------------------------------

function StayDetail({ stay, row, incomplete, onOpenCleaning }: { stay: Stay; row: PropertyWeek; incomplete: boolean; onOpenCleaning: (cleaning: Cleaning) => void }) {
  const { property } = row;
  const departureDay = row.days.find((day) => day.day === stay.checkOut);
  const isBlock = stay.kind === 'block';
  return (
    <div className="space-y-5">
      <div className="grid gap-2 sm:grid-cols-2">
        <Fact
          icon={<LogIn className="h-4 w-4" />}
          label={isBlock ? 'Desde' : 'Entrada'}
          value={
            <>
              {formatShortDate(stay.checkIn)}
              {!isBlock && property.defaultCheckIn && <span className="block text-xs font-normal text-ink-3">Desde las {property.defaultCheckIn} según la ficha</span>}
            </>
          }
        />
        <Fact
          icon={<LogOut className="h-4 w-4" />}
          label={isBlock ? 'Hasta' : 'Salida'}
          value={
            <>
              {formatShortDate(stay.checkOut)}
              {!isBlock && property.defaultCheckOut && <span className="block text-xs font-normal text-ink-3">Hasta las {property.defaultCheckOut} según la ficha</span>}
            </>
          }
        />
      </div>
      <Fact icon={<Moon className="h-4 w-4" />} label="Duración" value={stay.nights === 0 ? 'Entrada y salida el mismo día' : nightsLabel(stay.nights)} />

      {(stay.notes.length > 0 || incomplete || isBlock) && (
        <div className="space-y-2">
          {isBlock && (
            <Notice tone="info">
              Bloqueo registrado por la fuente. La sincronización no crea limpieza para un bloqueo y lo deja pendiente de revisión.
            </Notice>
          )}
          {stay.notes.includes('overlap') && (
            <Notice tone="warning">Se solapa con otra estancia o bloqueo registrado en esta propiedad. Revisa la fuente antes de decidir.</Notice>
          )}
          {stay.notes.includes('shared-task') && (
            <Notice tone="warning">Otra reserva con fechas distintas apunta a la misma limpieza.</Notice>
          )}
          {incomplete && <Notice tone="warning">Alguna fuente de reservas no se pudo leer: puede faltar información de esta propiedad.</Notice>}
        </div>
      )}

      <Section title={stay.sources.length > 1 ? `Registrada en ${stay.sources.length} fuentes (se muestra una vez)` : 'Origen'}>
        <ul className="divide-y divide-line rounded-xl border border-line bg-surface">
          {stay.sources.map((source) => (
            <li key={`${source.source}:${source.sourceId}`} className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 px-3 py-2 text-sm">
              <span className="font-medium text-ink">{SOURCE_LABEL[source.source]}</span>
              <span className="text-xs text-ink-3">
                {[source.status && `Estado: ${source.status}`, source.room && `Espacio: ${source.room}`, source.externalId && `Ref. ${source.externalId}`]
                  .filter(Boolean)
                  .join(' · ')}
              </span>
            </li>
          ))}
        </ul>
      </Section>

      {!isBlock && (
        <Section title="Limpieza del día de salida">
          {!departureDay ? (
            <p className="text-sm text-ink-3">La salida queda fuera de la semana visible.</p>
          ) : departureDay.cleanings.length ? (
            <div className="space-y-1.5">
              {departureDay.cleanings.map((cleaning) => (
                <CleaningButton key={cleaning.id} cleaning={cleaning} onOpen={onOpenCleaning} />
              ))}
            </div>
          ) : (
            <p className="flex items-center gap-2 rounded-xl border border-dashed border-warning/50 px-3 py-2 text-sm text-warning">
              <CircleDashed aria-hidden className="h-4 w-4" />
              No hay ninguna limpieza registrada ese día en esta propiedad.
            </p>
          )}
        </Section>
      )}

      <OpenLink to={entityDetailPath('property', property.id)}>Abrir ficha de la propiedad</OpenLink>
    </div>
  );
}

function CleaningDetail({ cleaning }: { cleaning: Cleaning }) {
  const Icon = CLEANING_ICON[cleaning.state];
  const started = formatRecordedTime(cleaning.recordedStart, cleaning.date);
  const finished = formatRecordedTime(cleaning.recordedEnd, cleaning.date);
  const storedLabel: Record<string, string> = { pending: 'Pendiente', 'in-progress': 'En curso', in_progress: 'En curso', completed: 'Completada' };
  const stored = cleaning.plannedStatus ? storedLabel[cleaning.plannedStatus] ?? cleaning.plannedStatus : 'Sin estado';
  const shownMatchesStored =
    (cleaning.plannedStatus === 'in_progress' ? 'in-progress' : cleaning.plannedStatus) === cleaning.state;
  return (
    <div className="space-y-5">
      <div className={cn('flex items-center gap-3 rounded-xl border px-3 py-3', CLEANING_CLASS[cleaning.state])}>
        <Icon aria-hidden className="h-5 w-5 shrink-0" />
        <div>
          <p className="text-sm font-semibold">{CLEANING_STATE_LABEL[cleaning.state]}</p>
          <p className="text-xs text-ink-2">
            {cleaning.state === 'completed'
              ? finished
                ? `Fin registrado: ${finished}`
                : 'Cerrada en la tarea, sin hora de fin en el parte'
              : cleaning.state === 'in-progress'
                ? started
                  ? `Inicio registrado: ${started}`
                  : 'Marcada en curso en la tarea'
                : cleaning.state === 'pending'
                  ? 'Sin parte de trabajo iniciado'
                  : `Estado guardado: ${stored}`}
          </p>
        </div>
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        <Fact icon={<CalendarDays className="h-4 w-4" />} label="Día" value={formatFullDate(cleaning.date)} />
        <Fact
          icon={<Clock3 className="h-4 w-4" />}
          label="Horario previsto"
          value={cleaning.start ? `${cleaning.start}${cleaning.end ? ` – ${cleaning.end}` : ''}` : 'Sin hora prevista'}
        />
      </div>
      {cleaning.type && <Fact icon={<Tag className="h-4 w-4" />} label="Tipo" value={cleaning.type} />}

      <Section title="Personal asignado">
        {cleaning.cleaners.length ? (
          <ul className="flex flex-wrap gap-1.5">
            {cleaning.cleaners.map((name) => (
              <li key={name} className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface px-2.5 py-1 text-sm text-ink">
                <UsersRound aria-hidden className="h-3.5 w-3.5 text-ink-3" />
                {name}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-ink-3">Sin personal asignado.</p>
        )}
      </Section>

      {(cleaning.needsReview || started || !shownMatchesStored) && (
        <Section title="Registro">
          <div className="space-y-2">
            {started && cleaning.state === 'completed' && <p className="text-sm text-ink-2">Inicio registrado: {started}</p>}
            {cleaning.needsReview && <Notice tone="warning">Hay un parte de trabajo pendiente de revisión.</Notice>}
            {!shownMatchesStored && cleaning.state !== 'unknown' && (
              <Notice tone="info">El estado guardado en la tarea es «{stored}»; aquí se muestra lo que registran los partes de trabajo.</Notice>
            )}
          </div>
        </Section>
      )}

      <OpenLink to={entityDetailPath('task', cleaning.id)}>Abrir tarea</OpenLink>
    </div>
  );
}

function PropertyDetail({ row }: { row: PropertyWeek }) {
  const { property } = row;
  return (
    <div className="space-y-5">
      <div className="grid gap-2 sm:grid-cols-2">
        <Fact icon={<UserRound className="h-4 w-4" />} label="Cliente" value={property.clientName ?? 'Sin cliente asignado'} />
        <Fact icon={<Building2 className="h-4 w-4" />} label="Edificio" value={property.buildingName ?? 'Sin edificio asignado'} />
        <Fact icon={<LogIn className="h-4 w-4" />} label="Entrada habitual" value={property.defaultCheckIn ?? 'Sin hora en la ficha'} />
        <Fact icon={<LogOut className="h-4 w-4" />} label="Salida habitual" value={property.defaultCheckOut ?? 'Sin hora en la ficha'} />
      </div>
      <Section title="Noches de la semana">
        <ul className="divide-y divide-line rounded-xl border border-line bg-surface">
          {row.days.map((day) => (
            <li key={day.day} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
              <span className="text-ink-2">{formatShortDate(day.day)}</span>
              <span className="flex items-center gap-2 font-medium text-ink">
                <span
                  aria-hidden
                  className={cn(
                    'h-3 w-5 rounded-[3px]',
                    day.night === 'occupied' && STAY_CLASS,
                    day.night === 'blocked' && BLOCK_CLASS,
                    day.night === 'unknown' && cn(UNKNOWN_CLASS, 'border border-line'),
                    day.night === 'none' && 'border border-line bg-surface',
                  )}
                />
                {NIGHT_STATE_LABEL[day.night]}
                <span className="w-16 text-right text-xs font-normal tabular-nums text-ink-3">
                  {day.cleanings.length === 1 ? '1 limpieza' : day.cleanings.length ? `${day.cleanings.length} limpiezas` : ''}
                </span>
              </span>
            </li>
          ))}
        </ul>
      </Section>
      {row.reservationsIncomplete && <Notice tone="warning">Alguna fuente de reservas no se pudo leer: puede faltar información de esta propiedad.</Notice>}
      <OpenLink to={entityDetailPath('property', property.id)}>Abrir ficha de la propiedad</OpenLink>
    </div>
  );
}

// ---------------------------------------------------------------------------

export function GlobalCalendarDetail({
  selection,
  side,
  onClose,
  onSelect,
  onCloseAutoFocus,
}: {
  selection: CalendarSelection | null;
  side: 'right' | 'bottom';
  onClose: () => void;
  onSelect: (selection: CalendarSelection) => void;
  onCloseAutoFocus: (event: Event) => void;
}) {
  const open = !!selection;
  let title = '';
  let description = '';
  let accent = '';
  if (selection?.kind === 'stay') {
    title = selection.stay.kind === 'block' ? 'Bloqueo' : 'Estancia';
    description = `${selection.row.property.name}${selection.row.property.code ? ` · ${selection.row.property.code}` : ''}`;
    accent = selection.stay.kind === 'block' ? BLOCK_CLASS : STAY_CLASS;
  } else if (selection?.kind === 'cleaning') {
    title = 'Limpieza';
    description = selection.row ? selection.row.property.name : selection.cleaning.propertyLabel;
    accent = CLEANING_CLASS[selection.cleaning.state];
  } else if (selection?.kind === 'property') {
    title = selection.row.property.name;
    description = [selection.row.property.code, 'Resumen de la semana'].filter(Boolean).join(' · ');
    accent = 'bg-secondary';
  }

  return (
    <Sheet open={open} onOpenChange={(value) => !value && onClose()}>
      <SheetContent
        side={side}
        onCloseAutoFocus={onCloseAutoFocus}
        className={cn(
          'flex flex-col gap-0 overflow-y-auto border-line bg-paper p-0',
          side === 'right' ? 'w-full sm:max-w-md' : 'max-h-[88dvh] rounded-t-2xl',
          'motion-reduce:data-[state=closed]:animate-none motion-reduce:data-[state=open]:animate-none motion-reduce:transition-none',
        )}
      >
        {selection && (
          <>
            <div aria-hidden className={cn('h-1.5 w-full shrink-0 border-0', accent)} />
            <SheetHeader className="space-y-1 px-5 pb-4 pt-5 text-left">
              <SheetTitle className="font-[Manrope,sans-serif] text-xl font-bold tracking-tight text-ink">{title}</SheetTitle>
              <SheetDescription className="text-sm text-ink-2">{description}</SheetDescription>
            </SheetHeader>
            <div className="px-5 pb-8">
              {selection.kind === 'stay' && (
                <StayDetail
                  stay={selection.stay}
                  row={selection.row}
                  incomplete={selection.row.reservationsIncomplete}
                  onOpenCleaning={(cleaning) => onSelect({ kind: 'cleaning', cleaning, row: selection.row })}
                />
              )}
              {selection.kind === 'cleaning' && <CleaningDetail cleaning={selection.cleaning} />}
              {selection.kind === 'property' && <PropertyDetail row={selection.row} />}
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
