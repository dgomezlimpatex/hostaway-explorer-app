import { useCallback, useDeferredValue, useMemo, useRef, useState, type ReactNode } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { AlertTriangle, ChevronLeft, ChevronRight, Info, Loader2, RefreshCw, Search, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { SedeSelector } from '@/components/sede/SedeSelector';
import { withoutSearchParam } from '@/components/navigation/entityLinks';
import { useIsMobile } from '@/hooks/use-mobile';
import { getMadridToday, shiftCivilDate } from '@/utils/madridCalendar';
import { GlobalCalendarBoard, type CalendarSelection } from './GlobalCalendarBoard';
import { GlobalCalendarDetail } from './GlobalCalendarDetail';
import {
  SOURCE_LABEL,
  filterRows,
  formatWeekRange,
  groupRows,
  resolveWeekStart,
  weekDaysFrom,
  type GroupMode,
  type ReservationSource,
} from './globalCalendarModel';
import { useGlobalCalendar, type GlobalCalendarData } from './useGlobalCalendar';

const GROUP_PARAM: Record<GroupMode, string> = { building: 'edificio', client: 'cliente', none: 'ninguno' };
const parseGroup = (value: string | null): GroupMode =>
  value === GROUP_PARAM.client ? 'client' : value === GROUP_PARAM.none ? 'none' : 'building';

const SOURCE_ADMIN_PATH: Partial<Record<ReservationSource, string>> = {
  smoobu: '/smoobu',
  littleHotelier: '/little-hotelier',
  avirato: '/integraciones/avirato',
  avantio: '/avantio-automation',
};

const plural = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`;

function DataNotices({ data, groupMode }: { data: GlobalCalendarData; groupMode: GroupMode }) {
  const failing = data.coverage.filter((item) => item.state !== 'ok');
  const notices: Array<{ tone: 'warning' | 'danger' | 'info'; key: string; content: ReactNode }> = [];
  if (data.cleaningsState !== 'ok') {
    notices.push({
      tone: 'danger',
      key: 'cleanings',
      content:
        data.cleaningsState === 'error'
          ? 'No se pudieron leer las limpiezas de esta semana. La franja de limpiezas aparece como «No disponible».'
          : 'Hay más limpiezas de las que se pueden mostrar a la vez; la lista de esta semana puede estar incompleta.',
    });
  }
  if (failing.length) {
    notices.push({
      tone: 'warning',
      key: 'sources',
      content: (
        <>
          No se pudieron leer todas las reservas ({failing.map((item) => `${SOURCE_LABEL[item.source]}${item.state === 'truncated' ? ': demasiadas filas' : ''}`).join(', ')}).
          Las noches sin estancia de las propiedades afectadas aparecen como «Dato no disponible».
        </>
      ),
    });
  }
  if (data.unmapped.length) {
    notices.push({
      tone: 'info',
      key: 'unmapped',
      content: (
        <>
          Reservas activas sin propiedad vinculada en su fuente (no se pueden situar en el calendario):{' '}
          {data.unmapped.map((item, index) => {
            const path = SOURCE_ADMIN_PATH[item.source];
            const label = `${SOURCE_LABEL[item.source]}: ${item.count}`;
            return (
              <span key={item.source}>
                {index > 0 && ', '}
                {path ? (
                  <Link className="font-medium underline underline-offset-2 hover:text-ink" to={path}>
                    {label}
                  </Link>
                ) : (
                  label
                )}
              </span>
            );
          })}
          .
        </>
      ),
    });
  }
  if (data.invalidReservations.length) {
    notices.push({
      tone: 'info',
      key: 'invalid',
      content: `${plural(data.invalidReservations.length, 'reserva tiene', 'reservas tienen')} fechas no válidas y no se dibuja${data.invalidReservations.length === 1 ? '' : 'n'}.`,
    });
  }
  if (groupMode === 'building' && !data.buildingsAvailable) {
    notices.push({ tone: 'info', key: 'buildings', content: 'No se pudieron leer los edificios: las propiedades aparecen como «Sin edificio asignado».' });
  }
  if (!notices.length) return null;
  return (
    <div className="space-y-2" role="status">
      {notices.map((notice) => (
        <p
          key={notice.key}
          className={cn(
            'flex gap-2 rounded-xl border px-3 py-2 text-sm leading-snug',
            notice.tone === 'danger' && 'border-danger/30 bg-tint-danger text-danger',
            notice.tone === 'warning' && 'border-warning/30 bg-tint-warning text-warning',
            notice.tone === 'info' && 'border-info/20 bg-tint-info text-info',
          )}
        >
          {notice.tone === 'info' ? <Info aria-hidden className="mt-0.5 h-4 w-4 shrink-0" /> : <AlertTriangle aria-hidden className="mt-0.5 h-4 w-4 shrink-0" />}
          <span>{notice.content}</span>
        </p>
      ))}
    </div>
  );
}

function BoardSkeleton() {
  return (
    <div aria-busy="true" aria-label="Cargando calendario" className="overflow-hidden rounded-2xl border border-line bg-surface">
      <div className="grid grid-cols-[9rem_repeat(7,1fr)] border-b border-line sm:grid-cols-[13rem_repeat(7,1fr)]">
        {Array.from({ length: 8 }, (_, index) => (
          <div key={index} className="space-y-1.5 border-l border-line p-2.5 first:border-l-0">
            <Skeleton className="h-3 w-10" />
            <Skeleton className="h-4 w-8" />
          </div>
        ))}
      </div>
      {Array.from({ length: 7 }, (_, row) => (
        <div key={row} className="grid grid-cols-[9rem_repeat(7,1fr)] border-b border-line last:border-b-0 sm:grid-cols-[13rem_repeat(7,1fr)]">
          <div className="space-y-1.5 border-r border-line p-3">
            <Skeleton className="h-3.5 w-3/4" />
            <Skeleton className="h-3 w-1/2" />
          </div>
          <div className="relative col-span-7 h-16">
            <Skeleton className="absolute top-2 h-6 rounded-md" style={{ left: `${((row * 3) % 9) + 4}%`, width: `${22 + ((row * 17) % 30)}%` }} />
            <Skeleton className="absolute bottom-2 h-5 w-[11%] rounded-md" style={{ left: `${((row * 5) % 7) * 13 + 1}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}

function EmptyState({ title, body, action }: { title: string; body: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-line bg-surface px-6 py-16 text-center">
      <p className="font-[Manrope,sans-serif] text-lg font-bold text-ink">{title}</p>
      <p className="max-w-md text-sm text-ink-2">{body}</p>
      {action}
    </div>
  );
}

export function GlobalCalendarPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const today = getMadridToday();
  const weekStart = resolveWeekStart(searchParams.get('semana'), today);
  const groupMode = parseGroup(searchParams.get('agrupar'));
  const days = useMemo(() => weekDaysFrom(weekStart), [weekStart]);
  const isMobile = useIsMobile();
  const [query, setQuery] = useState('');
  const deferredQuery = useDeferredValue(query);
  const [direction, setDirection] = useState<'forward' | 'backward' | 'none'>('none');
  const [selection, setSelection] = useState<CalendarSelection | null>(null);
  const detailOpen = useRef(false);
  const returnFocus = useRef<HTMLElement | null>(null);
  const calendar = useGlobalCalendar(weekStart);

  const setParam = useCallback(
    (name: string, value: string | null) => {
      setSearchParams(
        (current) => {
          const next = withoutSearchParam(current, name);
          if (value !== null) next.set(name, value);
          return next;
        },
        { replace: true },
      );
    },
    [setSearchParams],
  );

  const goToWeek = (monday: string) => {
    if (monday === weekStart) return;
    setDirection(monday > weekStart ? 'forward' : 'backward');
    setParam('semana', monday === resolveWeekStart(null, today) ? null : monday);
  };

  // El panel no tiene disparador propio: al cerrarlo, el foco vuelve al bloque que lo abrió.
  const openSelection = useCallback((next: CalendarSelection) => {
    if (!detailOpen.current) returnFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    detailOpen.current = true;
    setSelection(next);
  }, []);
  const closeSelection = useCallback(() => {
    detailOpen.current = false;
    setSelection(null);
  }, []);
  const restoreFocus = useCallback((event: Event) => {
    const target = returnFocus.current;
    if (target?.isConnected) {
      event.preventDefault();
      target.focus();
    }
  }, []);

  const data = calendar.data;
  const visibleDays = data ? weekDaysFrom(data.weekStart) : days;
  const groups = useMemo(() => {
    if (!data) return [];
    return groupRows(filterRows(data.week.rows, deferredQuery), groupMode);
  }, [data, deferredQuery, groupMode]);
  const visibleRows = groups.reduce((total, group) => total + group.rows.length, 0);
  const isCurrentWeek = weekStart === resolveWeekStart(null, today);

  return (
    <div className="mx-auto w-full max-w-[112rem] space-y-4 px-3 py-4 sm:px-6 sm:py-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-primary">Gestión{calendar.sedeName ? ` · ${calendar.sedeName}` : ''}</p>
          <h1 className="mt-1 font-[Manrope,sans-serif] text-2xl font-bold tracking-tight text-ink sm:text-[2rem]">Calendario global</h1>
          <p className="mt-1 max-w-2xl text-sm text-ink-2">
            Estancias registradas y limpiezas de todas las propiedades de la sede. Solo consulta: los cambios se hacen en cada apartado.
          </p>
        </div>
        <SedeSelector />
      </header>

      <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-line bg-surface/90 p-2 shadow-sm backdrop-blur">
        <div className="flex items-center gap-1">
          <Button variant="outline" size="icon" className="h-9 w-9 rounded-xl" aria-label="Semana anterior" onClick={() => goToWeek(shiftCivilDate(weekStart, -7))}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" className="h-9 rounded-xl px-3" disabled={isCurrentWeek} onClick={() => goToWeek(resolveWeekStart(null, today))}>
            Hoy
          </Button>
          <Button variant="outline" size="icon" className="h-9 w-9 rounded-xl" aria-label="Semana siguiente" onClick={() => goToWeek(shiftCivilDate(weekStart, 7))}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        <h2 aria-live="polite" className="flex items-center gap-2 px-1.5 font-[Manrope,sans-serif] text-lg font-bold tabular-nums tracking-tight text-ink">
          {formatWeekRange(days)}
          {(calendar.isSwitching || (calendar.isRefreshing && calendar.status === 'ready')) && (
            <Loader2 aria-label="Actualizando" className="h-4 w-4 text-ink-3 motion-safe:animate-spin" />
          )}
        </h2>
        <div className="flex w-full flex-wrap items-center gap-2 lg:ml-auto lg:w-auto">
          <label className="relative min-w-0 basis-full lg:w-72 lg:basis-auto">
            <span className="sr-only">Buscar en el calendario</span>
            <Search aria-hidden className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-3" />
            <Input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Propiedad, cliente o persona"
              className="h-9 rounded-xl border-line pl-9 pr-8 text-sm"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery('')}
                aria-label="Borrar búsqueda"
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-ink-3 outline-none hover:text-ink focus-visible:ring-2 focus-visible:ring-primary"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </label>
          <ToggleGroup
            type="single"
            value={groupMode}
            onValueChange={(value) => value && setParam('agrupar', value === 'building' ? null : GROUP_PARAM[value as GroupMode])}
            aria-label="Agrupar por"
            className="rounded-xl border border-line bg-paper p-0.5"
          >
            {(['building', 'client', 'none'] as GroupMode[]).map((mode) => (
              <ToggleGroupItem
                key={mode}
                value={mode}
                size="sm"
                className="h-8 rounded-[10px] px-2.5 text-xs font-medium text-ink-2 data-[state=on]:bg-surface data-[state=on]:text-ink data-[state=on]:shadow-sm motion-safe:transition"
              >
                {mode === 'building' ? 'Edificio' : mode === 'client' ? 'Cliente' : 'Sin agrupar'}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </div>
      </div>

      {calendar.status === 'error' && (
        <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-danger/30 bg-tint-danger px-4 py-3 text-sm text-danger">
          <span className="flex items-center gap-2">
            <AlertTriangle aria-hidden className="h-4 w-4" />
            No se pudo cargar el calendario. Comprueba la conexión y vuelve a intentarlo.
          </span>
          <Button variant="outline" size="sm" className="rounded-xl" onClick={calendar.refetch}>
            <RefreshCw aria-hidden className="mr-1.5 h-3.5 w-3.5" />
            Reintentar
          </Button>
        </div>
      )}

      {calendar.status === 'loading' && <BoardSkeleton />}

      {calendar.status === 'ready' && data && (
        <>
          <DataNotices data={data} groupMode={groupMode} />
          {data.week.rows.length === 0 && data.week.unplacedCleanings.length === 0 ? (
            <EmptyState title="No hay propiedades activas en esta sede" body="Cuando la sede tenga propiedades activas, aparecerán aquí con sus estancias y limpiezas." />
          ) : visibleRows === 0 && deferredQuery.trim() ? (
            <EmptyState
              title={`Ninguna propiedad coincide con «${deferredQuery.trim()}»`}
              body="Busca por nombre o código de la propiedad, edificio, cliente o persona asignada esta semana."
              action={
                <Button variant="outline" className="mt-2 rounded-xl" onClick={() => setQuery('')}>
                  Borrar búsqueda
                </Button>
              }
            />
          ) : (
            <GlobalCalendarBoard
              days={visibleDays}
              groups={groups}
              unplaced={deferredQuery.trim() ? [] : data.week.unplacedCleanings}
              today={today}
              groupMode={groupMode}
              cleaningsUnavailable={data.cleaningsState === 'error'}
              direction={direction}
              dimmed={calendar.isSwitching}
              onSelect={openSelection}
            />
          )}
        </>
      )}

      <GlobalCalendarDetail
        selection={selection}
        side={isMobile ? 'bottom' : 'right'}
        onClose={closeSelection}
        onSelect={setSelection}
        onCloseAutoFocus={restoreFocus}
      />
    </div>
  );
}
