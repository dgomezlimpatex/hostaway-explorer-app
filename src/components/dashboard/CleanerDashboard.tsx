import { useMemo, type CSSProperties } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowUpRight,
  CalendarDays,
  Info,
  ListChecks,
  Sparkles,
} from 'lucide-react';
import { UserMenu } from '@/components/auth/UserMenu';
import { useTasks } from '@/hooks/useTasks';
import { useAuth } from '@/hooks/useAuth';
import { useCleaners } from '@/hooks/useCleaners';
import { getTodayMadrid, formatMadridDate } from '@/utils/date';
import { isTaskAssignedToCleaner } from '@/utils/taskAssignments';
import { OperationalModeSwitcher } from '@/components/auth/OperationalModeSwitcher';
import { CleanerEntryLoading } from './CleanerEntryLoading';

interface CleanerDashboardProps {
  userFullName?: string | null;
  userEmail?: string | null;
}

const getFirstName = (value?: string | null) => value?.trim().split(/\s+/)[0] || '';

const capitalize = (value: string) => value.charAt(0).toUpperCase() + value.slice(1);

export const CleanerDashboard = ({ userFullName, userEmail }: CleanerDashboardProps) => {
  const { user } = useAuth();
  const { cleaners, isInitialLoading: cleanersLoading } = useCleaners();
  const today = useMemo(() => getTodayMadrid(), []);
  const { tasks, isLoading: tasksLoading } = useTasks(today, 'day');

  const currentCleaner = useMemo(() => {
    if (!user?.id) return null;
    return cleaners.find((cleaner) => cleaner.user_id === user.id) || null;
  }, [cleaners, user?.id]);

  const todayTasks = useMemo(() => {
    if (!tasks || !currentCleaner) return [];
    const todayString = formatMadridDate(today);
    return tasks
      .filter((task) => task.date === todayString && isTaskAssignedToCleaner(task, currentCleaner.id, currentCleaner.name))
      .sort((a, b) => a.startTime.localeCompare(b.startTime));
  }, [tasks, currentCleaner, today]);

  const completedCount = todayTasks.filter((task) => task.status === 'completed').length;
  const plannedCount = todayTasks.length;
  const remainingCount = Math.max(plannedCount - completedCount, 0);
  const progress = plannedCount > 0 ? completedCount / plannedCount : 0;
  const progressAngle = `${Math.round(progress * 360)}deg`;
  const firstName = getFirstName(userFullName) || getFirstName(userEmail) || 'equipo';
  const dateLabel = capitalize(
    new Intl.DateTimeFormat('es-ES', {
      timeZone: 'Europe/Madrid',
      weekday: 'long',
      day: 'numeric',
      month: 'long',
    }).format(today),
  );
  const heroProgressStyle = { '--cleaner-progress-angle': progressAngle } as CSSProperties;

  if (cleanersLoading || tasksLoading) {
    return <CleanerEntryLoading />;
  }

  return (
    <div className="cleaner-dashboard-shell min-h-screen pb-8 sm:pb-12">
      <header className="cleaner-dashboard-header sticky top-0 z-30">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6 sm:py-4 lg:px-8">
          <Link
            to="/"
            className="group flex min-h-11 min-w-0 items-center gap-2.5 rounded-2xl px-1.5 py-1 outline-none transition-transform duration-200 focus-visible:ring-2 focus-visible:ring-[#6d40ca] focus-visible:ring-offset-2 focus-visible:ring-offset-[#fbfaff] hover:-translate-y-0.5"
            aria-label="Limpatex, volver al panel"
          >
            <img
              src="/limpatex-logo.png"
              alt="Limpatex"
              width="48"
              height="48"
              className="h-11 w-11 shrink-0 object-contain drop-shadow-[0_8px_16px_rgba(49,9,132,0.14)]"
            />
            <span className="hidden min-w-0 sm:block">
              <span className="block truncate text-sm font-black tracking-[-0.02em] text-[#24123f]">Limpatex</span>
              <span className="block truncate text-[11px] font-medium text-[#817493]">Espacio de limpieza</span>
            </span>
          </Link>

          <div className="flex shrink-0 items-center gap-2 sm:gap-3">
            <OperationalModeSwitcher compact />
            <div className="rounded-2xl border border-white/80 bg-white/70 p-0.5 shadow-sm backdrop-blur">
              <UserMenu />
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-6xl flex-col gap-5 px-4 pt-5 sm:gap-6 sm:px-6 sm:pt-8 lg:px-8">
        <section
          className="cleaner-dashboard-hero cleaner-page-enter relative overflow-hidden rounded-[1.75rem] px-5 py-5 text-white shadow-[0_20px_56px_rgba(49,9,132,0.16)] sm:px-7 sm:py-6 lg:px-8"
          aria-labelledby="cleaner-dashboard-title"
        >
          <div className="cleaner-dashboard-hero-orb cleaner-dashboard-hero-orb-one" aria-hidden="true" />
          <div className="cleaner-dashboard-hero-orb cleaner-dashboard-hero-orb-two" aria-hidden="true" />

          <div className="relative z-10 flex items-center justify-between gap-5 sm:gap-8">
            <div className="max-w-xl">
              <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-semibold text-white/80 backdrop-blur">
                <Sparkles className="h-3.5 w-3.5 text-[#ffd1bd]" aria-hidden="true" />
                <span>{dateLabel}</span>
              </div>
              <h1 id="cleaner-dashboard-title" className="max-w-md text-[2.15rem] font-semibold leading-[1] tracking-[-0.06em] sm:text-[2.65rem]">
                Hola, {firstName}.
                <span className="mt-1 block text-[#e7ddff]">Tu día, en orden.</span>
              </h1>

              <div className="mt-4 flex flex-wrap items-center gap-3 text-sm">
                <div className="flex items-center gap-2">
                  <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-white/12 text-[#ffd1bd]">
                    <ListChecks className="h-4 w-4" aria-hidden="true" />
                  </span>
                  <span>
                    <strong className="font-semibold text-white">{plannedCount}</strong>{' '}
                    {plannedCount === 1 ? 'limpieza prevista' : 'limpiezas previstas'}
                  </span>
                </div>
                <Link
                  to="/tasks"
                  className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-white/25 bg-white px-3.5 py-2 text-xs font-bold text-[#4d218f] shadow-sm transition-colors hover:bg-[#f5f0ff] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/80"
                >
                  Ver tareas de hoy
                  <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
                </Link>
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-3">
              <div
                className="cleaner-progress-ring flex h-24 w-24 shrink-0 items-center justify-center rounded-full sm:h-28 sm:w-28"
                style={heroProgressStyle}
                role="img"
                aria-label={`Progreso de la jornada: ${completedCount} de ${plannedCount} tareas completadas`}
              >
                <div className="cleaner-progress-ring-inner flex h-[calc(100%_-_10px)] w-[calc(100%_-_10px)] flex-col items-center justify-center rounded-full bg-[#3c176f] px-2 text-center">
                  <span className="text-[9px] font-bold uppercase leading-none tracking-[0.18em] text-white/60">Hechas</span>
                  <span className="mt-1 text-[1.75rem] font-semibold leading-none tracking-[-0.06em] text-white">{completedCount}</span>
                  <span className="mt-1 text-[11px] font-semibold leading-none text-white/65">de {plannedCount}</span>
                </div>
              </div>
              <div className="hidden max-w-[8rem] md:block">
                <p className="text-sm font-semibold text-white">
                  {plannedCount === 0 ? 'Día despejado' : remainingCount === 0 ? 'Todo listo' : 'Vamos paso a paso'}
                </p>
                <p className="mt-1 text-xs leading-5 text-white/58">
                  {plannedCount === 0
                    ? 'No tienes limpiezas asignadas hoy.'
                    : remainingCount === 1
                    ? 'Queda una tarea para cerrar tu jornada.'
                    : `Quedan ${remainingCount} tareas para hoy.`}
                </p>
              </div>
            </div>
          </div>

          <div className="relative z-10 mt-5 border-t border-white/12 pt-3">
            <div className="flex items-center justify-between gap-4 text-xs font-medium text-white/60">
              <span>{plannedCount === 0 ? 'Sin tareas asignadas' : `${completedCount} de ${plannedCount} completadas`}</span>
              <span>{plannedCount > 0 ? `${Math.round(progress * 100)}%` : '—'}</span>
            </div>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/12">
              <div className="cleaner-dashboard-progress h-full rounded-full bg-gradient-to-r from-[#ffd1bd] to-[#d9c8ff]" style={{ width: `${Math.round(progress * 100)}%` }} />
            </div>
          </div>
        </section>

        <div>
          <Link
            to="/calendar"
            className="cleaner-calendar-card cleaner-page-enter group relative flex min-h-[210px] flex-col justify-between overflow-hidden rounded-[1.75rem] p-5 outline-none transition-transform duration-200 focus-visible:ring-2 focus-visible:ring-[#6d40ca] focus-visible:ring-offset-2 sm:p-7 hover:-translate-y-1"
          >
            <div className="relative z-10 flex items-start justify-between gap-4">
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/65 text-[#54308f] shadow-sm">
                <CalendarDays className="h-6 w-6" aria-hidden="true" />
              </span>
              <span className="flex h-10 w-10 items-center justify-center rounded-full border border-white/70 bg-white/45 text-[#54308f] transition-transform duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5">
                <ArrowUpRight className="h-5 w-5" aria-hidden="true" />
              </span>
            </div>
            <div className="relative z-10 mt-10">
              <p className="cleaner-section-kicker text-[#765da8]">Tu planificación</p>
              <h2 className="mt-1 text-2xl font-semibold tracking-[-0.045em] text-[#24123f]">Mi calendario</h2>
              <p className="mt-2 max-w-xs text-sm leading-5 text-[#716581]">Consulta tu semana y llega a cada servicio con tiempo.</p>
              <span className="mt-5 inline-flex items-center gap-2 text-sm font-bold text-[#54308f]">
                Abrir calendario
                <span className="h-px w-7 bg-[#a28bcf] transition-all duration-200 group-hover:w-10" aria-hidden="true" />
              </span>
            </div>
            <div className="cleaner-calendar-decoration" aria-hidden="true">
              <span />
              <span />
              <span />
            </div>
          </Link>
        </div>

        <aside className="cleaner-reminder flex items-start gap-3 rounded-2xl px-4 py-4 sm:items-center sm:px-5" aria-label="Recordatorio">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#f1eaff] text-[#6a42b6]">
            <Info className="h-5 w-5" aria-hidden="true" />
          </span>
          <div>
            <p className="text-sm font-bold text-[#332442]">Un pequeño recordatorio</p>
            <p className="mt-0.5 text-xs leading-5 text-[#7a6c85] sm:text-sm">
              Actualiza el estado al terminar y avisa desde la tarea si encuentras cualquier incidencia.
            </p>
          </div>
        </aside>
      </main>
    </div>
  );
};
