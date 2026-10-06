import { useMemo, useState } from 'react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { ArrowRight, Calendar, ChevronLeft, ChevronRight, Edit2, Home, Loader2, Plus, Search, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ClientReservation, PortalBooking } from '@/types/clientPortal';
import { useCancelReservation } from '@/hooks/useClientPortal';
import { useToast } from '@/hooks/use-toast';
import { EditReservationForm } from './EditReservationForm';
import { ReservationDetailModal } from './ReservationDetailModal';
import { calendarDay, madridToday, shiftDay, weekOf } from './calendar/portalOccupancy';

interface Property {
  id: string;
  nombre: string;
  codigo: string;
  direccion: string;
}

interface ReservationsListProps {
  clientId: string;
  clientName: string;
  bookings: PortalBooking[];
  properties: Property[];
  isLoading: boolean;
  onOpenCalendar?: () => void;
  onAddTask?: () => void;
}

type StatusFilter = 'all' | 'today' | 'upcoming' | 'past' | 'manual';

const bookingToReservation = (booking: PortalBooking): ClientReservation => ({
  id: booking.reservationId!,
  clientId: '',
  propertyId: booking.property?.id ?? '',
  checkInDate: booking.checkInDate ?? booking.cleaningDate,
  checkOutDate: booking.checkOutDate ?? booking.cleaningDate,
  guestCount: booking.guestCount,
  specialRequests: booking.specialRequests,
  taskId: booking.taskId,
  status: booking.status as 'active' | 'cancelled' | 'completed',
  createdAt: '',
  updatedAt: '',
  property: booking.property ? {
    id: booking.property.id,
    nombre: booking.property.nombre,
    codigo: booking.property.codigo,
    direccion: booking.property.direccion,
    checkOutPredeterminado: booking.property.checkOutPredeterminado ?? '11:00',
  } : undefined,
});

const displayDate = (day: string, pattern: string) => format(new Date(`${calendarDay(day)}T12:00:00`), pattern, { locale: es });

const getPropertyKey = (booking: PortalBooking) => {
  return booking.property?.id || booking.property?.codigo || booking.property?.nombre || '__sin_propiedad__';
};

const isPastBooking = (booking: PortalBooking) => (calendarDay(booking.cleaningDate) ?? '') < madridToday();
const matchesStatusFilter = (booking: PortalBooking, filter: StatusFilter) => {
  if (filter === 'today') return calendarDay(booking.cleaningDate) === madridToday();
  if (filter === 'upcoming') return !isPastBooking(booking) && booking.status !== 'cancelled';
  if (filter === 'past') return isPastBooking(booking);
  if (filter === 'manual') return booking.source === 'manual';
  return true;
};

export const ReservationsList = ({
  clientId,
  clientName,
  bookings,
  properties,
  isLoading,
  onOpenCalendar,
  onAddTask,
}: ReservationsListProps) => {
  const [editingBooking, setEditingBooking] = useState<PortalBooking | null>(null);
  const [cancellingBooking, setCancellingBooking] = useState<PortalBooking | null>(null);
  const [detailBooking, setDetailBooking] = useState<PortalBooking | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('upcoming');
  const [propertyFilter, setPropertyFilter] = useState('all');
  const [month, setMonth] = useState(() => madridToday().slice(0, 7) + '-01');
  const { toast } = useToast();
  const cancelMutation = useCancelReservation();

  const metrics = useMemo(() => {
    const today = bookings.filter((booking) => calendarDay(booking.cleaningDate) === madridToday()).length;
    const upcoming = bookings.filter((booking) => !isPastBooking(booking) && booking.status !== 'cancelled').length;
    const past = bookings.filter(isPastBooking).length;
    return { total: bookings.length, today, upcoming, past };
  }, [bookings]);

  const propertyOptions = useMemo(() => {
    const map = new Map<string, { key: string; label: string }>();
    bookings.forEach((booking) => {
      const key = getPropertyKey(booking);
      const code = booking.property?.codigo;
      const name = booking.property?.nombre ?? 'Sin propiedad';
      map.set(key, { key, label: code ? `${code} · ${name}` : name });
    });
    properties.forEach((property) => {
      if (!map.has(property.id)) {
        map.set(property.id, { key: property.id, label: `${property.codigo} · ${property.nombre}` });
      }
    });
    return Array.from(map.values()).sort((a, b) => a.label.localeCompare(b.label, 'es', { numeric: true }));
  }, [bookings, properties]);

  const filteredBookings = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    return bookings.filter((booking) => {
      if (propertyFilter !== 'all' && getPropertyKey(booking) !== propertyFilter && booking.property?.id !== propertyFilter) {
        return false;
      }
      if (!matchesStatusFilter(booking, statusFilter)) return false;
      if (!normalizedSearch) return true;

      const haystack = [
        booking.property?.codigo,
        booking.property?.nombre,
        booking.property?.direccion,
        booking.specialRequests,
        booking.guestCount ? `${booking.guestCount} huespedes` : '',
        booking.cleaningDate,
        booking.checkInDate,
        booking.checkOutDate,
      ].filter(Boolean).join(' ').toLowerCase();

      return haystack.includes(normalizedSearch);
    });
  }, [bookings, propertyFilter, search, statusFilter]);

  const sortedBookings = [...filteredBookings].sort((a, b) => statusFilter === 'past'
    ? b.cleaningDate.localeCompare(a.cleaningDate) : a.cleaningDate.localeCompare(b.cleaningDate));
  const propertyGroups = Array.from(sortedBookings.reduce((groups, booking) => {
    const key = getPropertyKey(booking);
    const group = groups.get(key) ?? { key, property: booking.property, bookings: [] as PortalBooking[] };
    group.bookings.push(booking);
    groups.set(key, group);
    return groups;
  }, new Map<string, { key: string; property: PortalBooking['property']; bookings: PortalBooking[] }>()).values())
    .sort((a, b) => (a.property?.nombre ?? 'Sin propiedad').localeCompare(b.property?.nombre ?? 'Sin propiedad', 'es', { numeric: true }));
  const nextBooking = [...bookings].filter(booking => matchesStatusFilter(booking, 'upcoming'))
    .sort((a, b) => a.cleaningDate.localeCompare(b.cleaningDate))[0];
  const monthStart = weekOf(month)[0];
  const monthDays = Array.from({ length: 42 }, (_, index) => shiftDay(monthStart, index));
  const changeMonth = (direction: number) => {
    const date = new Date(`${month}T12:00:00Z`);
    date.setUTCMonth(date.getUTCMonth() + direction);
    setMonth(date.toISOString().slice(0, 10));
  };

  const handleCancel = async () => {
    if (!cancellingBooking?.reservationId) return;

    try {
      await cancelMutation.mutateAsync({
        reservationId: cancellingBooking.reservationId,
        clientId,
        clientName,
      });
      toast({
        title: 'Reserva cancelada',
        description: 'La reserva y su limpieza asociada han sido eliminadas.',
      });
      setCancellingBooking(null);
    } catch (error) {
      toast({
        title: 'Error',
        description: 'No se pudo cancelar la reserva.',
        variant: 'destructive',
      });
    }
  };

  const clearFilters = () => {
    setSearch('');
    setStatusFilter('upcoming');
    setPropertyFilter('all');
  };

  if (isLoading) {
    return (
      <Card className="border-slate-200 bg-white shadow-sm">
        <CardContent className="py-16 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-violet-50">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
          <p className="font-medium text-muted-foreground">Cargando reservas...</p>
        </CardContent>
      </Card>
    );
  }

  const renderBookingRow = (booking: PortalBooking) => {
    const day = calendarDay(booking.cleaningDate);
    const today = day === madridToday();
    const editable = booking.isEditable && !isPastBooking(booking) && booking.status === 'active';
    return (
      <div key={booking.id} role="button" tabIndex={0} className="portal-task-row"
        onClick={() => setDetailBooking(booking)}
        onKeyDown={event => { if (event.target === event.currentTarget && (event.key === 'Enter' || event.key === ' ')) { event.preventDefault(); setDetailBooking(booking); } }}>
        <div className={`portal-task-date${today ? ' is-today' : ''}`}><strong>{day ? displayDate(day, 'd') : '—'}</strong><small>{day ? displayDate(day, 'MMM') : ''}</small></div>
        <div className="portal-task-description">
          <strong>{booking.property?.nombre ?? 'Sin propiedad'}</strong>
          <p>{booking.checkInDate && booking.checkOutDate ? `Entrada ${displayDate(booking.checkInDate, 'd MMM')} → Salida ${displayDate(booking.checkOutDate, 'd MMM')}` : 'Limpieza'}{booking.guestCount ? ` · ${booking.guestCount} huéspedes` : ''}</p>
          {booking.specialRequests && <p className="portal-task-note">{booking.specialRequests}</p>}
        </div>
        <span className={`portal-task-state${today ? ' is-today' : ''}`}>{booking.status === 'cancelled' ? 'Cancelada' : today ? 'Hoy' : isPastBooking(booking) ? 'Pasada' : 'Programada'}</span>
        {editable && <div className="portal-task-actions" onClick={event => event.stopPropagation()}>
          <Button variant="ghost" size="icon" onClick={() => setEditingBooking(booking)} aria-label="Editar reserva"><Edit2 size={14} /></Button>
          <Button variant="ghost" size="icon" onClick={() => setCancellingBooking(booking)} aria-label="Cancelar reserva"><Trash2 size={14} /></Button>
        </div>}
        <ChevronRight size={16} className="portal-task-arrow" />
      </div>
    );
  };

  return (
    <>
      <div className="portal-tasks-layout">
        <section className="portal-task-list">
          <div className="portal-next-task">
            <span className="portal-next-icon"><Home size={24} /></span>
            <div><small>PRÓXIMA LIMPIEZA</small><h2>{nextBooking ? `${calendarDay(nextBooking.cleaningDate) === madridToday() ? 'Hoy, ' : ''}${displayDate(nextBooking.cleaningDate, 'EEEE d')}` : 'Todo al día'}</h2><p>{nextBooking?.property?.nombre ?? 'No tienes tareas próximas.'}</p></div>
            {nextBooking && <button type="button" onClick={() => setDetailBooking(nextBooking)}>Ver tarea <ArrowRight size={16} /></button>}
          </div>
          <div className="portal-task-filters">
            <div className="portal-task-filter-tabs" aria-label="Estado de las tareas">
              {([{ value: 'upcoming', label: 'Próximas', count: metrics.upcoming }, { value: 'past', label: 'Pasadas', count: metrics.past }, { value: 'all', label: 'Todas', count: metrics.total }] as const).map(item => <button type="button" key={item.value} aria-pressed={statusFilter === item.value} onClick={() => setStatusFilter(item.value)}>{item.label} <span>{item.count}</span></button>)}
            </div>
            <div className="portal-task-search">
              <label><Search size={16} /><Input value={search} onChange={event => setSearch(event.target.value)} aria-label="Buscar tareas" placeholder="Buscar propiedad o nota" /></label>
              <Select value={propertyFilter} onValueChange={setPropertyFilter}><SelectTrigger aria-label="Filtrar por alojamiento"><SelectValue placeholder="Todas las propiedades" /></SelectTrigger><SelectContent><SelectItem value="all">Todas las propiedades</SelectItem>{propertyOptions.map(property => <SelectItem key={property.key} value={property.key}>{property.label}</SelectItem>)}</SelectContent></Select>
            </div>
          </div>
          <div className="portal-task-column-head"><span>PROPIEDAD / TAREAS</span><span>DESPLEGAR PARA VER TAREAS</span></div>
          {sortedBookings.length ? propertyGroups.map(group => <details key={group.key} className="portal-property-tasks">
            <summary><span className="portal-property-task-icon"><Home size={18} /></span><span className="portal-property-task-name"><strong>{group.property?.nombre ?? 'Sin propiedad'}</strong>{group.property?.codigo && <small>{group.property.codigo}</small>}</span><span className="portal-property-task-count">{group.bookings.length} tarea{group.bookings.length === 1 ? '' : 's'}</span><ChevronRight size={16} /></summary>
            <div className="portal-property-task-rows">{group.bookings.map(renderBookingRow)}</div>
          </details>) : <div className="portal-empty"><p>{bookings.length ? 'No hay reservas con estos filtros.' : 'Todavía no tienes tareas.'}</p>{bookings.length > 0 && <Button variant="link" onClick={clearFilters}>Limpiar filtros</Button>}</div>}
          <footer className="portal-task-footer"><span>{sortedBookings.length} tarea{sortedBookings.length === 1 ? '' : 's'}{statusFilter === 'upcoming' ? ' próximas' : statusFilter === 'past' ? ' pasadas' : ''}</span><span>Abre una tarea para ver los detalles <ArrowRight size={12} /></span></footer>
        </section>
        <aside className="portal-tasks-sidebar">
          <section className="portal-mini-calendar">
            <header><h2>Un vistazo al mes</h2><Calendar size={17} /></header>
            <div className="portal-mini-month"><strong>{displayDate(month, 'MMMM yyyy')}</strong><button type="button" aria-label="Mes anterior" onClick={() => changeMonth(-1)}><ChevronLeft size={16} /></button><button type="button" aria-label="Mes siguiente" onClick={() => changeMonth(1)}><ChevronRight size={16} /></button></div>
            <div className="portal-mini-weekdays">{['L', 'M', 'X', 'J', 'V', 'S', 'D'].map((day, index) => <span key={index}>{day}</span>)}</div>
            <div className="portal-mini-days">{monthDays.map(day => {
              const hasCleaning = bookings.some(booking => booking.status !== 'cancelled' && calendarDay(booking.cleaningDate) === day);
              return <span key={day} className={`${day.slice(0, 7) !== month.slice(0, 7) ? 'outside ' : ''}${day === madridToday() ? 'today' : ''}`} aria-label={`${displayDate(day, 'd MMMM yyyy')}${hasCleaning ? ', con limpieza' : ''}`}>{displayDate(day, 'd')}{hasCleaning && <i />}</span>;
            })}</div>
            <p className="portal-mini-legend"><i /> Día con limpieza</p>
            {onOpenCalendar && <button type="button" className="portal-sidebar-link" onClick={onOpenCalendar}>Abrir calendario <ArrowRight size={16} /></button>}
          </section>
          {onAddTask && <section className="portal-add-hint"><Plus size={24} /><h3>¿Una nueva estancia?</h3><p>Indica la entrada y la salida. Tendrás la limpieza organizada por fecha y propiedad.</p><button type="button" className="portal-sidebar-link" onClick={onAddTask}>Añadir una tarea <ArrowRight size={16} /></button></section>}
        </aside>
      </div>

      <ReservationDetailModal
        booking={detailBooking}
        clientId={clientId}
        open={!!detailBooking}
        onOpenChange={(open) => !open && setDetailBooking(null)}
      />

      <Dialog open={!!editingBooking} onOpenChange={() => setEditingBooking(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar reserva</DialogTitle>
            <DialogDescription>
              Modifica los detalles de la reserva. La limpieza se actualizará automáticamente.
            </DialogDescription>
          </DialogHeader>
          {editingBooking && (
            <EditReservationForm
              reservation={bookingToReservation(editingBooking)}
              properties={properties}
              clientId={clientId}
              clientName={clientName}
              onSuccess={() => setEditingBooking(null)}
              onCancel={() => setEditingBooking(null)}
            />
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!cancellingBooking} onOpenChange={() => setCancellingBooking(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Cancelar reserva?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción eliminará la reserva y la limpieza asociada. No se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>No, mantener</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleCancel}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {cancelMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Sí, cancelar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
