import { Link, useSearchParams } from 'react-router-dom';
import { AlertTriangle, Boxes, ClipboardCheck, ExternalLink, History, Loader2, Shirt, Sparkles, TriangleAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useRolePermissions } from '@/hooks/useRolePermissions';
import { cn } from '@/lib/utils';
import {
  ACTIVITY_PARAMS, ACTIVITY_PERIODS, ACTIVITY_SOURCES, ACTIVITY_WINDOW_DAYS, activityDetailHref, civilLabel, parseActivityType, parsePeriod, sourceLabel,
  type ActivityEvent, type ActivityKind, type ActivityTone,
} from './propertyActivityModel';
import { usePropertyActivity } from './usePropertyActivity';

const KIND_ICON: Record<ActivityKind, typeof Sparkles> = { cleaning: Sparkles, incident: TriangleAlert, supervision: ClipboardCheck, laundry: Shirt, inventory: Boxes };
const TONE: Record<ActivityTone, string> = {
  neutral: 'border-slate-200 bg-slate-50 text-slate-700',
  success: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  warning: 'border-amber-200 bg-amber-50 text-amber-800',
  danger: 'border-red-200 bg-red-50 text-red-700',
  info: 'border-sky-200 bg-sky-50 text-sky-800',
};

const dayHeading = (day: string) => new Intl.DateTimeFormat('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${day}T12:00:00Z`));
const rangeLabel = (from: string, to: string) => `${civilLabel(from)}–${civilLabel(to)}`;

function EventItem({ event, href }: { event: ActivityEvent; href: string | null }) {
  const Icon = KIND_ICON[event.kind];
  const time = event.time ? (event.timeKind === 'planned' ? `Prevista ${event.time}` : event.time) : 'Sin hora';
  return (
    <li className="relative flex gap-3 rounded-xl border border-slate-200 bg-white p-3 sm:p-4">
      <span aria-hidden="true" className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-violet-50 text-[#310984]"><Icon className="h-4 w-4" /></span>
      <div className="min-w-0 flex-1 space-y-1.5">
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
          <h5 className="min-w-0 break-words text-sm font-semibold text-slate-900">{event.title}</h5>
          <span className={cn('shrink-0 text-xs tabular-nums', event.timeKind === 'recorded' ? 'font-semibold text-slate-700' : 'text-slate-500')} title={event.timeKind === 'planned' ? 'Hora prevista del servicio, no un momento registrado' : event.time ? 'Momento registrado' : 'La fuente solo conoce el día'}>{time}</span>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600">
          <span className="rounded-full bg-slate-100 px-2 py-0.5 font-medium">{sourceLabel(event.source)}</span>
          {event.status && <span className={cn('rounded-full border px-2 py-0.5 font-medium', TONE[event.status.tone])}>{event.status.label}</span>}
          {event.actor && <span className="break-words">{event.actor}</span>}
        </div>
        {event.summary && <p className="break-words text-sm text-slate-700">{event.summary}</p>}
        {event.lines.length > 0 && <dl className="grid gap-x-4 gap-y-1 text-xs sm:grid-cols-2">
          {event.lines.map(line => <div key={line.label} className="flex min-w-0 gap-1.5"><dt className="shrink-0 text-slate-500">{line.label}:</dt><dd className="min-w-0 break-words text-slate-800">{line.value}</dd></div>)}
        </dl>}
        {event.detail && (href
          ? <Link to={href} className="inline-flex min-h-9 items-center gap-1.5 rounded-lg text-sm font-medium text-[#310984] underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#310984] focus-visible:ring-offset-2">{event.detail.label}<ExternalLink aria-hidden="true" className="h-3.5 w-3.5" /></Link>
          : <p className="text-xs text-slate-500">Sin acceso al registro original con tu perfil.</p>)}
      </div>
    </li>
  );
}

export function PropertyActivityPanel({ propertyId, propertyName }: { propertyId: string; propertyName: string }) {
  const [params, setParams] = useSearchParams();
  const { hasPermission } = useRolePermissions();
  const period = parsePeriod(params.get(ACTIVITY_PARAMS.period));
  const type = parseActivityType(params.get(ACTIVITY_PARAMS.type));
  const loaded = Math.max(1, Number.parseInt(params.get(ACTIVITY_PARAMS.windows) || '1', 10) || 1);
  const activity = usePropertyActivity(propertyId, period, type, loaded);
  const setParam = (changes: Record<string, string | null>) => setParams(current => {
    const next = new URLSearchParams();
    current.forEach((value, key) => { if (!(key in changes)) next.append(key, value); });
    Object.entries(changes).forEach(([key, value]) => { if (value) next.set(key, value); });
    return next;
  }, { replace: true });
  const can = (module: 'calendar' | 'reports' | 'inventory') => hasPermission(module, 'canView');
  const firstLoad = activity.settledWindows === 0;

  return (
    <section aria-labelledby="property-activity-title" className="space-y-4 rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 id="property-activity-title" className="flex items-center gap-2 text-sm font-semibold text-[#310984]"><History aria-hidden="true" className="h-4 w-4" />Actividad</h3>
          <p className="mt-1 text-sm text-slate-600">Registros de {propertyName}, del más reciente al más antiguo.</p>
        </div>
        <Select value={period} onValueChange={value => setParam({ [ACTIVITY_PARAMS.period]: value, [ACTIVITY_PARAMS.windows]: null })}>
          <SelectTrigger aria-label="Periodo de actividad" className="w-full rounded-xl bg-white sm:w-48"><SelectValue /></SelectTrigger>
          <SelectContent>{ACTIVITY_PERIODS.map(item => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}</SelectContent>
        </Select>
      </div>

      <div role="group" aria-label="Tipo de actividad" className="flex flex-wrap gap-2">
        {[{ id: 'all', label: 'Todo' }, ...ACTIVITY_SOURCES].map(item => (
          <Button key={item.id} type="button" size="sm" variant={type === item.id ? 'default' : 'outline'} aria-pressed={type === item.id} className="min-h-9 rounded-full"
            onClick={() => setParam({ [ACTIVITY_PARAMS.type]: item.id === 'all' ? null : item.id })}>{item.label}</Button>
        ))}
      </div>

      <details className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">
        <summary className="cursor-pointer font-medium text-slate-700">Qué se muestra y qué no</summary>
        <ul className="mt-2 list-disc space-y-1 pl-4">
          <li>Las limpiezas aparecen el día del servicio con su hora prevista; el reporte aporta las horas reales de inicio y fin.</li>
          <li>El personal mostrado es la asignación actual: no hay historial de quién asignó ni cuándo.</li>
          <li>Lavandería guarda la última hora de cada paso (preparar, entregar, recoger, deshacer); repeticiones anteriores no se conservan.</li>
          <li>Solo se incluyen movimientos de inventario atribuidos a esta propiedad; los generales del almacén o del edificio no.</li>
          <li>Las supervisiones e inventarios de edificio sin apartamento concreto no se atribuyen a cada propiedad.</li>
        </ul>
      </details>

      <div aria-live="polite" className="space-y-2">
        {activity.nothingConsultable && <p role="status" className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">Tu perfil no permite consultar {type === 'all' ? 'ninguna fuente de actividad' : `«${sourceLabel(type)}»`}.</p>}
        {!activity.nothingConsultable && activity.restricted.length > 0 && <p role="status" className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">Sin permiso para consultar: {activity.restricted.map(sourceLabel).join(', ')}. No se muestran esos registros.</p>}
        {activity.failures.length > 0 && <div role="alert" className="flex flex-wrap items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          <AlertTriangle aria-hidden="true" className="h-4 w-4 shrink-0" />
          <span className="min-w-0 flex-1">No se ha podido consultar {activity.failures.map(gap => `${sourceLabel(gap.source)} (${rangeLabel(gap.from, gap.to)})`).join(', ')}. El resto de la actividad sí se muestra; puede faltar información.</span>
          <Button type="button" size="sm" variant="outline" onClick={activity.retry}>Reintentar</Button>
        </div>}
        {activity.truncated.length > 0 && <p role="status" className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">Hay demasiados registros de {activity.truncated.map(gap => `${sourceLabel(gap.source)} (${rangeLabel(gap.from, gap.to)})`).join(', ')}: solo se muestran los más recientes de ese tramo.</p>}
      </div>

      {!activity.nothingConsultable && (firstLoad ? (
        <p role="status" className="flex items-center gap-2 py-6 text-sm text-slate-600"><Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />
          {activity.ready ? `Cargando actividad${activity.pendingSources.length ? `: ${activity.pendingSources.map(sourceLabel).join(', ')}` : ''}…` : 'Preparando la sede…'}</p>
      ) : (
        <>
          {activity.confirmedEmpty && <p role="status" className="rounded-lg border border-dashed border-slate-300 p-4 text-sm text-slate-600">No hay actividad registrada{type === 'all' ? '' : ` de «${sourceLabel(type)}»`} entre el {civilLabel(activity.shownFrom as string)} y hoy.</p>}
          {activity.eventCount === 0 && !activity.confirmedEmpty && <p role="status" className="rounded-lg border border-dashed border-slate-300 p-4 text-sm text-slate-600">No se muestran registros en las fuentes que han respondido. Revisa los avisos: no equivale a ausencia de actividad.</p>}
          <ol aria-label="Actividad por días" className="space-y-5">
            {activity.groups.map(group => (
              <li key={group.day}>
                <h4 className="sticky top-14 z-[1] mb-2 bg-slate-50/95 py-1 text-xs font-semibold uppercase tracking-wide text-slate-500 first-letter:uppercase">{dayHeading(group.day)}</h4>
                <ul className="space-y-2">{group.events.map(event => <EventItem key={event.id} event={event} href={event.detail ? activityDetailHref(event.detail, can) : null} />)}</ul>
              </li>
            ))}
          </ol>
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3 text-xs text-slate-500">
            <span>Mostrando desde el {civilLabel(activity.shownFrom as string)}.</span>
            {activity.loadingWindow ? <span role="status" className="flex items-center gap-2"><Loader2 aria-hidden="true" className="h-3.5 w-3.5 animate-spin" />Cargando {rangeLabel(activity.loadingWindow.from, activity.loadingWindow.to)}…</span>
              : activity.canLoadMore ? <Button type="button" size="sm" variant="outline" onClick={() => setParam({ [ACTIVITY_PARAMS.windows]: String(activity.settledWindows + 1) })}>Cargar {ACTIVITY_WINDOW_DAYS} días anteriores</Button>
                : <span>Inicio del periodo seleccionado ({civilLabel(activity.periodStart as string)}).</span>}
          </div>
        </>
      ))}
    </section>
  );
}
