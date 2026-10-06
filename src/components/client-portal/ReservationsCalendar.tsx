import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Clock3, Loader2, Moon, Search } from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';
import type { PortalBooking } from '@/types/clientPortal';
import { ReservationDetailModal } from './ReservationDetailModal';
import { calendarDay, cleansOn, dayLabel, hasStay, madridToday, nightCount, occupiesNight, shiftDay, stayBarSegment, weekOf } from './calendar/portalOccupancy';

interface Property { id: string; codigo: string; nombre: string }
interface Props { bookings: PortalBooking[]; properties?: Property[]; clientId: string; isLoading: boolean }

export const ReservationsCalendar = ({ bookings, properties = [], clientId, isLoading }: Props) => {
  const mobile = useIsMobile();
  const [selectedDay, setSelectedDay] = useState(madridToday);
  const [view, setView] = useState<'auto' | 'day' | 'week' | 'month'>('auto');
  const [search, setSearch] = useState('');
  const [detail, setDetail] = useState<PortalBooking | null>(null);
  const mode = view === 'auto' ? mobile ? 'day' : 'week' : view;
  const days = weekOf(selectedDay);
  const propertyRows = useMemo(() => {
    const map = new Map(properties.map(property => [property.id, property]));
    bookings.forEach(booking => { if (booking.property) map.set(booking.property.id, booking.property); });
    return [...map.values()].sort((a, b) => (a.codigo || a.nombre).localeCompare(b.codigo || b.nombre, 'es', { numeric: true }))
      .filter(property => `${property.codigo} ${property.nombre}`.toLowerCase().includes(search.trim().toLowerCase()));
  }, [properties, bookings, search]);
  const movePeriod = (direction: number) => {
    if (mode !== 'month') { setSelectedDay(shiftDay(selectedDay, direction * (mode === 'day' ? 1 : 7))); return; }
    const date = new Date(`${selectedDay.slice(0, 7)}-01T12:00:00Z`);
    date.setUTCMonth(date.getUTCMonth() + direction);
    setSelectedDay(date.toISOString().slice(0, 10));
  };
  const cleaningButton = (booking: PortalBooking) => <button key={booking.id} type="button" className="portal-cleaning" onClick={() => setDetail(booking)} aria-label={`Ver limpieza de ${booking.property?.nombre || 'propiedad'} el ${dayLabel(booking.cleaningDate.slice(0, 10), { day: 'numeric', month: 'long' })}`}>
    <Clock3 size={14} /><span>Limpieza{booking.startTime ? ` · ${booking.startTime.slice(0, 5)}` : ''}</span>
  </button>;
  const agenda = () => <div className="portal-agenda">
    <h3>{dayLabel(selectedDay, { weekday: 'long', day: 'numeric', month: 'long' })}</h3>
    {propertyRows.map(property => {
      const rows = bookings.filter(booking => booking.property?.id === property.id);
      const stays = rows.filter(booking => occupiesNight(booking, selectedDay));
      const cleanings = rows.filter(booking => cleansOn(booking, selectedDay));
      return <article key={property.id} className="portal-agenda-card">
        <header><div><span className="portal-property-code">{property.codigo}</span><h4>{property.nombre}</h4></div><span className={stays.length ? 'portal-occupied-label' : 'portal-free-label'}>{stays.length ? 'Noche ocupada' : 'Sin estancia registrada'}</span></header>
        {stays.map(booking => <button key={booking.id} type="button" className="portal-stay-summary" onClick={() => setDetail(booking)}><Moon size={16} /><span>{dayLabel(calendarDay(booking.checkInDate)!, { day: 'numeric', month: 'short' })} → {dayLabel(calendarDay(booking.checkOutDate)!, { day: 'numeric', month: 'short' })}<small>{nightCount(booking)} noches</small></span><ChevronRight size={16} /></button>)}
        {cleanings.map(cleaningButton)}
        {!cleanings.length && <p className="portal-no-cleaning">Sin limpieza prevista</p>}
      </article>;
    })}
    {!propertyRows.length && <p className="portal-empty">No hay propiedades con esta búsqueda.</p>}
  </div>;
  if (isLoading) return <div className="portal-empty"><Loader2 className="mx-auto animate-spin" />Cargando calendario...</div>;
  return <section className="portal-calendar">
    <div className="portal-calendar-toolbar">
      <div><h2>{dayLabel(selectedDay, { month: 'long', year: 'numeric' })}</h2><p>Estancias por noche y limpiezas previstas</p></div>
      <div className="portal-view-switch" aria-label="Vista del calendario">{(['day', 'week', 'month'] as const).map(option => <button key={option} type="button" aria-pressed={mode === option} onClick={() => setView(option)}>{option === 'day' ? 'Día' : option === 'week' ? 'Semana' : 'Mes'}</button>)}</div>
    </div>
    <div className="portal-calendar-controls"><label className="portal-search"><Search size={16} /><input value={search} onChange={event => setSearch(event.target.value)} aria-label="Buscar alojamiento" placeholder="Buscar alojamiento" /></label><div><button type="button" onClick={() => setSelectedDay(madridToday())}>Hoy</button><button type="button" onClick={() => movePeriod(-1)} aria-label="Periodo anterior"><ChevronLeft size={20} /></button><button type="button" onClick={() => movePeriod(1)} aria-label="Periodo siguiente"><ChevronRight size={20} /></button></div></div>
    {mode === 'month' ? <div className="portal-month">
      <div className="portal-month-weekdays">{['L', 'M', 'X', 'J', 'V', 'S', 'D'].map((day, index) => <span key={index}>{day}</span>)}</div>
      <div className="portal-month-grid">{Array.from({ length: 42 }, (_, index) => shiftDay(weekOf(`${selectedDay.slice(0, 7)}-01`)[0], index)).map(day => {
        const visibleBookings = bookings.filter(booking => propertyRows.some(property => property.id === booking.property?.id));
        const occupied = new Set(visibleBookings.filter(booking => occupiesNight(booking, day)).map(booking => booking.property?.id)).size;
        const cleans = visibleBookings.filter(booking => cleansOn(booking, day)).length;
        return <button type="button" key={day} className={`${day.slice(0, 7) !== selectedDay.slice(0, 7) ? 'outside' : ''} ${day === madridToday() ? 'today' : ''}`} onClick={() => { setSelectedDay(day); setView('day'); }} aria-label={`${dayLabel(day, { day: 'numeric', month: 'long' })}: ${occupied} alojamientos ocupados, ${cleans} limpiezas`}><strong>{Number(day.slice(-2))}</strong>{occupied > 0 && <span><Moon size={12} />{occupied}</span>}{cleans > 0 && <span><Clock3 size={12} />{cleans}</span>}</button>;
      })}</div>
    </div> : mode === 'day' ? <><div className="portal-day-strip">{days.map(day => <button key={day} type="button" aria-pressed={day === selectedDay} onClick={() => setSelectedDay(day)}><span>{dayLabel(day, { weekday: 'short' })}</span><strong>{Number(day.slice(-2))}</strong><i className={bookings.some(booking => cleansOn(booking, day)) ? 'has-cleaning' : ''} /></button>)}</div>{agenda()}</> : <div className="portal-timeline-scroll"><div className="portal-timeline">
      <div className="portal-timeline-header"><span>Alojamiento</span>{days.map(day => <button type="button" key={day} className={day === madridToday() ? 'today' : ''} onClick={() => { setSelectedDay(day); setView('day'); }}><small>{dayLabel(day, { weekday: 'short' })}</small><strong>{Number(day.slice(-2))}</strong></button>)}</div>
      {propertyRows.map(property => {
        const rows = bookings.filter(booking => booking.property?.id === property.id && booking.status !== 'cancelled');
        const stays = rows.filter(hasStay).filter(booking => stayBarSegment(booking, days));
        return <div className="portal-timeline-row" key={property.id}><div className="portal-timeline-property"><span className="portal-property-code">{property.codigo}</span><strong>{property.nombre}</strong></div><div className="portal-timeline-lanes">
          <div className="portal-night-grid">{days.map(day => <span key={day} />)}</div>
          {stays.map(booking => { const segment = stayBarSegment(booking, days)!; return <div className="portal-stay-lane" key={booking.id}><button type="button" className="portal-stay-bar" style={{ left: `${segment.start / days.length * 100}%`, width: `${segment.span / days.length * 100}%` }} onClick={() => setDetail(booking)} aria-label={`Estancia de ${property.nombre}: ${booking.checkInDate} a ${booking.checkOutDate}`}><Moon size={13} /><span>{nightCount(booking)} noches</span></button></div>; })}
          <div className="portal-cleaning-lane">{days.map(day => <div key={day}>{rows.filter(booking => cleansOn(booking, day)).map(cleaningButton)}</div>)}</div>
        </div></div>;
      })}
      {!propertyRows.length && <p className="portal-empty">No hay propiedades con esta búsqueda.</p>}
    </div></div>}
    <div className="portal-calendar-legend"><span><Moon size={14} /> Noche ocupada</span><span><Clock3 size={14} /> Limpieza</span><p>La noche de salida no se marca como ocupada. Las tareas sin estancia muestran solo la limpieza.</p></div>
    <ReservationDetailModal booking={detail} clientId={clientId} open={!!detail} onOpenChange={open => { if (!open) setDetail(null); }} />
  </section>;
};
