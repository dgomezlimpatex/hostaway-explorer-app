import { useMemo, useState } from 'react';
import { format, isFuture, isPast, isToday } from 'date-fns';
import { es } from 'date-fns/locale';
import {
  AlertTriangle,
  Building2,
  Calendar,
  CheckCircle2,
  ChevronRight,
  Clock,
  Edit2,
  Home,
  Loader2,
  Lock,
  MapPin,
  MessageSquare,
  RefreshCw,
  Search,
  Trash2,
  Users,
} from 'lucide-react';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
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
import { cn } from '@/lib/utils';
import { EditReservationForm } from './EditReservationForm';
import { ReservationDetailModal } from './ReservationDetailModal';

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
}

type StatusFilter = 'all' | 'today' | 'upcoming' | 'past' | 'manual' | 'external';

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

const normalizeDate = (value: string | Date) => {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  return date;
};

const getDaysUntil = (date: Date) => {
  const today = normalizeDate(new Date());
  const target = normalizeDate(date);
  return Math.ceil((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
};

const getNightsCount = (checkIn: Date, checkOut: Date) => {
  return Math.max(0, Math.ceil((checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24)));
};

const getPropertyKey = (booking: PortalBooking) => {
  return booking.property?.id || booking.property?.codigo || booking.property?.nombre || '__sin_propiedad__';
};

const isPastBooking = (booking: PortalBooking) => {
  const cleaningDate = new Date(booking.cleaningDate);
  const checkOutDate = booking.checkOutDate ? new Date(booking.checkOutDate) : cleaningDate;
  return isPast(checkOutDate) && !isToday(checkOutDate) && !isToday(cleaningDate);
};

const matchesStatusFilter = (booking: PortalBooking, filter: StatusFilter) => {
  const cleaningDate = new Date(booking.cleaningDate);
  if (filter === 'all') return true;
  if (filter === 'today') return isToday(cleaningDate);
  if (filter === 'upcoming') return !isPastBooking(booking) && booking.status !== 'cancelled';
  if (filter === 'past') return isPastBooking(booking);
  if (filter === 'manual') return booking.source === 'manual';
  if (filter === 'external') return booking.source === 'external';
  return true;
};

export const ReservationsList = ({
  clientId,
  clientName,
  bookings,
  properties,
  isLoading,
}: ReservationsListProps) => {
  const [editingBooking, setEditingBooking] = useState<PortalBooking | null>(null);
  const [cancellingBooking, setCancellingBooking] = useState<PortalBooking | null>(null);
  const [detailBooking, setDetailBooking] = useState<PortalBooking | null>(null);
  const [expandedPast, setExpandedPast] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [propertyFilter, setPropertyFilter] = useState('all');
  const { toast } = useToast();
  const cancelMutation = useCancelReservation();

  const metrics = useMemo(() => {
    const today = bookings.filter((booking) => isToday(new Date(booking.cleaningDate))).length;
    const upcoming = bookings.filter((booking) => !isPastBooking(booking) && booking.status !== 'cancelled').length;
    const past = bookings.filter(isPastBooking).length;
    const external = bookings.filter((booking) => booking.source === 'external').length;
    return { total: bookings.length, today, upcoming, past, external };
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

  const groupedByProperty = useMemo(() => {
    const groups = new Map<string, {
      propertyId: string;
      propertyName: string;
      propertyCode: string;
      propertyAddress: string;
      bookings: PortalBooking[];
    }>();

    for (const booking of filteredBookings) {
      const key = getPropertyKey(booking);
      if (!groups.has(key)) {
        groups.set(key, {
          propertyId: booking.property?.id ?? '',
          propertyName: booking.property?.nombre ?? 'Sin propiedad',
          propertyCode: booking.property?.codigo ?? '',
          propertyAddress: booking.property?.direccion ?? '',
          bookings: [],
        });
      }
      groups.get(key)!.bookings.push(booking);
    }

    for (const group of groups.values()) {
      group.bookings.sort((a, b) => new Date(a.cleaningDate).getTime() - new Date(b.cleaningDate).getTime());
    }

    return Array.from(groups.values()).sort((a, b) =>
      (a.propertyCode || a.propertyName).localeCompare(b.propertyCode || b.propertyName, 'es', {
        numeric: true,
        sensitivity: 'base',
      }),
    );
  }, [filteredBookings]);

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
    setStatusFilter('all');
    setPropertyFilter('all');
  };

  const hasFilters = search.trim() || statusFilter !== 'all' || propertyFilter !== 'all';

  if (isLoading) {
    return (
      <Card className="border-slate-200 bg-white shadow-sm">
        <CardContent className="py-16 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-50">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
          <p className="font-medium text-muted-foreground">Cargando reservas...</p>
        </CardContent>
      </Card>
    );
  }

  if (bookings.length === 0) {
    return (
      <Card className="border-dashed border-slate-300 bg-white shadow-sm">
        <CardContent className="py-16 text-center">
          <div className="mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-3xl bg-slate-100">
            <Calendar className="h-10 w-10 text-muted-foreground/60" />
          </div>
          <h3 className="mb-2 text-lg font-semibold text-slate-950">Sin reservas visibles</h3>
          <p className="mx-auto max-w-sm text-sm text-muted-foreground">
            Cuando haya reservas o limpiezas asociadas a tus propiedades, aparecerán aquí organizadas por propiedad.
          </p>
        </CardContent>
      </Card>
    );
  }

  const renderBookingRow = (booking: PortalBooking) => {
    const cleaningDate = new Date(booking.cleaningDate);
    const checkInDate = booking.checkInDate ? new Date(booking.checkInDate) : cleaningDate;
    const checkOutDate = booking.checkOutDate ? new Date(booking.checkOutDate) : cleaningDate;
    const external = booking.source === 'external';
    const upcoming = isFuture(cleaningDate) || isToday(cleaningDate);
    const stillActive = !isPast(checkOutDate) || isToday(checkOutDate) || isToday(cleaningDate);
    const pastBooking = isPastBooking(booking);
    const daysUntil = getDaysUntil(cleaningDate);
    const nights = !external ? getNightsCount(checkInDate, checkOutDate) : null;

    return (
      <button
        key={booking.id}
        type="button"
        onClick={() => setDetailBooking(booking)}
        className="group relative block w-full text-left transition-colors hover:bg-slate-50"
      >
        {upcoming && (
          <span
            className={cn(
              'absolute left-0 top-3 bottom-3 w-1 rounded-r-full',
              isToday(cleaningDate) ? 'bg-emerald-500' : daysUntil <= 3 ? 'bg-amber-500' : 'bg-primary',
            )}
          />
        )}

        <div className="flex items-center gap-3 p-3 pl-4 sm:p-4 sm:pl-5">
          <div
            className={cn(
              'hidden h-11 w-11 shrink-0 items-center justify-center rounded-2xl sm:flex',
              pastBooking
                ? 'bg-slate-100 text-slate-400'
                : external
                  ? 'bg-slate-100 text-slate-600'
                  : 'bg-blue-50 text-primary',
            )}
          >
            {external ? <RefreshCw className="h-4 w-4" /> : <Home className="h-4 w-4" />}
          </div>

          <div className="min-w-0 flex-1">
            <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
              <span className={cn('flex items-center gap-1 text-sm font-semibold', pastBooking ? 'text-slate-500' : 'text-slate-950')}>
                <Calendar className="h-3.5 w-3.5 shrink-0" />
                {external ? (
                  <span>{format(cleaningDate, "EEE d MMM yyyy", { locale: es })}</span>
                ) : (
                  <>
                    <span>{format(checkInDate, 'd MMM', { locale: es })}</span>
                    <ChevronRight className="h-3 w-3 text-muted-foreground" />
                    <span>{format(checkOutDate, 'd MMM yyyy', { locale: es })}</span>
                    {nights !== null && <span className="text-xs text-muted-foreground">({nights}n)</span>}
                  </>
                )}
              </span>

              {external && (
                <Badge variant="outline" className="h-5 gap-1 bg-slate-50 px-1.5 text-[10px]">
                  <Lock className="h-2.5 w-2.5" />
                  Sync
                </Badge>
              )}
              {isToday(cleaningDate) && (
                <Badge className="h-5 border-emerald-200 bg-emerald-50 px-1.5 text-[10px] text-emerald-700 hover:bg-emerald-50">
                  Hoy
                </Badge>
              )}
              {!pastBooking && !isToday(cleaningDate) && daysUntil <= 3 && daysUntil > 0 && (
                <Badge variant="outline" className="h-5 border-amber-200 bg-amber-50 px-1.5 text-[10px] text-amber-700">
                  En {daysUntil}d
                </Badge>
              )}
              {pastBooking && (
                <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">
                  Completada
                </Badge>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
              {booking.guestCount && (
                <span className="flex items-center gap-1">
                  <Users className="h-3 w-3" />
                  {booking.guestCount} huésp.
                </span>
              )}
              {booking.property?.direccion && (
                <span className="flex min-w-0 items-center gap-1">
                  <MapPin className="h-3 w-3 shrink-0" />
                  <span className="truncate">{booking.property.direccion}</span>
                </span>
              )}
              {booking.specialRequests && (
                <span className={cn('flex min-w-0 items-center gap-1', pastBooking ? 'text-slate-400' : 'text-amber-700')}>
                  <MessageSquare className="h-3 w-3 shrink-0" />
                  <span className="truncate">{booking.specialRequests}</span>
                </span>
              )}
            </div>
          </div>

          {booking.isEditable && stillActive && booking.status === 'active' && (
            <div className="flex shrink-0 items-center gap-1" onClick={(event) => event.stopPropagation()}>
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9 rounded-xl text-muted-foreground hover:bg-blue-50 hover:text-primary"
                onClick={() => setEditingBooking(booking)}
                aria-label="Editar reserva"
              >
                <Edit2 className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9 rounded-xl text-muted-foreground hover:bg-rose-50 hover:text-destructive"
                onClick={() => setCancellingBooking(booking)}
                aria-label="Cancelar reserva"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          )}

          <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/40" />
        </div>
      </button>
    );
  };

  return (
    <>
      <Card className="overflow-hidden border-slate-200 bg-white shadow-sm">
        <div className="border-b bg-gradient-to-br from-white via-blue-50/70 to-slate-50 p-4 sm:p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Reservas</p>
              <h2 className="mt-1 text-xl font-bold tracking-tight text-slate-950">Panel de reservas por propiedad</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Vista operativa de las limpiezas recientes y próximas. Abre cualquier fila para revisar el detalle.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:min-w-[420px]">
              <ReservationMetric label="Hoy" value={metrics.today} tone="emerald" icon={Clock} />
              <ReservationMetric label="Próximas" value={metrics.upcoming} tone="blue" icon={Calendar} />
              <ReservationMetric label="Pasadas" value={metrics.past} tone="slate" icon={CheckCircle2} />
              <ReservationMetric label="Sync" value={metrics.external} tone="amber" icon={RefreshCw} />
            </div>
          </div>

          <div className="mt-4 grid gap-2 lg:grid-cols-[1.2fr_0.9fr_0.8fr_auto]">
            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Buscar propiedad, fecha, dirección o notas..."
                className="h-10 bg-white pl-9"
              />
            </div>

            <Select value={propertyFilter} onValueChange={setPropertyFilter}>
              <SelectTrigger className="h-10 bg-white">
                <SelectValue placeholder="Propiedad" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas las propiedades</SelectItem>
                {propertyOptions.map((property) => (
                  <SelectItem key={property.key} value={property.key}>
                    {property.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as StatusFilter)}>
              <SelectTrigger className="h-10 bg-white">
                <SelectValue placeholder="Estado" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                <SelectItem value="today">Hoy</SelectItem>
                <SelectItem value="upcoming">Próximas</SelectItem>
                <SelectItem value="past">Pasadas</SelectItem>
                <SelectItem value="manual">Manuales</SelectItem>
                <SelectItem value="external">Sincronizadas</SelectItem>
              </SelectContent>
            </Select>

            <Button variant="ghost" onClick={clearFilters} disabled={!hasFilters} className="h-10">
              Limpiar
            </Button>
          </div>
        </div>

        <CardContent className="p-0">
          {filteredBookings.length === 0 ? (
            <div className="py-14 text-center">
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100">
                <AlertTriangle className="h-6 w-6 text-muted-foreground" />
              </div>
              <p className="font-medium text-slate-950">No hay reservas con estos filtros.</p>
              <Button variant="link" onClick={clearFilters}>Limpiar filtros</Button>
            </div>
          ) : (
            <Accordion type="multiple" className="divide-y divide-slate-100">
              {groupedByProperty.map((group) => {
                const today = normalizeDate(new Date());
                const upcoming: PortalBooking[] = [];
                const past: PortalBooking[] = [];

                for (const booking of group.bookings) {
                  const date = normalizeDate(booking.cleaningDate);
                  if (date.getTime() >= today.getTime()) upcoming.push(booking);
                  else past.push(booking);
                }

                upcoming.sort((a, b) => new Date(a.cleaningDate).getTime() - new Date(b.cleaningDate).getTime());
                past.sort((a, b) => new Date(b.cleaningDate).getTime() - new Date(a.cleaningDate).getTime());

                const groupKey = group.propertyId || group.propertyCode || group.propertyName;
                const isPastExpanded = expandedPast.has(groupKey);
                const hasActive = upcoming.length > 0;

                return (
                  <AccordionItem key={groupKey} value={groupKey} className="border-0">
                    <AccordionTrigger className="gap-3 px-4 py-3 text-left hover:bg-slate-50 hover:no-underline sm:px-5">
                      <div className="flex min-w-0 flex-1 items-center gap-3">
                        <div className={cn(
                          'flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl',
                          hasActive ? 'bg-blue-50 text-primary ring-1 ring-blue-100' : 'bg-slate-100 text-slate-500',
                        )}>
                          <Building2 className="h-5 w-5" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            {group.propertyCode && (
                              <span className="rounded-lg bg-slate-950 px-2 py-0.5 text-xs font-bold text-white">
                                {group.propertyCode}
                              </span>
                            )}
                            <span className="truncate text-sm font-semibold text-slate-950 sm:text-base">
                              {group.propertyName}
                            </span>
                          </div>
                          <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                            <span>{group.bookings.length} limpieza{group.bookings.length === 1 ? '' : 's'}</span>
                            {upcoming.length > 0 && (
                              <Badge variant="outline" className="h-5 border-emerald-200 bg-emerald-50 px-1.5 text-[10px] text-emerald-700">
                                {upcoming.length} próxima{upcoming.length === 1 ? '' : 's'}
                              </Badge>
                            )}
                            {past.length > 0 && (
                              <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">
                                {past.length} pasada{past.length === 1 ? '' : 's'}
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>
                    </AccordionTrigger>

                    <AccordionContent className="pb-0">
                      <div className="bg-slate-50/60">
                        {upcoming.length > 0 && (
                          <>
                            <SectionHeader label="Próximas limpiezas" count={upcoming.length} />
                            <div className="divide-y divide-slate-100 bg-white">
                              {upcoming.map(renderBookingRow)}
                            </div>
                          </>
                        )}

                        {past.length > 0 && (
                          <>
                            <button
                              type="button"
                              onClick={() => {
                                setExpandedPast((prev) => {
                                  const next = new Set(prev);
                                  if (next.has(groupKey)) next.delete(groupKey);
                                  else next.add(groupKey);
                                  return next;
                                });
                              }}
                              className="flex w-full items-center gap-2 border-y border-slate-100 bg-slate-100/80 px-4 py-3 text-left transition-colors hover:bg-slate-100 sm:px-5"
                            >
                              <span className="h-2.5 w-2.5 rounded-full bg-slate-400" />
                              <span className="text-xs font-bold uppercase tracking-[0.16em] text-slate-700">
                                Limpiezas pasadas
                              </span>
                              <Badge variant="secondary" className="h-5 px-2 text-xs">
                                {past.length}
                              </Badge>
                              <ChevronRight className={cn('ml-auto h-4 w-4 text-muted-foreground transition-transform', isPastExpanded && 'rotate-90')} />
                            </button>
                            {isPastExpanded && (
                              <div className="divide-y divide-slate-100 bg-white">
                                {past.map(renderBookingRow)}
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                );
              })}
            </Accordion>
          )}
        </CardContent>
      </Card>

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

const ReservationMetric = ({
  label,
  value,
  tone,
  icon: Icon,
}: {
  label: string;
  value: number;
  tone: 'emerald' | 'blue' | 'slate' | 'amber';
  icon: typeof Calendar;
}) => {
  const tones = {
    emerald: 'bg-emerald-50 text-emerald-700 border-emerald-100',
    blue: 'bg-blue-50 text-blue-700 border-blue-100',
    slate: 'bg-slate-50 text-slate-700 border-slate-100',
    amber: 'bg-amber-50 text-amber-700 border-amber-100',
  };

  return (
    <div className={cn('rounded-2xl border px-3 py-2.5', tones[tone])}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] font-medium opacity-80">{label}</span>
        <Icon className="h-3.5 w-3.5" />
      </div>
      <div className="mt-1 text-xl font-bold tabular-nums">{value}</div>
    </div>
  );
};

const SectionHeader = ({ label, count }: { label: string; count: number }) => (
  <div className="flex items-center gap-2 border-y border-slate-100 bg-emerald-50/80 px-4 py-3 sm:px-5">
    <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
    <span className="text-xs font-bold uppercase tracking-[0.16em] text-emerald-800">{label}</span>
    <Badge variant="outline" className="h-5 border-emerald-200 bg-white px-2 text-xs text-emerald-700">
      {count}
    </Badge>
  </div>
);
