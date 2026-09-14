import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Search, Users } from 'lucide-react';
import { CreateClientModal } from './CreateClientModal';
import { ClientList } from './ClientList';
import { ClientDetailPanel } from './ClientDetailPanel';
import { CLIENT_SERVICE_LABELS } from './clientPresentation';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { useClients } from '@/hooks/useClients';
import { useDeviceType } from '@/hooks/use-mobile';
import { useSede } from '@/contexts/SedeContext';
import { cn } from '@/lib/utils';

type StatusFilter = 'all' | 'active' | 'inactive';
const normalize = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

export const ClientsPage = () => {
  const { activeSede } = useSede();
  return <ClientsWorkspace key={activeSede?.id || 'pending-sede'} />;
};

function ClientsWorkspace() {
  const { data: clients = [], isLoading, error, refetch } = useClients();
  const { activeSede, loading: sedeLoading, isInitialized } = useSede();
  const isMobile = !useDeviceType().isDesktop;
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<StatusFilter>('all');
  const [service, setService] = useState('all');
  const [invoice, setInvoice] = useState('all');
  const busy = isLoading || sedeLoading || !isInitialized;
  const activeCount = clients.filter(client => client.isActive !== false).length;
  const filteredClients = useMemo(() => clients.filter(client => {
    const term = normalize(search.trim());
    const matchesSearch = !term || [client.nombre, client.cifNif, client.telefono, client.email, client.ciudad, client.supervisor].some(value => normalize(value || '').includes(term));
    return matchesSearch && (status === 'all' || (status === 'active' ? client.isActive !== false : client.isActive === false))
      && (service === 'all' || client.tipoServicio === service)
      && (invoice === 'all' || client.factura === (invoice === 'yes'));
  }), [clients, search, status, service, invoice]);
  const selectedClient = filteredClients.find(client => client.id === selectedId);
  const desktopClient = selectedClient || filteredClients[0];
  const hasFilters = !!search || status !== 'all' || service !== 'all' || invoice !== 'all';
  const resetFilters = () => { setSearch(''); setStatus('all'); setService('all'); setInvoice('all'); setSelectedId(null); };

  const stats = [
    { label: 'Total', value: clients.length, helper: 'clientes en la sede', tone: 'border-sky-200 bg-sky-50 text-sky-950' },
    { label: 'Activos', value: activeCount, helper: 'en servicio', tone: 'border-emerald-200 bg-emerald-50 text-emerald-950' },
    { label: 'Inactivos', value: clients.length - activeCount, helper: 'fuera de servicio', tone: 'border-slate-200 bg-white text-slate-950' },
    { label: 'Con factura', value: clients.filter(client => client.factura).length, helper: 'emisión de factura', tone: 'border-violet-200 bg-violet-50 text-violet-950' },
  ];

  return (
    <div className="min-h-dvh bg-slate-50 pb-24 md:pb-0">
      <header className="border-b border-slate-200 bg-white px-4 py-4 sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Button asChild variant="ghost" size="sm" className="hidden lg:inline-flex"><Link to="/"><ArrowLeft className="mr-2 h-4 w-4" />Volver al menú</Link></Button>
            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-[#310984]">Gestión comercial</p>
              <h1 className="flex items-center gap-2 text-2xl font-black text-slate-950"><Users className="h-6 w-6" />Clientes</h1>
              <p className="mt-1 text-sm text-slate-500">Contacto, servicios y facturación en una única ficha.</p>
            </div>
          </div>
          <CreateClientModal />
        </div>
      </header>
      <div className="mx-auto max-w-[1800px] space-y-4 p-4 sm:p-6">
        <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
          {stats.map(stat => <Card key={stat.label} className={cn('shadow-sm', stat.tone)}><CardContent className="p-4"><p className="text-[11px] font-black uppercase tracking-[0.16em] opacity-70">{stat.label}</p><p className="mt-1 text-2xl font-black">{busy || error || !activeSede ? '—' : stat.value}</p><p className="text-xs opacity-70">{stat.helper}</p></CardContent></Card>)}
        </div>
        <div className="grid items-stretch gap-4 lg:grid-cols-[320px_minmax(0,1fr)] 2xl:grid-cols-[440px_minmax(0,1fr)]">
          <Card className="flex min-h-0 min-w-0 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm lg:h-[calc(100dvh-270px)] lg:min-h-[640px]">
            <div className="space-y-4 p-4 sm:p-5">
              <div className="flex items-start justify-between gap-2">
                <div><h2 className="font-bold text-slate-950">Directorio de clientes</h2><p className="mt-1 text-sm text-slate-500">Busca y selecciona una ficha.</p></div>
                {hasFilters && <Button variant="ghost" size="sm" onClick={resetFilters}>Limpiar</Button>}
              </div>
              <div className="relative"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><Input aria-label="Buscar clientes" placeholder="Nombre, CIF/NIF, teléfono, email…" value={search} onChange={event => setSearch(event.target.value)} className="h-11 rounded-xl pl-10" /></div>
              <div className="grid grid-cols-3 gap-1 rounded-xl bg-slate-100 p-1" aria-label="Estado del cliente">
                {([{ value: 'all', label: 'Todos', count: clients.length }, { value: 'active', label: 'Activos', count: activeCount }, { value: 'inactive', label: 'Inactivos', count: clients.length - activeCount }] as const).map(item => <button key={item.value} type="button" aria-pressed={status === item.value} onClick={() => setStatus(item.value)} className={cn('rounded-lg px-2 py-2 text-xs font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#310984] focus-visible:ring-offset-2', status === item.value ? 'bg-[#310984] text-white shadow-sm' : 'text-slate-600 hover:bg-white')}>{item.label}<span className="mt-0.5 block text-[11px] opacity-75">{busy || error || !activeSede ? '—' : item.count}</span></button>)}
              </div>
              <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
                <Select value={service} onValueChange={setService}><SelectTrigger aria-label="Filtrar por servicio" className="rounded-xl text-xs"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Todos los servicios</SelectItem>{Object.entries(CLIENT_SERVICE_LABELS).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent></Select>
                <Select value={invoice} onValueChange={setInvoice}><SelectTrigger aria-label="Filtrar por facturación" className="rounded-xl text-xs"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Toda la facturación</SelectItem><SelectItem value="yes">Con factura</SelectItem><SelectItem value="no">Sin factura</SelectItem></SelectContent></Select>
              </div>
            </div>
            <div className="min-h-0 flex-1 px-3 pb-3 lg:overflow-y-auto">
              {busy ? <p role="status" className="py-12 text-center text-sm text-slate-500">Cargando clientes…</p> : error ? <div role="alert" className="rounded-xl bg-red-50 p-5 text-sm text-red-700">No se han podido cargar los clientes.<Button variant="outline" className="mt-3" onClick={() => void refetch()}>Reintentar</Button></div> : !activeSede ? <p className="py-8 text-center text-sm text-slate-500">Selecciona una sede para ver sus clientes.</p> : filteredClients.length === 0 ? <div className="rounded-xl border border-dashed p-6 text-center"><Users className="mx-auto h-9 w-9 text-slate-300" /><h3 className="mt-3 font-bold text-slate-950">{clients.length ? 'No hay coincidencias' : 'Todavía no hay clientes'}</h3><p className="mt-1 text-sm text-slate-500">{clients.length ? 'Prueba con otro nombre o ajusta los filtros.' : 'Añade tu primer cliente con «Nuevo cliente».'}</p>{hasFilters && <Button variant="outline" className="mt-4 rounded-xl" onClick={resetFilters}>Limpiar filtros</Button>}</div> : <><p aria-live="polite" className="pb-3 text-xs text-slate-500">{filteredClients.length} de {clients.length} clientes</p><ClientList clients={filteredClients} selectedClientId={isMobile ? selectedClient?.id : desktopClient?.id} onSelect={client => setSelectedId(client.id)} /></>}
            </div>
          </Card>
          {!isMobile && !busy && !error && activeSede && (desktopClient ? <ClientDetailPanel key={desktopClient.id} client={desktopClient} /> : <Card className="flex min-h-[420px] flex-col items-center justify-center rounded-2xl border-dashed p-8 text-center shadow-none"><Users className="h-12 w-12 text-slate-300" /><h2 className="mt-4 text-xl font-black text-slate-950">La ficha del cliente, de un vistazo</h2><p className="mt-2 max-w-sm text-sm text-slate-500">Selecciona un cliente del directorio para consultar sus datos y gestionar su servicio.</p></Card>)}
        </div>
      </div>
      {isMobile && <Dialog open={!!selectedClient && !error && !busy} onOpenChange={open => !open && setSelectedId(null)}><DialogContent className="max-h-[90dvh] w-[calc(100%-1rem)] overflow-y-auto rounded-2xl p-0 pt-10"><DialogTitle className="sr-only">Ficha de {selectedClient?.nombre}</DialogTitle><DialogDescription className="sr-only">Datos de contacto, facturación y servicio del cliente.</DialogDescription>{selectedClient && <ClientDetailPanel key={selectedClient.id} client={selectedClient} />}</DialogContent></Dialog>}
    </div>
  );
}
