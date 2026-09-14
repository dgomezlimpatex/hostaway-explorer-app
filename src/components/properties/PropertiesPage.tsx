import { normalizeDirectorySearch } from '@/components/directory/directorySearch';
import { useMemo, useState } from 'react';
import { Home } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { DirectoryEmpty, DirectoryPage, DirectorySearch, DirectorySegments } from '@/components/directory/DirectoryPage';
import { useProperties } from '@/hooks/useProperties';
import { useClients } from '@/hooks/useClients';
import { useDeviceType } from '@/hooks/use-mobile';
import { useSede } from '@/contexts/SedeContext';
import type { Property } from '@/types/property';
import { CreatePropertyModal } from './CreatePropertyModal';
import { PropertyList } from './PropertyList';
import { PropertyDetailPanel } from './PropertyDetailPanel';
import { isPropertyActive } from './propertyPresentation';

export const PropertiesPage = () => {
  const { activeSede } = useSede();
  return <PropertiesWorkspace key={activeSede?.id || 'pending-sede'} />;
};

function PropertiesWorkspace() {
  const propertiesQuery = useProperties();
  const clientsQuery = useClients();
  const { activeSede, loading, isInitialized } = useSede();
  const { isDesktop } = useDeviceType();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');
  const [clientFilter, setClientFilter] = useState('all');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const properties = useMemo(() => propertiesQuery.data || [], [propertiesQuery.data]);
  const clients = useMemo(() => new Map((clientsQuery.data || []).map(client => [client.id, client])), [clientsQuery.data]);
  const getClientName = (property: Property) => clients.get(property.clienteId)?.nombre || property.clientName || (property.clienteId ? 'Cliente no disponible' : 'Sin cliente asignado');
  const active = (property: Property) => isPropertyActive(property, clients.get(property.clienteId)?.isActive);
  const activeCount = properties.filter(active).length;
  const busy = loading || !isInitialized || propertiesQuery.isLoading || clientsQuery.isLoading;
  const hasError = propertiesQuery.isError || clientsQuery.isError;
  const unavailable = busy || hasError || !activeSede;
  const clientOptions = [...new Set(properties.map(property => property.clienteId).filter(Boolean))]
    .map(id => ({ id, name: clients.get(id)?.nombre || properties.find(property => property.clienteId === id)?.clientName || 'Cliente no disponible' }))
    .sort((a, b) => a.name.localeCompare(b.name, 'es'));
  const visible = properties.filter(property => {
    const matchesSearch = !search.trim() || [property.nombre, property.codigo, property.direccion, getClientName(property)].some(value => normalizeDirectorySearch(value).includes(normalizeDirectorySearch(search)));
    return matchesSearch && (status === 'all' || active(property) === (status === 'active'))
      && (clientFilter === 'all' || (clientFilter === 'unassigned' ? !property.clienteId : property.clienteId === clientFilter));
  }).sort((a, b) => a.nombre.localeCompare(b.nombre, 'es', { numeric: true, sensitivity: 'base' }));
  const selected = visible.find(property => property.id === selectedId);
  const desktopProperty = selected || visible[0];
  const hasFilters = !!search || status !== 'all' || clientFilter !== 'all';
  const reset = () => { setSearch(''); setStatus('all'); setClientFilter('all'); setSelectedId(null); };
  const count = (value: number) => unavailable ? '—' : value;
  const detail = (property: Property) => <PropertyDetailPanel key={property.id} property={property} clientName={getClientName(property)} active={active(property)} />;

  return (
    <DirectoryPage className="properties-page" title="Propiedades" eyebrow="Alojamientos" description="Características, limpiezas y checklists en una única ficha." icon={Home} actions={<CreatePropertyModal />} stats={[
      { label: 'Total', value: count(properties.length), helper: 'propiedades en la sede', tone: 'neutral' },
      { label: 'Activas', value: count(activeCount), helper: 'disponibles para servicio', tone: 'neutral' },
      { label: 'Inactivas', value: count(properties.length - activeCount), helper: 'fuera de servicio', tone: 'muted' },
      { label: 'Clientes', value: count(clientOptions.length), helper: 'con propiedades', tone: 'neutral' },
    ]}>
      <div className="grid items-stretch gap-4 lg:grid-cols-[320px_minmax(0,1fr)] 2xl:grid-cols-[440px_minmax(0,1fr)]">
        <Card aria-label="Directorio de propiedades" className="flex min-h-0 min-w-0 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm lg:h-[calc(100dvh-270px)] lg:min-h-[640px]">
          <div className="space-y-4 p-4 sm:p-5">
            <div className="flex items-start justify-between gap-2">
              <div><h2 className="font-semibold tracking-tight">Directorio de propiedades</h2><p className="mt-1 text-sm text-slate-500">Despliega un cliente y selecciona su propiedad.</p></div>
              {hasFilters && <Button variant="ghost" size="sm" onClick={reset}>Limpiar</Button>}
            </div>
            <DirectorySearch value={search} onChange={setSearch} placeholder="Buscar nombre, código, dirección o cliente" />
            <DirectorySegments value={status} onChange={setStatus} options={[
              { value: 'all', label: 'Todas', count: count(properties.length) },
              { value: 'active', label: 'Activas', count: count(activeCount) },
              { value: 'inactive', label: 'Inactivas', count: count(properties.length - activeCount) },
            ]} />
            <Select value={clientFilter} onValueChange={setClientFilter}>
              <SelectTrigger aria-label="Filtrar por cliente" className="rounded-xl bg-white"><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="all">Todos los clientes</SelectItem><SelectItem value="unassigned">Sin cliente asignado</SelectItem>{clientOptions.map(client => <SelectItem key={client.id} value={client.id}>{client.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="min-h-0 flex-1 px-3 pb-3 lg:overflow-y-auto">
            {busy ? <p role="status" className="py-10 text-center text-sm text-slate-500">Cargando propiedades…</p> : hasError ? (
              <div role="alert" className="rounded-xl bg-red-50 p-4 text-sm text-red-700">No se han podido cargar las propiedades o sus clientes.<Button variant="outline" className="mt-3" onClick={() => { void propertiesQuery.refetch(); void clientsQuery.refetch(); }}>Reintentar</Button></div>
            ) : !activeSede ? <DirectoryEmpty title="Selecciona una sede" description="Elige una sede para consultar sus propiedades." /> : visible.length === 0 ? (
              <DirectoryEmpty title={properties.length ? 'No hay coincidencias' : 'Todavía no hay propiedades'} description={properties.length ? 'Prueba con otro nombre o ajusta los filtros.' : 'Añade tu primer alojamiento con «Nueva propiedad».'} action={hasFilters && <Button variant="outline" onClick={reset}>Limpiar filtros</Button>} />
            ) : <><p aria-live="polite" className="pb-3 text-xs text-slate-500">{visible.length} de {properties.length} propiedades</p><PropertyList key={JSON.stringify([search, status, clientFilter])} expandMatches={hasFilters} properties={visible} selectedPropertyId={isDesktop ? desktopProperty?.id : selected?.id} onSelect={property => setSelectedId(property.id)} getClientName={getClientName} isActive={active} /></>}
          </div>
        </Card>
        {isDesktop && !unavailable && (desktopProperty ? detail(desktopProperty) : <DirectoryEmpty title="La ficha de tu alojamiento" description="Selecciona una propiedad para consultar sus características y gestionar su servicio." />)}
      </div>
      {!isDesktop && <Dialog open={!!selected && !unavailable} onOpenChange={open => !open && setSelectedId(null)}>
        <DialogContent className="max-h-[90dvh] w-[calc(100%-1rem)] max-w-2xl overflow-y-auto rounded-2xl p-0 pt-10">
          <DialogTitle className="sr-only">Ficha de {selected?.nombre}</DialogTitle><DialogDescription className="sr-only">Características, servicio y limpiezas de la propiedad.</DialogDescription>
          {selected && detail(selected)}
        </DialogContent>
      </Dialog>}
    </DirectoryPage>
  );
}
