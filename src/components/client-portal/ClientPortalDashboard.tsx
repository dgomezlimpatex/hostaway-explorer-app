
import { useState, useEffect, useMemo, useRef } from 'react';
import { Building2, LogOut, Plus, Calendar, List, Sparkles, AlertTriangle, Clock, Home, ClipboardCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  useClientPortalBookings,
  useClientProperties,
  useClientPortalSettings,
} from '@/hooks/useClientPortal';
import { QuickAddReservations } from './QuickAddReservations';
import { ReservationsList } from './ReservationsList';
import { ReservationsCalendar } from './ReservationsCalendar';
import { ExtraordinaryRequestsTab } from './ExtraordinaryRequestsTab';
import { IncidentsTab } from './IncidentsTab';
import { OperationalDayView } from './OperationalDayView';
import { Toaster } from '@/components/ui/toaster';
import { filterClientPortalListBookings } from './clientPortalVisibility';

interface ClientPortalDashboardProps {
  clientId: string;
  clientName: string;
  onLogout: () => void;
}

export const ClientPortalDashboard = ({
  clientId,
  clientName,
  onLogout,
}: ClientPortalDashboardProps) => {
  const { data: settings } = useClientPortalSettings(clientId);
  // Strict default: only allow creation when explicitly enabled (true).
  // While loading or if unreadable, hide the "Añadir" tab to avoid leaking the option.
  const canCreateReservations = settings?.allowReservationCreation === true;
  const canCreateExtraordinary = settings?.allowExtraordinaryRequests === true;
  const canViewIncidents = (settings as { allowIncidents?: boolean } | undefined)?.allowIncidents === true;
  const operationalPortalEnabled = (settings as { operationalPortalEnabled?: boolean } | undefined)?.operationalPortalEnabled === true;

  const [activeTab, setActiveTab] = useState<string>('list');
  const operationalDefaultApplied = useRef(false);

  // If settings load and creation is disabled while user is on "add" tab, switch to list
  useEffect(() => {
    if (operationalPortalEnabled && !operationalDefaultApplied.current) {
      operationalDefaultApplied.current = true;
      setActiveTab('operations');
      return;
    }
    if (!operationalPortalEnabled && activeTab === 'operations') {
      setActiveTab('list');
    }
    if (!canCreateReservations && activeTab === 'add') {
      setActiveTab('list');
    }
    if (!canCreateExtraordinary && activeTab === 'extra') {
      setActiveTab('list');
    }
    if (!canViewIncidents && activeTab === 'incidents') {
      setActiveTab('list');
    }
  }, [canCreateReservations, canCreateExtraordinary, canViewIncidents, operationalPortalEnabled, activeTab]);

  const { data: properties = [], isLoading: loadingProperties } = useClientProperties(clientId);
  const { data: bookings = [], isLoading: loadingBookings, refetch } = useClientPortalBookings(clientId);

  // Show recent past bookings plus every future booking in the list & header counters.
  // Clients add reservations well ahead of time; a future cap makes successful saves look lost.
  const listBookings = useMemo(
    () => filterClientPortalListBookings(bookings),
    [bookings],
  );

  const upcomingBookings = listBookings.filter(b => {
    const date = new Date(b.checkOutDate ?? b.cleaningDate);
    return date >= new Date() && b.status !== 'cancelled';
  });

  const portalStats = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const nextWeek = new Date(today);
    nextWeek.setDate(today.getDate() + 7);

    const todayTasks = bookings.filter((booking) => {
      const date = new Date(booking.cleaningDate);
      date.setHours(0, 0, 0, 0);
      return date.getTime() === today.getTime() && booking.status !== 'cancelled';
    }).length;

    const nextSevenDays = bookings.filter((booking) => {
      const date = new Date(booking.cleaningDate);
      date.setHours(0, 0, 0, 0);
      return date >= today && date <= nextWeek && booking.status !== 'cancelled';
    }).length;

    return {
      properties: properties.length,
      todayTasks,
      nextSevenDays,
      visibleBookings: listBookings.length,
    };
  }, [bookings, listBookings.length, properties.length]);

  const extraTabs =
    (operationalPortalEnabled ? 1 : 0) +
    (canCreateReservations ? 1 : 0) +
    (canCreateExtraordinary ? 1 : 0) +
    (canViewIncidents ? 1 : 0);
  const tabsCount = 2 + extraTabs;
  const gridColsClass =
    tabsCount === 6 ? 'grid-cols-3 sm:grid-cols-6'
    : tabsCount === 5 ? 'grid-cols-3 sm:grid-cols-5'
    : tabsCount === 4 ? 'grid-cols-4'
    : tabsCount === 3 ? 'grid-cols-3'
    : 'grid-cols-2';

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="sticky top-0 z-20 border-b bg-white/90 backdrop-blur">
        <div className="container mx-auto max-w-6xl px-3 py-2.5 sm:px-5 sm:py-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2.5 sm:gap-3 min-w-0 flex-1">
              <div className="w-10 h-10 sm:w-11 sm:h-11 bg-blue-50 rounded-2xl flex items-center justify-center shrink-0 ring-1 ring-blue-100">
                <Building2 className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
              </div>
              <div className="min-w-0 flex-1">
                <h1 className="font-semibold text-base sm:text-lg truncate text-slate-950">{clientName}</h1>
                <p className="text-xs sm:text-sm text-muted-foreground truncate">
                  {operationalPortalEnabled ? 'Seguimiento diario de limpiezas' : `${upcomingBookings.length} reservas próximas`}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl" onClick={onLogout} aria-label="Cerrar sesión">
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="container mx-auto max-w-6xl px-3 py-4 sm:px-5 sm:py-6">
        <section className="mb-4 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm sm:mb-6">
          <div className="grid gap-4 p-4 sm:grid-cols-[1.2fr_1fr] sm:p-5">
            <div className="flex items-start gap-3">
              <div className="hidden h-12 w-12 items-center justify-center rounded-2xl bg-slate-950 text-white sm:flex">
                <Home className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Portal cliente</p>
                <h2 className="mt-1 text-xl font-bold tracking-tight text-slate-950 sm:text-2xl">
                  {operationalPortalEnabled ? 'Operativa de limpiezas' : 'Reservas y calendario de limpiezas'}
                </h2>
                <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
                  {operationalPortalEnabled
                    ? 'Consulta la planificación diaria, el estado de cada apartamento y las fotografías de los servicios finalizados.'
                    : 'Consulta reservas por propiedad, revisa limpiezas próximas y controla incidencias publicadas por Limpatex.'}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <PortalStat label="Propiedades" value={portalStats.properties} icon={Building2} />
              <PortalStat label="Hoy" value={portalStats.todayTasks} icon={Clock} />
              <PortalStat label="7 días" value={portalStats.nextSevenDays} icon={Calendar} />
              <PortalStat label="Vista" value={portalStats.visibleBookings} icon={List} />
            </div>
          </div>
        </section>
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className={`grid w-full ${gridColsClass} mb-4 sm:mb-6 h-auto rounded-2xl bg-slate-200/60 p-1`} key={`tabs-${tabsCount}`}>
            {operationalPortalEnabled && (
              <TabsTrigger value="operations" className="flex flex-col sm:flex-row items-center gap-1 rounded-xl py-2 text-xs data-[state=active]:bg-white data-[state=active]:shadow-sm sm:gap-2 sm:text-sm">
                <ClipboardCheck className="h-4 w-4" />
                <span>Operativa</span>
              </TabsTrigger>
            )}
            {canCreateReservations && (
              <TabsTrigger value="add" className="flex flex-col sm:flex-row items-center gap-1 rounded-xl py-2 text-xs data-[state=active]:bg-white data-[state=active]:shadow-sm sm:gap-2 sm:text-sm">
                <Plus className="h-4 w-4" />
                <span>Añadir</span>
              </TabsTrigger>
            )}
            <TabsTrigger value="list" className="flex flex-col sm:flex-row items-center gap-1 rounded-xl py-2 text-xs data-[state=active]:bg-white data-[state=active]:shadow-sm sm:gap-2 sm:text-sm">
              <List className="h-4 w-4" />
              <span>Reservas</span>
            </TabsTrigger>
            <TabsTrigger value="calendar" className="flex flex-col sm:flex-row items-center gap-1 rounded-xl py-2 text-xs data-[state=active]:bg-white data-[state=active]:shadow-sm sm:gap-2 sm:text-sm">
              <Calendar className="h-4 w-4" />
              <span>Calendario</span>
            </TabsTrigger>
            {canCreateExtraordinary && (
              <TabsTrigger value="extra" className="flex flex-col sm:flex-row items-center gap-1 rounded-xl py-2 text-xs data-[state=active]:bg-white data-[state=active]:shadow-sm sm:gap-2 sm:text-sm">
                <Sparkles className="h-4 w-4" />
                <span>Servicios Extraordinarios</span>
              </TabsTrigger>
            )}
            {canViewIncidents && (
              <TabsTrigger value="incidents" className="flex flex-col sm:flex-row items-center gap-1 rounded-xl py-2 text-xs data-[state=active]:bg-white data-[state=active]:shadow-sm sm:gap-2 sm:text-sm">
                <AlertTriangle className="h-4 w-4" />
                <span>Incidencias</span>
              </TabsTrigger>
            )}
          </TabsList>

          {operationalPortalEnabled && (
            <TabsContent value="operations">
              <OperationalDayView
                clientId={clientId}
                bookings={bookings}
                isLoading={loadingBookings}
              />
            </TabsContent>
          )}

          {canCreateReservations && (
            <TabsContent value="add">
              <QuickAddReservations
                clientId={clientId}
                properties={properties}
                isLoading={loadingProperties}
                onSuccess={() => {
                  refetch();
                  setActiveTab('list');
                }}
              />
            </TabsContent>
          )}

          <TabsContent value="list">
            <ReservationsList
              clientId={clientId}
              clientName={clientName}
              bookings={listBookings}
              properties={properties}
              isLoading={loadingBookings}
            />
          </TabsContent>

          <TabsContent value="calendar">
            <ReservationsCalendar
              bookings={bookings}
              isLoading={loadingBookings}
            />
          </TabsContent>

          {canCreateExtraordinary && (
            <TabsContent value="extra">
              <ExtraordinaryRequestsTab clientId={clientId} properties={properties} />
            </TabsContent>
          )}

          {canViewIncidents && (
            <TabsContent value="incidents">
              <IncidentsTab clientId={clientId} />
            </TabsContent>
          )}
        </Tabs>
      </main>
      
      <Toaster />
    </div>
  );
};

const PortalStat = ({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: number;
  icon: typeof Building2;
}) => (
  <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2.5">
    <div className="flex items-center justify-between gap-2">
      <span className="text-[11px] font-medium text-muted-foreground">{label}</span>
      <Icon className="h-3.5 w-3.5 text-primary" />
    </div>
    <div className="mt-1 text-xl font-bold tabular-nums text-slate-950">{value}</div>
  </div>
);
