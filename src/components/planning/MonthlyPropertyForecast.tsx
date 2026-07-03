import { useMemo, useState } from 'react';
import {
  AlertTriangle,
  Building2,
  CalendarRange,
  Loader2,
  Search,
  ShieldCheck,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useOperationalPlanningMonthlyForecast } from '@/hooks/useOperationalPlanning';
import { PlanningMonthlyForecastProperty } from '@/types/operationalPlanning';
import { cn } from '@/lib/utils';

const monthFormatter = new Intl.DateTimeFormat('es-ES', {
  month: 'long',
  year: 'numeric',
});

const currencyFormatter = new Intl.NumberFormat('es-ES', {
  style: 'currency',
  currency: 'EUR',
  maximumFractionDigits: 0,
});

const decimalFormatter = new Intl.NumberFormat('es-ES', {
  maximumFractionDigits: 1,
});

const toDateInput = (date: Date) => date.toISOString().slice(0, 10);

const getMonthStart = (date: Date) => new Date(date.getFullYear(), date.getMonth(), 1, 12);

const getMonthEnd = (date: Date, monthsAhead: number) => new Date(date.getFullYear(), date.getMonth() + monthsAhead + 1, 0, 12);

const formatMonthLabel = (monthKey: string) => {
  const date = new Date(`${monthKey}-01T12:00:00`);
  const label = monthFormatter.format(date);
  return label.charAt(0).toUpperCase() + label.slice(1);
};

const riskCopy: Record<PlanningMonthlyForecastProperty['riskLevel'], { label: string; className: string }> = {
  low: {
    label: 'Controlado',
    className: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  },
  medium: {
    label: 'Vigilar',
    className: 'border-amber-200 bg-amber-50 text-amber-700',
  },
  high: {
    label: 'Refuerzo',
    className: 'border-rose-200 bg-rose-50 text-rose-700',
  },
};

const sourceCopy = {
  confirmed: {
    label: 'Confirmado',
    className: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  },
  mixed: {
    label: 'Mixto',
    className: 'border-sky-200 bg-sky-50 text-sky-700',
  },
  pending: {
    label: 'Pendiente de tarea',
    className: 'border-amber-200 bg-amber-50 text-amber-700',
  },
};

const normalize = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

export const MonthlyPropertyForecast = () => {
  const currentMonthStart = useMemo(() => getMonthStart(new Date()), []);
  const [monthsAhead, setMonthsAhead] = useState('6');
  const [selectedMonth, setSelectedMonth] = useState<string>('all');
  const [query, setQuery] = useState('');
  const [riskFilter, setRiskFilter] = useState<'all' | PlanningMonthlyForecastProperty['riskLevel']>('all');
  const [hideEmpty, setHideEmpty] = useState(true);

  const monthCount = Number(monthsAhead);
  const dateFrom = toDateInput(currentMonthStart);
  const dateTo = toDateInput(getMonthEnd(currentMonthStart, Math.max(0, monthCount - 1)));
  const { data, isLoading, isError, error, refetch, isFetching } = useOperationalPlanningMonthlyForecast(dateFrom, dateTo);

  const filteredProperties = useMemo(() => {
    const normalizedQuery = normalize(query);
    return (data?.properties || [])
      .filter((property) => selectedMonth === 'all' || property.monthKey === selectedMonth)
      .filter((property) => riskFilter === 'all' || property.riskLevel === riskFilter)
      .filter((property) => !hideEmpty || property.cleanings > 0)
      .filter((property) => {
        if (!normalizedQuery) return true;
        return normalize(`${property.propertyCode} ${property.propertyName} ${property.clientName || ''} ${property.propertyGroupName || ''}`).includes(normalizedQuery);
      })
      .sort((a, b) =>
        b.cleanings - a.cleanings
        || b.sourceBreakdown.reservations - a.sourceBreakdown.reservations
        || b.totalRevenue - a.totalRevenue
        || a.propertyCode.localeCompare(b.propertyCode, 'es', { numeric: true, sensitivity: 'base' })
      );
  }, [data?.properties, hideEmpty, query, riskFilter, selectedMonth]);

  const selectedMonthSummary = useMemo(() => {
    if (!data || selectedMonth === 'all') return null;
    return data.months.find((month) => month.monthKey === selectedMonth) || null;
  }, [data, selectedMonth]);

  const visibleSummary = useMemo(() => {
    if (!data) return null;
    if (selectedMonthSummary) {
      return {
        cleanings: selectedMonthSummary.cleanings,
        taskCleanings: selectedMonthSummary.taskCleanings,
        reservationCleanings: selectedMonthSummary.reservationCleanings,
        totalRevenue: selectedMonthSummary.totalRevenue,
        totalHours: selectedMonthSummary.totalMinutes / 60,
        recommendedStaffPeak: selectedMonthSummary.recommendedStaff,
        pressureDays: selectedMonthSummary.pressureDays,
        activeProperties: selectedMonthSummary.activeProperties,
      };
    }
    return data.summary;
  }, [data, selectedMonthSummary]);

  const creationGap = visibleSummary && visibleSummary.cleanings > 0
    ? Math.round((visibleSummary.reservationCleanings / visibleSummary.cleanings) * 100)
    : 0;

  const errorMessage = error instanceof Error ? error.message : 'No se pudo cargar la previsión mensual.';

  return (
    <div className="space-y-4">
      <Card className="overflow-hidden border-[#310984]/10 bg-white">
        <CardContent className="p-0">
          <div className="grid gap-0 lg:grid-cols-[minmax(0,1fr)_320px]">
            <div className="p-5 sm:p-6">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.24em] text-[#310984]/70">Previsión mensual</p>
                  <h2 className="mt-2 text-2xl font-black text-slate-950 sm:text-3xl">Demanda por propiedad</h2>
                  <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
                    Combina limpiezas ya creadas en calendario con reservas futuras que todavía no tienen tarea. Lo estimado ayuda a planificar equipo, pero no bloquea agenda hasta crear la tarea.
                  </p>
                </div>
                <Button
                  variant="outline"
                  className="rounded-2xl"
                  onClick={() => refetch()}
                  disabled={isFetching}
                >
                  {isFetching ? <Loader2 className="h-4 w-4 animate-spin" /> : <CalendarRange className="h-4 w-4" />}
                  Actualizar
                </Button>
              </div>

              <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <ForecastMetric
                  label="Demanda total"
                  value={visibleSummary ? String(visibleSummary.cleanings) : '--'}
                  helper="Confirmado + previsto"
                  tone="sky"
                  icon={Building2}
                />
                <ForecastMetric
                  label="Tareas creadas"
                  value={visibleSummary ? String(visibleSummary.taskCleanings) : '--'}
                  helper="Ya existen en calendario"
                  tone="emerald"
                  icon={ShieldCheck}
                />
                <ForecastMetric
                  label="Reservas sin tarea"
                  value={visibleSummary ? String(visibleSummary.reservationCleanings) : '--'}
                  helper="Demanda pendiente"
                  tone="amber"
                  icon={AlertTriangle}
                />
                <ForecastMetric
                  label="Brecha creación"
                  value={visibleSummary ? `${creationGap}%` : '--'}
                  helper="Pendiente de convertir"
                  tone="violet"
                  icon={CalendarRange}
                />
              </div>

              {visibleSummary && visibleSummary.reservationCleanings > 0 && (
                <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-900">
                  Hay {visibleSummary.reservationCleanings} limpieza{visibleSummary.reservationCleanings === 1 ? '' : 's'} prevista{visibleSummary.reservationCleanings === 1 ? '' : 's'} por reservas que aún no tienen tarea creada. Úsalas para preparar personal, pero revisa la creación de tareas antes de cerrar el plan.
                </div>
              )}
            </div>

            <div className="border-t border-[#310984]/10 bg-[#160333] p-5 text-white sm:p-6 lg:border-l lg:border-t-0">
              <p className="text-xs font-black uppercase tracking-[0.24em] text-white/50">Lectura rápida</p>
              <div className="mt-4 space-y-3">
                <InsightLine label="Rango" value={`${formatMonthLabel(dateFrom.slice(0, 7))} - ${formatMonthLabel(dateTo.slice(0, 7))}`} />
                <InsightLine label="Propiedades activas" value={visibleSummary ? String(visibleSummary.activeProperties) : '--'} />
                <InsightLine label="Facturación" value={visibleSummary ? currencyFormatter.format(visibleSummary.totalRevenue) : '--'} />
                <InsightLine label="Horas" value={visibleSummary ? `${decimalFormatter.format(visibleSummary.totalHours)} h` : '--'} />
                <InsightLine label="Equipo pico" value={visibleSummary ? String(visibleSummary.recommendedStaffPeak) : '--'} />
                <InsightLine label="Días de presión" value={visibleSummary ? String(visibleSummary.pressureDays) : '--'} />
              </div>
              <div className="mt-5 rounded-2xl border border-white/10 bg-white/8 p-4 text-sm leading-6 text-white/75">
                Si una propiedad marca refuerzo, no significa que esté mal: significa que conviene preparar titulares, suplentes o agenda antes de que el mes llegue encima.
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="gap-4">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
            <div>
              <CardTitle className="text-xl font-black">Propiedades y meses</CardTitle>
              <CardDescription>Filtra por mes, riesgo o edificio para decidir qué propiedades necesitan cobertura con antelación.</CardDescription>
            </div>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4 xl:min-w-[780px]">
              <Select value={monthsAhead} onValueChange={setMonthsAhead}>
                <SelectTrigger className="rounded-xl">
                  <SelectValue placeholder="Meses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="3">Próximos 3 meses</SelectItem>
                  <SelectItem value="6">Próximos 6 meses</SelectItem>
                  <SelectItem value="9">Próximos 9 meses</SelectItem>
                  <SelectItem value="12">Próximos 12 meses</SelectItem>
                </SelectContent>
              </Select>
              <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                <SelectTrigger className="rounded-xl">
                  <SelectValue placeholder="Mes" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los meses</SelectItem>
                  {(data?.months || []).map((month) => (
                    <SelectItem key={month.monthKey} value={month.monthKey}>{month.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={riskFilter} onValueChange={(value) => setRiskFilter(value as typeof riskFilter)}>
                <SelectTrigger className="rounded-xl">
                  <SelectValue placeholder="Riesgo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los estados</SelectItem>
                  <SelectItem value="high">Solo refuerzo</SelectItem>
                  <SelectItem value="medium">Solo vigilar</SelectItem>
                  <SelectItem value="low">Controlado</SelectItem>
                </SelectContent>
              </Select>
              <Button
                type="button"
                variant={hideEmpty ? 'default' : 'outline'}
                className="rounded-xl"
                onClick={() => setHideEmpty((current) => !current)}
              >
                {hideEmpty ? 'Con limpiezas' : 'Todas'}
              </Button>
            </div>
          </div>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Buscar propiedad, edificio o cliente..."
              className="rounded-2xl pl-10"
            />
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex min-h-72 flex-col items-center justify-center gap-3 rounded-3xl border border-dashed border-slate-300 bg-slate-50 text-sm text-slate-500">
              <Loader2 className="h-6 w-6 animate-spin text-[#310984]" />
              Calculando meses, propiedades, horas y capacidad...
            </div>
          ) : isError ? (
            <div className="rounded-3xl border border-rose-200 bg-rose-50 p-6 text-sm text-rose-800">
              <p className="font-black">No se pudo cargar la previsión.</p>
              <p className="mt-2">{errorMessage}</p>
            </div>
          ) : filteredProperties.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-slate-300 bg-slate-50 p-6 text-sm text-slate-600">
              <p className="font-black text-slate-950">No hay propiedades para esta vista.</p>
              <p className="mt-2 leading-6">Prueba a cambiar el mes, quitar filtros o mostrar también propiedades sin limpiezas previstas.</p>
            </div>
          ) : (
            <div className="grid gap-3">
              {filteredProperties.map((property) => (
                <PropertyForecastRow key={`${property.propertyId}-${property.monthKey}`} property={property} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

const ForecastMetric = ({
  label,
  value,
  helper,
  tone,
  icon: Icon,
}: {
  label: string;
  value: string;
  helper: string;
  tone: 'sky' | 'emerald' | 'violet' | 'amber';
  icon: typeof Building2;
}) => {
  const tones = {
    sky: 'border-sky-200 bg-sky-50 text-sky-700',
    emerald: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    violet: 'border-violet-200 bg-violet-50 text-violet-700',
    amber: 'border-amber-200 bg-amber-50 text-amber-700',
  };

  return (
    <div className={cn('rounded-2xl border p-4', tones[tone])}>
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-black uppercase tracking-[0.2em]">{label}</p>
        <Icon className="h-4 w-4" />
      </div>
      <p className="mt-3 text-2xl font-black text-slate-950">{value}</p>
      <p className="mt-1 text-xs font-medium text-slate-600">{helper}</p>
    </div>
  );
};

const InsightLine = ({ label, value }: { label: string; value: string }) => (
  <div className="flex items-center justify-between gap-4 rounded-2xl border border-white/10 bg-white/8 px-4 py-3">
    <span className="text-xs font-black uppercase tracking-[0.18em] text-white/45">{label}</span>
    <span className="text-sm font-black text-white">{value}</span>
  </div>
);

const PropertyForecastRow = ({ property }: { property: PlanningMonthlyForecastProperty }) => {
  const risk = riskCopy[property.riskLevel];
  const source = property.sourceBreakdown.tasks > 0 && property.sourceBreakdown.reservations > 0
    ? sourceCopy.mixed
    : property.sourceBreakdown.reservations > 0
      ? sourceCopy.pending
      : sourceCopy.confirmed;

  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-[#310984]/20 hover:shadow-md">
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,1.8fr)_260px] xl:items-center">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="truncate text-xl font-black text-slate-950">{property.propertyCode}</p>
            <Badge variant="outline" className={cn('rounded-full', risk.className)}>{risk.label}</Badge>
            <Badge variant="outline" className={cn('rounded-full', source.className)}>{source.label}</Badge>
          </div>
          <p className="mt-1 truncate text-sm font-semibold text-slate-600">{property.propertyName}</p>
          <p className="mt-1 truncate text-xs text-slate-500">
            {property.propertyGroupName || 'Sin edificio'}{property.clientName ? ` - ${property.clientName}` : ''}
          </p>
          <p className="mt-3 text-xs font-black uppercase tracking-[0.18em] text-[#310984]/70">{property.monthLabel}</p>
        </div>

        <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
          <MiniStat label="Demanda" value={String(property.cleanings)} />
          <MiniStat label="Creadas" value={String(property.sourceBreakdown.tasks)} />
          <MiniStat label="Sin tarea" value={String(property.sourceBreakdown.reservations)} />
          <MiniStat label="Horas" value={`${decimalFormatter.format(property.totalHours)} h`} />
          <MiniStat label="Facturación" value={currencyFormatter.format(property.totalRevenue)} />
          <MiniStat label="Equipo" value={String(property.recommendedStaff)} />
        </div>

        <div className="space-y-3 rounded-2xl border border-slate-100 bg-slate-50 p-3">
          <div className="flex items-center gap-2 text-sm font-bold text-slate-900">
            {property.riskLevel === 'high' ? <AlertTriangle className="h-4 w-4 text-rose-500" /> : <ShieldCheck className="h-4 w-4 text-emerald-500" />}
            Lectura operativa
          </div>
          <div className="flex flex-wrap gap-2 text-xs font-bold text-slate-600">
            <span className="rounded-full bg-white px-3 py-1">Salida: {property.checkoutCleanings}</span>
            <span className="rounded-full bg-white px-3 py-1">Huésped: {property.stayCleanings}</span>
            {(property.sourceBreakdown.hotelStay + property.sourceBreakdown.hotelCheckout) > 0 && (
              <span className="rounded-full bg-white px-3 py-1">
                Hotel: {property.sourceBreakdown.hotelStay + property.sourceBreakdown.hotelCheckout}
              </span>
            )}
          </div>
          {property.riskReasons.length === 0 ? (
            <p className="text-sm leading-5 text-slate-600">Carga controlada para este mes.</p>
          ) : (
            <ul className="space-y-1 text-sm leading-5 text-slate-600">
              {property.riskReasons.slice(0, 3).map((reason) => (
                <li key={reason}>- {reason}</li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
};

const MiniStat = ({ label, value }: { label: string; value: string }) => (
  <div className="rounded-2xl border border-slate-100 bg-slate-50 p-3">
    <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">{label}</p>
    <p className="mt-1 text-base font-black text-slate-950">{value}</p>
  </div>
);
