
import { useState, useEffect, useMemo, useRef } from 'react';
import { LogOut, Plus, Calendar, List, AlertTriangle, Home, ClipboardCheck } from 'lucide-react';
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
import { IncidentsTab } from './IncidentsTab';
import { OperationalDayView } from './OperationalDayView';
import { Toaster } from '@/components/ui/toaster';
import { filterClientPortalListBookings } from './clientPortalVisibility';
import './clientPortalDesign.css';

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
    if (!canViewIncidents && activeTab === 'incidents') {
      setActiveTab('list');
    }
  }, [canCreateReservations, canViewIncidents, operationalPortalEnabled, activeTab]);

  const { data: properties = [], isLoading: loadingProperties } = useClientProperties(clientId);
  const { data: bookings = [], isLoading: loadingBookings, refetch } = useClientPortalBookings(clientId);

  // Show recent past bookings plus every future booking in the list & header counters.
  // Clients add reservations well ahead of time; a future cap makes successful saves look lost.
  const listBookings = useMemo(
    () => filterClientPortalListBookings(bookings),
    [bookings],
  );

  return (
    <div className="client-portal-design">
      <header className="portal-header">
        <div className="portal-header-inner">
          <div className="portal-brand"><span><Home size={22} /></span><div><strong>LIMPATEX.</strong><small>Portal de clientes</small></div></div>
          <div className="portal-account"><span>{clientName}</span><Button variant="ghost" size="icon" onClick={onLogout} aria-label="Cerrar sesión"><LogOut size={18} /></Button></div>
        </div>
      </header>
      <main className="portal-main">
        <div className="portal-page-heading">
          <div><h1>{activeTab === 'operations' ? 'Operativa' : activeTab === 'calendar' ? 'Calendario' : activeTab === 'incidents' ? 'Incidencias' : activeTab === 'add' ? 'Añadir tareas' : 'Tus tareas'}</h1>
          <p>{activeTab === 'operations' ? 'Seguimiento diario de limpiezas y acceso a los reportes.' : 'Tus alojamientos y sus limpiezas, en un solo lugar.'}</p></div>
          {canCreateReservations && activeTab !== 'add' && activeTab !== 'operations' && <Button className="portal-add-button" onClick={() => setActiveTab('add')}><Plus size={17} /> Añadir tarea</Button>}
        </div>
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="portal-tabs">
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
              <span>Tareas</span>
            </TabsTrigger>
            <TabsTrigger value="calendar" className="flex flex-col sm:flex-row items-center gap-1 rounded-xl py-2 text-xs data-[state=active]:bg-white data-[state=active]:shadow-sm sm:gap-2 sm:text-sm">
              <Calendar className="h-4 w-4" />
              <span>Calendario</span>
            </TabsTrigger>
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
              onOpenCalendar={() => setActiveTab('calendar')}
              onAddTask={canCreateReservations ? () => setActiveTab('add') : undefined}
            />
          </TabsContent>

          <TabsContent value="calendar">
            <ReservationsCalendar
              bookings={bookings}
              properties={properties}
              clientId={clientId}
              isLoading={loadingBookings}
            />
          </TabsContent>

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
