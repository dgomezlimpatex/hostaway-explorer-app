import { useMemo, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  BarChart3,
  Building2,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  Clock3,
  Download,
  FileText,
  Search,
  Settings2,
  ShieldAlert,
  SlidersHorizontal,
  UsersRound,
} from 'lucide-react';
import {
  Bar,
  CartesianGrid,
  Cell,
  ComposedChart,
  Line,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useSede } from '@/contexts/SedeContext';
import { useAuth } from '@/hooks/useAuth';
import { useCleaners } from '@/hooks/useCleaners';
import { useCurrentWeekWorkload } from '@/hooks/useWorkloadCalculation';
import { useTasks } from '@/hooks/useTasks';
import { useAllWorkerAbsencesForDate } from '@/hooks/useWorkerAbsences';
import { useOperationalAnalytics } from '@/hooks/analytics/useOperationalAnalytics';
import { useCleaningPlanningBuildingData } from '@/hooks/useCleaningPlanningBuildingData';
import { formatMadridDate } from '@/utils/date';
import { getTaskAssignedCleanerIds } from '@/utils/taskAssignments';
import type { Task } from '@/types/calendar';
import type { PropertyGroup } from '@/types/propertyGroups';
import { cn } from '@/lib/utils';

const SKY = '#2d8cb8';
const TURQUOISE = '#28b8b0';
const ROSE = '#e56b7c';

const cardClass = 'rounded-2xl border border-[#dfe7f0] bg-white shadow-[0_8px_24px_rgba(16,42,70,0.04)]';
const mutedText = 'text-[#6a7d91]';

type StaffingOperationalScreen = 'home' | 'forecast' | 'team' | 'shifts' | 'centers' | 'reports' | 'settings';

const screenHref = (screen: StaffingOperationalScreen) => `/staffing-forecast/screens/${screen}`;

function formatHours(value: number | null | undefined, fallback = '—') {
  if (value === null || value === undefined || !Number.isFinite(value)) return fallback;
  return `${value.toLocaleString('es-ES', { maximumFractionDigits: 1 })} h`;
}

function formatNumber(value: number | null | undefined, fallback = '—') {
  if (value === null || value === undefined || !Number.isFinite(value)) return fallback;
  return value.toLocaleString('es-ES', { maximumFractionDigits: 0 });
}

function minutesForTask(task: Task) {
  const value = Number(task.duration || task.propertyDurationMinutes || 60);
  return Number.isFinite(value) && value > 0 ? value : 60;
}

function assignedTask(task: Task) {
  return getTaskAssignedCleanerIds(task).length > 0 || Boolean(task.cleanerId || task.cleaner);
}

function parseClock(value?: string | null) {
  if (!value) return null;
  const match = value.match(/^(\d{1,2}):(\d{2})/);
  if (!match) return null;
  return Number(match[1]) * 60 + Number(match[2]);
}

function addDays(dateKey: string, amount: number) {
  const date = new Date(`${dateKey}T12:00:00`);
  date.setDate(date.getDate() + amount);
  return formatMadridDate(date);
}

function startOfWeek(date: Date) {
  const value = new Date(date);
  const day = value.getDay();
  value.setDate(value.getDate() - (day === 0 ? 6 : day - 1));
  return formatMadridDate(value);
}

function dateLabel(dateKey: string, options: Intl.DateTimeFormatOptions = { day: '2-digit', month: 'short' }) {
  return new Date(`${dateKey}T12:00:00`).toLocaleDateString('es-ES', options);
}

function ScreenHeader({
  number,
  title,
  strapline,
  description,
  actions,
}: {
  number: string;
  title: string;
  strapline: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <header className="mb-7 flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
      <div>
        <p className="mb-2 text-[11px] font-black uppercase tracking-[0.2em] text-[#67809a]">{number}</p>
        <h1 className="text-3xl font-black tracking-tight text-[#102a46] sm:text-4xl">{title}</h1>
        {description && <p className={`mt-2 max-w-2xl text-sm ${mutedText}`}>{description}</p>}
      </div>
      <div className="flex flex-col items-start gap-3 lg:items-end">
        <p className="text-base font-semibold text-[#2d8cb8] lg:text-right">{strapline}</p>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
    </header>
  );
}

function OperationalFrame({ children }: { children: ReactNode }) {
  return <div className="min-h-full bg-[#f5f8fb] text-[#102a46]"><div className="mx-auto w-full max-w-[1540px] px-4 py-6 sm:px-7 lg:px-10 lg:py-8">{children}<footer className="mt-10 border-t border-[#dfe7f0] pt-6"><div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between"><div><p className="text-xs font-black uppercase tracking-[0.2em] text-[#67809a]">Del dato al impacto</p><p className="mt-1 text-sm text-[#6a7d91]">Una misma lectura para decidir, planificar y revisar.</p></div><div className="grid grid-cols-2 gap-3 sm:grid-cols-4"><span className="inline-flex items-center gap-2 text-xs font-bold text-[#38536b]"><i className="grid h-7 w-7 place-items-center rounded-full bg-[#2d8cb8] text-white not-italic">1</i>Decidir</span><span className="inline-flex items-center gap-2 text-xs font-bold text-[#38536b]"><i className="grid h-7 w-7 place-items-center rounded-full bg-[#28b8b0] text-white not-italic">2</i>Planificar</span><span className="inline-flex items-center gap-2 text-xs font-bold text-[#38536b]"><i className="grid h-7 w-7 place-items-center rounded-full bg-[#e8a83e] text-white not-italic">3</i>Revisar</span><span className="inline-flex items-center gap-2 text-xs font-bold text-[#38536b]"><i className="grid h-7 w-7 place-items-center rounded-full bg-[#e56b7c] text-white not-italic">4</i>Configurar</span></div></div></footer></div></div>;
}

function MetricCard({
  label,
  value,
  helper,
  icon: Icon,
  tone = 'blue',
}: {
  label: string;
  value: ReactNode;
  helper: string;
  icon: typeof AlertTriangle;
  tone?: 'blue' | 'turquoise' | 'rose' | 'amber' | 'slate';
}) {
  const tones = {
    blue: 'border-[#c9e0ef] bg-[#eef8fc] text-[#1b668d]',
    turquoise: 'border-[#b9e6e0] bg-[#effcf9] text-[#127d76]',
    rose: 'border-[#f2cbd3] bg-[#fff1f4] text-[#a63750]',
    amber: 'border-[#f1dfb8] bg-[#fff8e7] text-[#966719]',
    slate: 'border-[#dfe7f0] bg-[#f8fafc] text-[#5f7287]',
  } as const;
  return (
    <article className={cn('rounded-2xl border p-4', tones[tone])}>
      <div className="flex items-start justify-between gap-3">
        <p className="text-[11px] font-black uppercase tracking-[0.14em]">{label}</p>
        <Icon className="h-5 w-5 opacity-70" aria-hidden="true" />
      </div>
      <p className="mt-3 text-3xl font-black tracking-tight text-[#102a46]">{value}</p>
      <p className="mt-1 text-xs text-[#687b90]">{helper}</p>
    </article>
  );
}

function DataNote({ children }: { children: ReactNode }) {
  return <p className="mt-4 rounded-xl border border-dashed border-[#cbd9e5] bg-[#f8fbfd] px-3 py-2 text-xs text-[#718397]">{children}</p>;
}

function QuickLink({ to, icon: Icon, children }: { to: string; icon: typeof CalendarDays; children: ReactNode }) {
  return <Link to={to} className="group flex min-h-20 items-center gap-3 rounded-xl border border-[#dfe7f0] bg-white p-4 transition hover:-translate-y-0.5 hover:border-[#9fcde2] hover:shadow-md"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#edf6fb] text-[#2d8cb8]"><Icon className="h-5 w-5" /></span><span className="flex-1 text-sm font-bold text-[#183650]">{children}</span><ChevronRight className="h-4 w-4 text-[#91a6b8] transition group-hover:translate-x-1" /></Link>;
}

export function OperationalHomeScreen() {
  const { profile } = useAuth();
  const today = useMemo(() => new Date(), []);
  const todayKey = formatMadridDate(today);
  const { activeSede } = useSede();
  const { cleaners = [], isLoading: cleanersLoading } = useCleaners();
  const { tasks = [], isLoading: tasksLoading } = useTasks(today, 'week');
  const { alerts, isLoading: workloadLoading } = useWorkerAlertsForHome();
  const absencesQuery = useAllWorkerAbsencesForDate(todayKey);
  const todayTasks = useMemo(() => tasks.filter(task => task.date === todayKey), [tasks, todayKey]);
  const unassigned = todayTasks.filter(task => !assignedTask(task)).length;
  const activePeople = new Set(todayTasks.flatMap(task => getTaskAssignedCleanerIds(task))).size;
  const urgent = unassigned;
  const risk = alerts.length;
  const absenceCount = absencesQuery.data?.length;
  const loading = tasksLoading || cleanersLoading || workloadLoading;
  const displayName = profile?.full_name?.split(' ')[0] || 'equipo';

  return (
    <OperationalFrame>
      <ScreenHeader number="1 · Inicio" title={`Buenos días, ${displayName}`} strapline="Decide hoy. Opera mejor." description={`Resumen de la operación de hoy en ${activeSede?.nombre || 'la sede activa'} · ${dateLabel(todayKey, { weekday: 'long', day: '2-digit', month: 'long' })}.`} />
      <section className="grid gap-4 md:grid-cols-3" aria-label="Alertas de hoy">
        <MetricCard label="Alertas urgentes" value={loading ? '…' : formatNumber(urgent)} helper={urgent ? 'Tareas que todavía necesitan responsable' : 'No hay tareas pendientes de asignar'} icon={AlertTriangle} tone="rose" />
        <MetricCard label="Tareas en riesgo" value={loading ? '…' : formatNumber(risk)} helper={risk ? 'Requieren atención' : 'Sin alertas de jornada calculadas'} icon={ShieldAlert} tone="amber" />
        <MetricCard label="Ausencias hoy" value={absencesQuery.isLoading ? '…' : formatNumber(absenceCount)} helper={absencesQuery.isError ? 'No se pudo consultar la fuente' : 'Buscar sustitución'} icon={UsersRound} tone="slate" />
      </section>
      <section className="mt-4 grid gap-4 md:grid-cols-3" aria-label="Estado operativo">
        <MetricCard label="Turnos hoy" value={tasksLoading ? '…' : formatNumber(todayTasks.length)} helper="Tareas leídas para la fecha actual" icon={CalendarDays} tone="blue" />
        <MetricCard label="Personal en servicio" value={tasksLoading ? '…' : formatNumber(activePeople)} helper={`${cleaners.length} personas visibles en la ficha`} icon={UsersRound} tone="turquoise" />
        <MetricCard label="Tareas sin asignar" value={tasksLoading ? '…' : formatNumber(unassigned)} helper={unassigned ? 'Revisa Turnos antes de cerrar el día' : 'Todas tienen responsable registrado'} icon={Clock3} tone="rose" />
      </section>
      <section className="mt-7 grid gap-5 lg:grid-cols-[1.35fr_1fr]">
        <article className={`${cardClass} p-5 sm:p-6`}>
          <div className="flex items-start justify-between gap-4"><div><p className="text-xs font-black uppercase tracking-[0.16em] text-[#7890a5]">Atención</p><h2 className="mt-1 text-xl font-black text-[#102a46]">Lo que necesita una decisión</h2></div><AlertTriangle className="h-6 w-6 text-[#e8a83e]" /></div>
          <div className="mt-5 space-y-3">
            {unassigned > 0 && <Link to={screenHref('shifts')} className="flex items-center justify-between rounded-xl border border-[#f2cbd3] bg-[#fff5f6] p-3 text-sm"><span><strong>{unassigned} tareas sin asignar</strong><span className="ml-2 text-[#7a6870]">Abrir Turnos</span></span><ArrowRight className="h-4 w-4 text-[#a63750]" /></Link>}
            {risk > 0 && <Link to={screenHref('team')} className="flex items-center justify-between rounded-xl border border-[#f1dfb8] bg-[#fffaf0] p-3 text-sm"><span><strong>{risk} personas con horas pendientes</strong><span className="ml-2 text-[#7c6c4b]">Revisar Equipo</span></span><ArrowRight className="h-4 w-4 text-[#966719]" /></Link>}
            {unassigned === 0 && risk === 0 && <div className="flex items-center gap-3 rounded-xl border border-[#b9e6e0] bg-[#f1fcf9] p-4 text-sm text-[#276e67]"><CheckCircle2 className="h-5 w-5" />No hay avisos operativos calculados para hoy.</div>}
          </div>
        </article>
        <article className={`${cardClass} p-5 sm:p-6`}>
          <p className="text-xs font-black uppercase tracking-[0.16em] text-[#7890a5]">Accesos rápidos</p>
          <h2 className="mt-1 text-xl font-black text-[#102a46]">Ir directamente a la decisión</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-1"><QuickLink to={screenHref('shifts')} icon={CalendarDays}>Asignar turnos</QuickLink><QuickLink to={screenHref('team')} icon={UsersRound}>Ver equipo</QuickLink><QuickLink to={screenHref('centers')} icon={Building2}>Revisar centros</QuickLink><QuickLink to={screenHref('reports')} icon={BarChart3}>Generar informe</QuickLink></div>
        </article>
      </section>
      <DataNote>Las cifras se leen del backend de la sede activa. Cuando una fuente no responde se muestra «—» o un aviso: no se interpreta como ausencia de trabajo.</DataNote>
    </OperationalFrame>
  );
}

function useWorkerAlertsForHome() {
  const { workersOverview, alerts, isLoading } = useCurrentWeekWorkloadForAlerts();
  return { workersOverview, alerts, isLoading };
}

function useCurrentWeekWorkloadForAlerts() {
  const query = useCurrentWeekWorkload();
  const alerts = useMemo(() => (query.data || []).filter(item => item.status === 'deficit' || item.status === 'critical-deficit' || item.overtimeHours > 5), [query.data]);
  return { workersOverview: query.data || [], alerts, isLoading: query.isLoading };
}

export function OperationalForecastScreen() {
  const today = useMemo(() => new Date(), []);
  const todayKey = formatMadridDate(today);
  const monday = startOfWeek(today);
  const [period, setPeriod] = useState<'weekly' | 'monthly'>('weekly');
  const { activeSede } = useSede();
  const { cleaners = [], isLoading: cleanersLoading } = useCleaners();
  const { tasks = [], isLoading: tasksLoading } = useTasks(today, 'week');
  const { data: workload = [], isLoading: workloadLoading } = useCurrentWeekWorkload();
  const realWorkers = cleaners.filter(cleaner => Number(cleaner.contractHoursPerWeek || 0) > 0);
  const contractHours = realWorkers.reduce((total, cleaner) => total + Number(cleaner.contractHoursPerWeek || 0), 0);
  const chartDays = useMemo(() => Array.from({ length: 7 }, (_, index) => addDays(monday, index)), [monday]);
  const weeklyChart = useMemo(() => chartDays.map((dateKey, index) => {
    const demand = tasks.filter(task => task.date === dateKey).reduce((total, task) => total + minutesForTask(task), 0) / 60;
    const capacity = contractHours / 5;
    return { key: dateKey, label: dateLabel(dateKey, { weekday: 'short' }).replace('.', ''), demand: Number(demand.toFixed(1)), capacity: Number(capacity.toFixed(1)), deficit: Number(Math.max(0, demand - capacity).toFixed(1)), index };
  }), [chartDays, contractHours, tasks]);
  const monthlyChart = useMemo(() => Array.from({ length: 4 }, (_, index) => {
    const start = addDays(monday, index * 7);
    const end = addDays(start, 6);
    const demand = tasks.filter(task => task.date >= start && task.date <= end).reduce((total, task) => total + minutesForTask(task), 0) / 60;
    return { key: start, label: `Sem. ${index + 1}`, demand: Number(demand.toFixed(1)), capacity: Number(contractHours.toFixed(1)), deficit: Number(Math.max(0, demand - contractHours).toFixed(1)) };
  }), [contractHours, monday, tasks]);
  const chartData = period === 'weekly' ? weeklyChart : monthlyChart;
  const demandHours = chartData.reduce((sum, row) => sum + row.demand, 0);
  const capacityHours = chartData.reduce((sum, row) => sum + row.capacity, 0);
  const deficitHours = Math.max(0, demandHours - capacityHours);
  const atRisk = workload.filter(worker => worker.status === 'deficit' || worker.status === 'critical-deficit').length;
  const loading = cleanersLoading || tasksLoading || workloadLoading;

  return (
    <OperationalFrame>
      <ScreenHeader number="2 · Previsión de personal" title="Demanda vs. capacidad" strapline="Anticipa. Evita incidencias." description={`Lectura de la sede ${activeSede?.nombre || 'activa'} a fecha ${dateLabel(todayKey, { day: '2-digit', month: 'long', year: 'numeric' })}.`} actions={<Link className="rounded-xl border border-[#c9dce8] bg-white px-4 py-2 text-sm font-bold text-[#245f80] hover:bg-[#f2f9fc]" to="/staffing-forecast">Abrir previsión detallada</Link>} />
      <section className={`${cardClass} p-5 sm:p-6`}>
        <div className="flex flex-col gap-4 border-b border-[#edf1f5] pb-5 sm:flex-row sm:items-center sm:justify-between"><div><h2 className="text-lg font-black">Demanda vs. capacidad</h2><p className={`mt-1 text-sm ${mutedText}`}>Las tareas sin asignar siguen contando como carga.</p></div><div className="flex rounded-xl bg-[#f0f4f8] p-1" role="group" aria-label="Periodo de previsión"><button type="button" onClick={() => setPeriod('weekly')} className={cn('rounded-lg px-4 py-2 text-sm font-bold', period === 'weekly' ? 'bg-[#1d4e84] text-white shadow-sm' : 'text-[#67809a]')}>Semanal</button><button type="button" onClick={() => setPeriod('monthly')} className={cn('rounded-lg px-4 py-2 text-sm font-bold', period === 'monthly' ? 'bg-[#1d4e84] text-white shadow-sm' : 'text-[#67809a]')}>Mensual</button></div></div>
        <div className="mt-6 h-[300px] w-full"><ResponsiveContainer width="100%" height="100%"><ComposedChart data={chartData} margin={{ top: 10, right: 14, left: 0, bottom: 4 }}><CartesianGrid stroke="#e6edf3" strokeDasharray="3 3" vertical={false} /><XAxis dataKey="label" tick={{ fill: '#6a7d91', fontSize: 12 }} axisLine={false} tickLine={false} /><YAxis tick={{ fill: '#6a7d91', fontSize: 12 }} axisLine={false} tickLine={false} tickFormatter={(value: number) => `${value}h`} /><Tooltip formatter={(value: number, name: string) => [`${value} h`, name === 'demand' ? 'Demanda' : name === 'capacity' ? 'Capacidad prevista' : 'Déficit']} contentStyle={{ borderRadius: 12, borderColor: '#dfe7f0' }} /><Bar dataKey="demand" name="Demanda" fill={SKY} radius={[5, 5, 0, 0]} barSize={period === 'weekly' ? 24 : 38} /><Bar dataKey="capacity" name="Capacidad prevista" fill={TURQUOISE} radius={[5, 5, 0, 0]} barSize={period === 'weekly' ? 24 : 38} /><Line type="monotone" dataKey="deficit" name="Déficit" stroke={ROSE} strokeWidth={3} dot={{ r: 4, fill: ROSE, strokeWidth: 2, stroke: '#fff' }} /></ComposedChart></ResponsiveContainer></div>
        <div className="mt-4 flex flex-wrap gap-5 text-xs font-semibold text-[#617594]"><span className="inline-flex items-center gap-2"><i className="h-3 w-3 rounded-sm bg-[#2d8cb8]" />Demanda de horas</span><span className="inline-flex items-center gap-2"><i className="h-3 w-3 rounded-sm bg-[#28b8b0]" />Capacidad prevista</span><span className="inline-flex items-center gap-2"><i className="h-3 w-3 rounded-full bg-[#e56b7c]" />Déficit</span></div>
      </section>
      <section className="mt-5 grid gap-4 md:grid-cols-2"><MetricCard label="Déficit de horas" value={loading ? '…' : `-${formatHours(deficitHours, '0 h').replace('-', '')}`} helper="Diferencia visible en el periodo seleccionado" icon={AlertTriangle} tone="rose" /><MetricCard label="Personas en riesgo" value={loading ? '…' : formatNumber(atRisk)} helper="Se calcula con la jornada de ficha, nunca con disponibilidad" icon={UsersRound} tone="amber" /></section>
      <DataNote>La capacidad se muestra como referencia distribuida desde las horas contractuales de las fichas con más de 0 h. La previsión detallada aplica además libranzas, ausencias, mantenimiento, movilidad y el margen operativo del 20 %.</DataNote>
    </OperationalFrame>
  );
}

export function OperationalTeamScreen() {
  const today = useMemo(() => new Date(), []);
  const todayKey = formatMadridDate(today);
  const { activeSede } = useSede();
  const { cleaners = [], isLoading, error, refetch } = useCleaners();
  const { data: workload = [], isLoading: workloadLoading } = useCurrentWeekWorkload();
  const absencesQuery = useAllWorkerAbsencesForDate(todayKey);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<'active' | 'all'>('active');
  const [center, setCenter] = useState('all');
  const summaries = useMemo(() => new Map(workload.map(item => [item.cleanerId, item])), [workload]);
  const centers = useMemo(() => Array.from(new Set(cleaners.map(item => item.delegationName || item.officeName).filter(Boolean))).sort(), [cleaners]);
  const absenceIds = useMemo(() => new Set((absencesQuery.data || []).map(item => item.cleanerId)), [absencesQuery.data]);
  const visible = cleaners.filter(worker => {
    const haystack = `${worker.name} ${worker.category || ''} ${worker.delegationName || ''} ${worker.officeName || ''}`.toLocaleLowerCase();
    return (status === 'all' || worker.isActive) && (!search || haystack.includes(search.toLocaleLowerCase())) && (center === 'all' || (worker.delegationName || worker.officeName) === center);
  });

  return (
    <OperationalFrame>
      <ScreenHeader number="3 · Equipo" title="Personal" strapline="Conoce a tu equipo. Toma mejores decisiones." description={`Jornadas, horas pendientes y ausencias de ${activeSede?.nombre || 'la sede activa'}.`} actions={<Link className="rounded-xl bg-[#1d4e84] px-4 py-2 text-sm font-bold text-white hover:bg-[#163b64]" to="/workers">Abrir ficha completa</Link>} />
      <section className={`${cardClass} overflow-hidden`}>
        <div className="flex flex-col gap-3 border-b border-[#edf1f5] p-5 sm:flex-row sm:items-center sm:justify-between"><div><h2 className="text-lg font-black">Personal</h2><p className={`mt-1 text-sm ${mutedText}`}>{visible.length} personas visibles · las fichas de 0 h no entran en la previsión.</p></div><div className="flex flex-wrap gap-2"><label className="relative"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#91a6b8]" /><input aria-label="Buscar por nombre" className="h-10 w-full rounded-xl border border-[#dfe7f0] pl-9 pr-3 text-sm outline-none focus:border-[#2d8cb8] sm:w-56" placeholder="Buscar por nombre…" value={search} onChange={event => setSearch(event.target.value)} /></label><select aria-label="Filtrar centro" className="h-10 rounded-xl border border-[#dfe7f0] bg-white px-3 text-sm" value={center} onChange={event => setCenter(event.target.value)}><option value="all">Todos los centros</option>{centers.map(value => <option key={value} value={value}>{value}</option>)}</select><select aria-label="Filtrar estado" className="h-10 rounded-xl border border-[#dfe7f0] bg-white px-3 text-sm" value={status} onChange={event => setStatus(event.target.value as 'active' | 'all')}><option value="active">Activo</option><option value="all">Todo el equipo</option></select></div></div>
        {error ? <div role="alert" className="p-8 text-sm text-[#a63750]">No se pudo consultar el equipo. <button className="font-bold underline" type="button" onClick={() => void refetch()}>Reintentar</button></div> : isLoading ? <div role="status" className="p-8 text-sm text-[#6a7d91]">Cargando equipo…</div> : <div className="overflow-x-auto"><table className="min-w-[720px] w-full text-left text-sm"><thead className="bg-[#f8fafc] text-[11px] font-black uppercase tracking-[0.12em] text-[#73869a]"><tr><th className="px-5 py-4">Nombre</th><th className="px-4 py-4">H. contrato</th><th className="px-4 py-4">H. trabajadas</th><th className="px-4 py-4">H. pendientes</th><th className="px-4 py-4">Ausencias</th><th className="px-4 py-4">Día libre sugerido</th></tr></thead><tbody className="divide-y divide-[#edf1f5]">{visible.map(worker => { const summary = summaries.get(worker.id); const risk = summary?.status === 'deficit' || summary?.status === 'critical-deficit'; return <tr key={worker.id} className="hover:bg-[#fbfdff]"><td className="px-5 py-4"><Link to={`/workers/${worker.id}`} className="font-bold text-[#183650] hover:text-[#2d8cb8] hover:underline">{worker.name}</Link><span className="mt-1 block text-xs text-[#7b8da0]">{worker.category || 'Operario de limpieza'}</span></td><td className="px-4 py-4 font-semibold text-[#38536b]">{formatHours(worker.contractHoursPerWeek || 0)}</td><td className="px-4 py-4 text-[#38536b]">{workloadLoading ? '…' : formatHours(summary?.totalWorked)}</td><td className={cn('px-4 py-4 font-bold', risk ? 'text-[#a63750]' : 'text-[#38536b]')}>{workloadLoading ? '…' : formatHours(summary?.remainingHours)}</td><td className="px-4 py-4">{absencesQuery.isLoading ? '…' : absenceIds.has(worker.id) ? 'Registrada' : '—'}</td><td className="px-4 py-4 text-[#38536b]">{'—'}</td></tr>; })}</tbody></table>{!visible.length && <div className="p-10 text-center text-sm text-[#6a7d91]">No hay personas con estos filtros.</div>}</div>}
      </section>
      <DataNote>Las horas contractuales salen exclusivamente de `cleaners.contract_hours_per_week`. Los trabajadores con 0 h permanecen visibles en Equipo, pero quedan fuera de capacidad y candidaturas.</DataNote>
    </OperationalFrame>
  );
}

export function OperationalShiftsScreen() {
  const initialDate = useMemo(() => formatMadridDate(new Date()), []);
  const [date, setDate] = useState(initialDate);
  const [center, setCenter] = useState('all');
  const selectedDate = useMemo(() => new Date(`${date}T12:00:00`), [date]);
  const { tasks = [], isLoading, error } = useTasks(selectedDate, 'day');
  const centers = useMemo(() => Array.from(new Set(tasks.map(task => task.address || task.property || 'Centro sin nombre'))).sort(), [tasks]);
  const visible = tasks.filter(task => center === 'all' || (task.address || task.property || 'Centro sin nombre') === center);
  const grouped = useMemo(() => { const groups = new Map<string, Task[]>(); visible.forEach(task => { const key = task.address || task.property || 'Centro sin nombre'; groups.set(key, [...(groups.get(key) || []), task]); }); return Array.from(groups.entries()); }, [visible]);
  const moveDate = (amount: number) => setDate(addDays(date, amount));

  return (
    <OperationalFrame>
      <ScreenHeader number="4 · Turnos" title="Turnos" strapline="Organiza hoy el servicio de mañana." description="Consulta la carga por centro y abre el calendario diario para hacer la asignación definitiva." actions={<Link className="inline-flex items-center gap-2 rounded-xl bg-[#1d4e84] px-4 py-2 text-sm font-bold text-white hover:bg-[#163b64]" to={`/calendar?date=${date}`}><CalendarDays className="h-4 w-4" />Abrir asignador definitivo</Link>} />
      <section className={`${cardClass} p-4 sm:p-5`}>
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between"><div className="flex items-center gap-2"><button type="button" aria-label="Día anterior" className="rounded-lg border border-[#dfe7f0] p-2 hover:bg-[#f5f8fb]" onClick={() => moveDate(-1)}><ArrowLeft className="h-4 w-4" /></button><label className="flex items-center gap-2 rounded-xl border border-[#dfe7f0] bg-white px-3 py-2 text-sm font-bold"><CalendarDays className="h-4 w-4 text-[#2d8cb8]" /><input aria-label="Fecha de turnos" type="date" value={date} onChange={event => setDate(event.target.value)} /></label><button type="button" aria-label="Día siguiente" className="rounded-lg border border-[#dfe7f0] p-2 hover:bg-[#f5f8fb]" onClick={() => moveDate(1)}><ArrowRight className="h-4 w-4" /></button><span className="ml-1 text-sm font-bold capitalize text-[#38536b]">{dateLabel(date, { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })}</span></div><select aria-label="Filtrar centro de turnos" className="h-10 rounded-xl border border-[#dfe7f0] bg-white px-3 text-sm" value={center} onChange={event => setCenter(event.target.value)}><option value="all">Todos los centros</option>{centers.map(value => <option key={value} value={value}>{value}</option>)}</select></div>
        <div className="mt-6 overflow-x-auto"><div className="min-w-[780px]"><div className="grid grid-cols-[180px_1fr] items-end text-[11px] font-black uppercase tracking-[0.1em] text-[#7a8c9e]"><div className="pb-3">Centro</div><div className="grid grid-cols-6 border-b border-[#dfe7f0] pb-3">{[11, 12, 13, 14, 15, 16].map(hour => <span key={hour} className="text-center">{String(hour).padStart(2, '0')}:00</span>)}</div></div>{isLoading ? <div role="status" className="p-10 text-center text-sm text-[#6a7d91]">Cargando turnos…</div> : error ? <div role="alert" className="p-10 text-sm text-[#a63750]">No se pudieron cargar los turnos. <button type="button" className="font-bold underline" onClick={() => window.location.reload()}>Reintentar</button></div> : !grouped.length ? <div className="p-10 text-center text-sm text-[#6a7d91]">No hay tareas para este día o filtro.</div> : grouped.map(([group, groupTasks]) => <div key={group} className="grid grid-cols-[180px_1fr] border-b border-[#edf1f5]"><div className="flex min-h-16 items-center gap-2 pr-4 text-sm font-black text-[#183650]"><Building2 className="h-4 w-4 shrink-0 text-[#2d8cb8]" /><span className="truncate">{group}</span></div><div className="relative min-h-16 border-l border-[#edf1f5] bg-[#fbfdff]" style={{ backgroundImage: 'linear-gradient(to right, transparent calc(16.666% - 1px), #edf1f5 16.666%, transparent calc(16.666% + 1px), transparent calc(33.333% - 1px), #edf1f5 33.333%, transparent calc(33.333% + 1px), transparent calc(50% - 1px), #edf1f5 50%, transparent calc(50% + 1px), transparent calc(66.666% - 1px), #edf1f5 66.666%, transparent calc(66.666% + 1px), transparent calc(83.333% - 1px), #edf1f5 83.333%, transparent calc(83.333% + 1px))' }}>{groupTasks.slice(0, 8).map(task => { const assigned = assignedTask(task); const start = parseClock(task.startTime) ?? 660; const end = parseClock(task.endTime) ?? start + minutesForTask(task); const safeStart = Math.max(660, Math.min(1020, start)); const safeEnd = Math.max(safeStart + 20, Math.min(1020, end)); const left = ((safeStart - 660) / 360) * 100; const width = ((safeEnd - safeStart) / 360) * 100; return <Link key={task.id} to={`/calendar?date=${task.date}&task=${task.id}`} className={cn('absolute top-3 block min-w-[74px] truncate rounded-lg border px-2 py-2 text-left text-[11px] font-bold shadow-sm transition hover:z-10 hover:-translate-y-0.5', assigned ? 'border-[#9fd8d3] bg-[#dff7f3] text-[#176d68]' : 'border-dashed border-[#d96a7c] bg-[#fff1f4] text-[#a63750]')} style={{ left: `${left}%`, width: `${width}%` }}><span className="block truncate">{task.type || 'Limpieza general'}</span><span className="mt-1 block truncate text-[10px] font-medium">{assigned ? task.cleaner || 'Asignada' : 'Sin asignar'}</span></Link>; })}</div></div>)}</div></div>
        <div className="mt-5 flex flex-wrap gap-4 text-xs font-semibold text-[#6a7d91]"><span className="inline-flex items-center gap-2"><i className="h-3 w-3 rounded-full bg-[#28b8b0]" />Asignado</span><span className="inline-flex items-center gap-2"><i className="h-3 w-3 rounded-full border border-dashed border-[#e56b7c] bg-[#fff1f4]" />Sin asignar</span><span className="ml-auto text-[#8b9cad]">Selecciona un bloque para abrir el asignador diario.</span></div>
      </section>
    </OperationalFrame>
  );
}

function centerPriority(group: PropertyGroup) {
  if (group.difficultyLevel && group.difficultyLevel >= 3) return { label: 'Alta', className: 'bg-[#fff1f4] text-[#a63750]' };
  if (group.difficultyLevel && group.difficultyLevel === 2) return { label: 'Media', className: 'bg-[#fff8e7] text-[#966719]' };
  if (group.difficultyLevel && group.difficultyLevel === 1) return { label: 'Baja', className: 'bg-[#eef4f8] text-[#5f7287]' };
  return { label: 'Por revisar', className: 'bg-[#f2f5f8] text-[#6a7d91]' };
}

export function OperationalCentersScreen() {
  const { data, isLoading, isError, refetch } = useCleaningPlanningBuildingData();
  const { cleaners = [] } = useCleaners();
  const [tab, setTab] = useState<'all' | 'priority' | 'coverage'>('all');
  const [activeOnly, setActiveOnly] = useState(true);
  const cleanerMap = useMemo(() => new Map(cleaners.map(cleaner => [cleaner.id, cleaner.name])), [cleaners]);
  const cards = useMemo(() => { const groups = data?.propertyGroups || []; return groups.filter(group => !activeOnly || group.isActive).map(group => { const assignments = (data?.cleanerAssignments || []).filter(item => item.propertyGroupId === group.id && item.roleType !== 'excluded'); const properties = (data?.propertyAssignments || []).filter(item => item.propertyGroupId === group.id); const priority = centerPriority(group); const primary = assignments.filter(item => !item.roleType || item.roleType === 'primary').map(item => cleanerMap.get(item.cleanerId)).filter(Boolean) as string[]; const secondary = assignments.filter(item => item.roleType === 'secondary').map(item => cleanerMap.get(item.cleanerId)).filter(Boolean) as string[]; const backup = assignments.filter(item => item.roleType === 'backup').map(item => cleanerMap.get(item.cleanerId)).filter(Boolean) as string[]; return { group, assignments, properties, priority, primary, secondary, backup }; }).filter(item => tab === 'all' || (tab === 'priority' ? item.priority.label === 'Alta' : item.primary.length === 0 || item.secondary.length === 0 || item.backup.length === 0)); }, [activeOnly, cleanerMap, data?.cleanerAssignments, data?.propertyAssignments, data?.propertyGroups, tab]);

  return (
    <OperationalFrame>
      <ScreenHeader number="5 · Centros" title="Centros" strapline="Cada centro, siempre cubierto." description="Edificios, propiedades y prioridades de cobertura para decidir con contexto." actions={<Link className="rounded-xl border border-[#c9dce8] bg-white px-4 py-2 text-sm font-bold text-[#245f80] hover:bg-[#f2f9fc]" to="/planning/buildings">Abrir configuración de centros</Link>} />
      <section className="mb-5 flex flex-wrap items-center justify-between gap-3"><div className="flex flex-wrap gap-2 rounded-xl bg-white p-1 shadow-sm"><button type="button" className={cn('rounded-lg px-4 py-2 text-sm font-bold', tab === 'all' ? 'bg-[#1d4e84] text-white' : 'text-[#67809a]')} onClick={() => setTab('all')}>Todos</button><button type="button" className={cn('rounded-lg px-4 py-2 text-sm font-bold', tab === 'coverage' ? 'bg-[#1d4e84] text-white' : 'text-[#67809a]')} onClick={() => setTab('coverage')}>Grupos de propiedades</button><button type="button" className={cn('rounded-lg px-4 py-2 text-sm font-bold', tab === 'priority' ? 'bg-[#1d4e84] text-white' : 'text-[#67809a]')} onClick={() => setTab('priority')}>Por prioridad</button></div><label className="flex items-center gap-2 text-sm font-semibold text-[#5f7287]"><input type="checkbox" checked={activeOnly} onChange={event => setActiveOnly(event.target.checked)} />Activos</label></section>
      {isLoading ? <div role="status" className={`${cardClass} p-10 text-center text-sm ${mutedText}`}>Cargando centros…</div> : isError ? <div role="alert" className={`${cardClass} p-10 text-sm text-[#a63750]`}>No se pudieron cargar los centros. <button className="font-bold underline" type="button" onClick={() => void refetch()}>Reintentar</button></div> : !cards.length ? <div className={`${cardClass} p-10 text-center text-sm ${mutedText}`}>No hay centros con estos filtros.</div> : <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">{cards.map(item => <article key={item.group.id} className={`${cardClass} overflow-hidden`}><div className="relative flex h-28 items-end justify-between overflow-hidden bg-[linear-gradient(135deg,#b9d8e2,#f1f9fb_48%,#8db2c3)] p-4"><div aria-hidden="true" className="absolute -right-3 -top-8 h-32 w-32 rounded-full border-[18px] border-white/25" /><span className="relative rounded-full bg-white/85 px-2.5 py-1 text-[11px] font-black uppercase tracking-[0.12em] text-[#245f80]">{item.group.internalCode || 'Centro'}</span><Building2 className="relative h-12 w-12 text-white/85" /></div><div className="p-4"><div className="flex items-start justify-between gap-3"><div><h2 className="text-base font-black text-[#183650]">{item.group.displayName || item.group.name}</h2><p className={`mt-1 text-xs ${mutedText}`}>{item.group.zone || item.group.clientName || 'Zona pendiente'}</p></div><span className={cn('rounded-full px-2.5 py-1 text-[11px] font-black', item.priority.className)}>{item.priority.label}</span></div><div className="mt-4 grid grid-cols-2 gap-2 text-xs"><div className="rounded-xl bg-[#f8fafc] p-2.5"><span className="block text-[#7b8da0]">Propiedades</span><strong className="mt-1 block text-[#183650]">{item.properties.length}</strong></div><div className="rounded-xl bg-[#f8fafc] p-2.5"><span className="block text-[#7b8da0]">Equipo</span><strong className="mt-1 block text-[#183650]">{item.assignments.length}</strong></div></div><div className="mt-4 space-y-2 text-xs"><p><span className="font-bold text-[#5f7287]">Titular:</span> {item.primary.join(', ') || 'Sin titular configurado'}</p><p><span className="font-bold text-[#5f7287]">Suplente:</span> {item.secondary.join(', ') || 'Sin suplente configurado'}</p><p><span className="font-bold text-[#5f7287]">Backup:</span> {item.backup.join(', ') || 'Sin backup configurado'}</p><p className="flex items-center gap-2"><span className="font-bold text-[#5f7287]">Movilidad:</span><span className="inline-flex items-center gap-1 text-[#7b8da0]"><i className="h-2 w-2 rounded-full bg-[#d79a35]" />No verificada</span></p></div><Link to={`/planning/buildings/${item.group.id}`} className="mt-4 inline-flex items-center gap-1 text-sm font-black text-[#2d8cb8] hover:underline">Ver centro <ChevronRight className="h-4 w-4" /></Link></div></article>)}</div>}
      <DataNote>La prioridad se muestra solo cuando existe el nivel de dificultad configurado en el centro. Movilidad no se deduce por nombres: se revisa en la ficha de asignaciones.</DataNote>
    </OperationalFrame>
  );
}

function reportMonthKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

export function OperationalReportsScreen() {
  const today = useMemo(() => new Date(), []);
  const [month, setMonth] = useState(reportMonthKey(today));
  const [tab, setTab] = useState<'summary' | 'hours' | 'deficits' | 'absences'>('summary');
  const start = useMemo(() => { const date = new Date(`${month}-01T12:00:00`); date.setMonth(date.getMonth() - 5); return date; }, [month]);
  const { data, isLoading, error, refetch } = useOperationalAnalytics({ start, end: today });
  const actualHours = data ? data.propertyEstimations.reduce((total, item) => total + item.avgActualMinutes * item.taskCount, 0) / 60 : null;
  const estimatedHours = data ? data.propertyEstimations.reduce((total, item) => total + item.estimatedMinutes * item.taskCount, 0) / 60 : null;
  const trend = useMemo(() => { const rows = Array.from({ length: 5 }, (_, index) => { const date = new Date(`${month}-01T12:00:00`); date.setMonth(date.getMonth() - (4 - index)); const key = reportMonthKey(date); const label = date.toLocaleDateString('es-ES', { month: 'short' }).replace('.', ''); return { key, label, actual: 0, estimated: 0 }; }); (data?.propertyEstimations || []).forEach(item => item.tasks.forEach(task => { const key = reportMonthKey(task.taskDate); const row = rows.find(candidate => candidate.key === key); if (row) { row.actual += item.avgActualMinutes / 60; row.estimated += item.estimatedMinutes / 60; } })); return rows.map(row => ({ ...row, actual: Number(row.actual.toFixed(1)), estimated: Number(row.estimated.toFixed(1)) })); }, [data?.propertyEstimations, month]);
  const efficiency = data?.summary.avgEfficiency ? Math.min(100, Math.max(0, data.summary.avgEfficiency)) : 0;
  const ringData = [{ name: 'Eficiencia medida', value: efficiency, color: TURQUOISE }, { name: 'Pendiente de revisar', value: 100 - efficiency, color: '#e8eef3' }];

  return (
    <OperationalFrame>
      <ScreenHeader number="6 · Informes" title="Informes" strapline="Convierte datos en mejores decisiones." description="Históricos y comparativas de carga con las fuentes que la aplicación puede verificar." actions={<button type="button" onClick={() => window.print()} className="inline-flex items-center gap-2 rounded-xl bg-[#1d4e84] px-4 py-2 text-sm font-bold text-white hover:bg-[#163b64]"><Download className="h-4 w-4" />Exportar</button>} />
      <section className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div className="flex flex-wrap gap-1 rounded-xl bg-white p-1 shadow-sm">{([['summary', 'Resumen'], ['hours', 'Horas'], ['deficits', 'Déficits'], ['absences', 'Ausencias']] as const).map(([value, label]) => <button key={value} type="button" className={cn('rounded-lg px-4 py-2 text-sm font-bold', tab === value ? 'bg-[#1d4e84] text-white' : 'text-[#67809a]')} onClick={() => setTab(value)}>{label}</button>)}</div><label className="flex items-center gap-2 rounded-xl border border-[#dfe7f0] bg-white px-3 py-2 text-sm font-bold text-[#38536b]">Periodo<input type="month" value={month} onChange={event => setMonth(event.target.value)} className="border-0 bg-transparent text-sm outline-none" /></label></section>
      {error ? <div role="alert" className={`${cardClass} p-8 text-sm text-[#a63750]`}>No se pudieron cargar los informes. <button type="button" className="font-bold underline" onClick={() => void refetch()}>Reintentar</button></div> : isLoading ? <div role="status" className={`${cardClass} p-10 text-center text-sm ${mutedText}`}>Analizando datos…</div> : tab === 'summary' ? <><section className="grid gap-4 md:grid-cols-3"><MetricCard label="Horas pagadas sin trabajo" value="—" helper="La fuente histórica no está consolidada" icon={Clock3} tone="rose" /><MetricCard label="Déficit de horas" value="—" helper="No se calcula sin una jornada histórica conciliada" icon={AlertTriangle} tone="rose" /><MetricCard label="Coste estimado" value="—" helper="No se calcula sin tarifa histórica verificable" icon={BarChart3} tone="turquoise" /></section><section className="mt-5 grid gap-4 lg:grid-cols-[1.35fr_1fr]"><article className={`${cardClass} p-4 sm:p-5`}><div className="flex items-center justify-between gap-3"><div><h2 className="text-lg font-black">Evolución mensual de horas</h2><p className={`mt-1 text-xs ${mutedText}`}>Horas trabajadas y previstas según partes disponibles.</p></div><span className="text-sm font-black text-[#127d76]">{actualHours === null ? '—' : `${actualHours.toFixed(0)} h`}</span></div><div className="mt-4 h-[250px]"><ResponsiveContainer width="100%" height="100%"><ComposedChart data={trend} margin={{ top: 10, right: 8, left: -18, bottom: 0 }}><CartesianGrid stroke="#e6edf3" strokeDasharray="3 3" vertical={false} /><XAxis dataKey="label" tick={{ fill: '#718092', fontSize: 11 }} axisLine={false} tickLine={false} /><YAxis tick={{ fill: '#718092', fontSize: 11 }} axisLine={false} tickLine={false} /><Tooltip formatter={(value: number, name: string) => [`${value} h`, name === 'actual' ? 'Horas trabajadas' : 'Horas previstas']} /><Bar dataKey="actual" name="Horas trabajadas" fill={SKY} radius={[4, 4, 0, 0]} barSize={18} /><Bar dataKey="estimated" name="Horas previstas" fill={TURQUOISE} radius={[4, 4, 0, 0]} barSize={18} /></ComposedChart></ResponsiveContainer></div><div className="mt-2 flex flex-wrap gap-4 text-xs font-semibold text-[#718092]"><span className="inline-flex items-center gap-2"><i className="h-3 w-3 rounded-sm bg-[#2d8cb8]" />Horas trabajadas</span><span className="inline-flex items-center gap-2"><i className="h-3 w-3 rounded-sm bg-[#28b8b0]" />Horas previstas</span></div></article><article className={`${cardClass} p-4 sm:p-5`}><h2 className="text-lg font-black">Distribución de horas</h2><p className={`mt-1 text-xs ${mutedText}`}>Eficiencia medida sobre los partes disponibles.</p><div className="relative mt-3 h-[250px]"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={ringData} dataKey="value" nameKey="name" innerRadius={68} outerRadius={92} paddingAngle={2} startAngle={90} endAngle={-270}>{ringData.map(item => <Cell key={item.name} fill={item.color} />)}</Pie><Tooltip formatter={(value: number) => [`${value.toFixed(0)}%`, 'Proporción']} /></PieChart></ResponsiveContainer><div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center"><strong className="text-3xl font-black text-[#23376d]">{actualHours === null ? '—' : actualHours.toFixed(0)}</strong><span className="text-xs font-semibold text-[#718092]">horas</span></div></div><div className="space-y-2 text-xs text-[#718092]"><p className="flex items-center justify-between"><span className="inline-flex items-center gap-2"><i className="h-2.5 w-2.5 rounded-full bg-[#28b8b0]" />Trabajo efectivo</span><strong>{Math.round(efficiency)}%</strong></p><p className="flex items-center justify-between"><span className="inline-flex items-center gap-2"><i className="h-2.5 w-2.5 rounded-full bg-[#e8eef3]" />Pendiente de revisar</span><strong>{Math.round(100 - efficiency)}%</strong></p><p className="text-[11px]">Horas previstas estimadas: {estimatedHours === null ? '—' : `${estimatedHours.toFixed(0)} h`}</p></div></article></section></> : <ReportDetailTab tab={tab} data={data} />}
      <DataNote>«Coste estimado» y «Horas pagadas sin trabajo» no se rellenan con estimaciones inventadas: aparecerán cuando exista una fuente histórica consolidada con tarifa y jornada.</DataNote>
    </OperationalFrame>
  );
}

function ReportDetailTab({ tab, data }: { tab: 'hours' | 'deficits' | 'absences'; data: NonNullable<ReturnType<typeof useOperationalAnalytics>['data']> | undefined }) {
  if (tab === 'hours') return <section className={`${cardClass} overflow-hidden`}><div className="border-b border-[#edf1f5] p-5"><h2 className="text-lg font-black">Horas</h2><p className={`mt-1 text-sm ${mutedText}`}>Rendimiento de personas con partes cerrados.</p></div><div className="divide-y divide-[#edf1f5]">{(data?.cleanerPerformance || []).slice(0, 12).map(worker => <div key={worker.cleanerId} className="flex flex-wrap items-center justify-between gap-3 p-4"><span className="font-bold text-[#183650]">{worker.cleanerName}</span><span className="text-sm text-[#6a7d91]">{worker.taskCount} partes · {worker.avgTaskDuration.toFixed(0)} min de media · {worker.avgEfficiency.toFixed(0)}% eficiencia</span></div>)}{!data?.cleanerPerformance?.length && <p className="p-8 text-sm text-[#6a7d91]">No hay partes cerrados para comparar.</p>}</div></section>;
  if (tab === 'deficits') return <section className={`${cardClass} p-5`}><h2 className="text-lg font-black">Déficits</h2><p className={`mt-1 text-sm ${mutedText}`}>Centros y personas que requieren revisión según los datos disponibles.</p><div className="mt-5 grid gap-3 sm:grid-cols-2">{(data?.propertyEstimations || []).filter(item => item.status !== 'accurate').slice(0, 12).map(item => <div key={item.propertyId} className="rounded-xl border border-[#f1dfb8] bg-[#fffaf0] p-4"><strong className="block text-[#183650]">{item.propertyName}</strong><span className="mt-1 block text-xs text-[#7c6c4b]">{item.differencePercentage.toFixed(0)}% de diferencia · {item.taskCount} partes</span></div>)}{!data?.propertyEstimations?.some(item => item.status !== 'accurate') && <p className="text-sm text-[#6a7d91]">No hay déficits medidos en este periodo.</p>}</div></section>;
  return <section className={`${cardClass} p-5`}><h2 className="text-lg font-black">Ausencias</h2><p className={`mt-1 text-sm ${mutedText}`}>La fuente de ausencias se consulta desde Equipo y se mantiene separada de los partes operativos.</p><div className="mt-5 rounded-xl border border-dashed border-[#cbd9e5] bg-[#f8fbfd] p-5 text-sm text-[#6a7d91]">Selecciona Equipo para consultar ausencias, libranzas y recomendaciones por persona.</div></section>;
}

export function OperationalSettingsScreen() {
  const settings = [
    { title: 'Franjas de cliente', description: 'Define las ventanas horarias por tipo de cliente.', icon: Clock3, to: '/planning-settings?tab=rules' },
    { title: 'Duración de propiedades', description: 'Configura tiempos estimados por tipo de tarea y centro.', icon: Building2, to: '/planning-settings?tab=properties' },
    { title: 'Previsión semanal +20%', description: 'Ajusta el incremento de demanda por semana.', icon: BarChart3, to: '/planning-settings?tab=forecast' },
    { title: 'Reglas de trabajo', description: 'Jornadas, descansos, límites y validaciones.', icon: FileText, to: '/planning-settings?tab=work' },
    { title: 'Datos de origen', description: 'Gestiona la información de clientes, centros y tareas.', icon: Settings2, to: '/planning-settings?tab=sources' },
  ];
  return <OperationalFrame><ScreenHeader number="7 · Configuración" title="Configuración" strapline="Ajusta hoy las reglas de mañana." description="La configuración queda separada de la decisión diaria y alimenta Previsión, Equipo y Turnos." /><section className="mx-auto max-w-4xl space-y-3">{settings.map(({ title, description, icon: Icon, to }) => <Link key={title} to={to} className={`${cardClass} group flex items-center gap-4 p-5 transition hover:-translate-y-0.5 hover:border-[#a9cfe0] hover:shadow-md`}><span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#edf6fb] text-[#2d8cb8]"><Icon className="h-6 w-6" /></span><span className="min-w-0 flex-1"><strong className="block text-base font-black text-[#183650]">{title}</strong><span className="mt-1 block text-sm text-[#6a7d91]">{description}</span></span><ChevronRight className="h-5 w-5 shrink-0 text-[#91a6b8] transition group-hover:translate-x-1" /></Link>)}</section><DataNote>Estas tarjetas llevan a la configuración existente. No se crean formularios nuevos ni se modifican reglas al abrir la pantalla.</DataNote></OperationalFrame>;
}

export default OperationalHomeScreen;