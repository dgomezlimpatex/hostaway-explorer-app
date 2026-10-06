import { useState, useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, Copy, Link2, LogIn, Loader2, History, Pencil } from 'lucide-react';
import {
  useAdminClientPortals, useToggleClientPhotosVisibility, useToggleClientReservationCreation,
  useToggleClientIncidents, useCreatePortalAccess,
} from '@/hooks/useClientPortal';
import { useAdminPortalBypass } from '@/hooks/useAdminPortalBypass';
import { ClientReservationHistoryModal } from '@/components/client-portal/ClientReservationHistoryModal';
import { useToast } from '@/hooks/use-toast';

const createClientSlug = (name: string): string =>
  name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').substring(0, 50);

type StatusFilter = 'all' | 'active' | 'inactive' | 'missing';
type PhotosFilter = 'all' | 'enabled' | 'disabled';

const ClientPortalsAdmin = () => {
  const { data: rows = [], isLoading, isError, refetch } = useAdminClientPortals();
  const togglePhotos = useToggleClientPhotosVisibility();
  const toggleReservations = useToggleClientReservationCreation();
  const toggleIncidents = useToggleClientIncidents();
  const createAccess = useCreatePortalAccess();
  const bypass = useAdminPortalBypass();
  const { toast } = useToast();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [photosFilter, setPhotosFilter] = useState<PhotosFilter>('all');
  const [shareId, setShareId] = useState<string | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [historyTarget, setHistoryTarget] = useState<{ id: string; name: string } | null>(null);
  // Keep open dialogs in sync with the query after an option is changed.
  const shareTarget = rows.find(row => row.clientId === shareId);
  const editTarget = rows.find(row => row.clientId === editId);
  const portalUrl = shareTarget?.access?.shortCode
    ? `${window.location.origin}/portal/${createClientSlug(shareTarget.clientName)}-${shareTarget.access.shortCode}`
    : '';

  const filtered = useMemo(() => rows.filter(row => {
    if (search && !row.clientName.toLowerCase().includes(search.toLowerCase())) return false;
    if (statusFilter === 'active' && row.access?.isActive !== true) return false;
    if (statusFilter === 'inactive' && (!row.access || row.access.isActive)) return false;
    if (statusFilter === 'missing' && row.access) return false;
    if (photosFilter === 'enabled' && !row.photosVisibleToClient) return false;
    if (photosFilter === 'disabled' && row.photosVisibleToClient) return false;
    return true;
  }), [rows, search, statusFilter, photosFilter]);

  const copyToClipboard = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast({ title: 'Copiado', description: `${label} copiado al portapapeles` });
    } catch {
      toast({ title: 'No se pudo copiar', description: 'Selecciona el texto y cópialo manualmente.', variant: 'destructive' });
    }
  };

  return (
    <div className="container mx-auto p-4 md:p-6 space-y-5">
      <div>
        <h1 className="text-2xl font-bold">Portales de clientes</h1>
        <p className="text-muted-foreground text-sm mt-1">Accede al portal o gestiona las opciones de cada cliente.</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input aria-label="Buscar cliente" placeholder="Buscar cliente..." value={search}
            onChange={event => setSearch(event.target.value)} className="pl-9" />
        </div>
        <Select value={statusFilter} onValueChange={value => setStatusFilter(value as StatusFilter)}>
          <SelectTrigger aria-label="Estado del portal"><SelectValue placeholder="Estado" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los estados</SelectItem>
            <SelectItem value="active">Portal activo</SelectItem>
            <SelectItem value="inactive">Portal desactivado</SelectItem>
            <SelectItem value="missing">Sin portal</SelectItem>
          </SelectContent>
        </Select>
        <Select value={photosFilter} onValueChange={value => setPhotosFilter(value as PhotosFilter)}>
          <SelectTrigger aria-label="Visibilidad de fotos"><SelectValue placeholder="Fotos" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas las fotos</SelectItem>
            <SelectItem value="enabled">Fotos habilitadas</SelectItem>
            <SelectItem value="disabled">Fotos deshabilitadas</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div role="status" className="py-12 flex items-center justify-center gap-2 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" /> Cargando clientes...
            </div>
          ) : isError ? (
            <div role="alert" className="p-6 text-center space-y-3">
              <p>No se pudieron cargar los portales de clientes.</p>
              <Button variant="outline" onClick={() => refetch()}>Reintentar</Button>
            </div>
          ) : (
            <ul className="divide-y" aria-label="Portales de clientes">
              {filtered.map(row => (
                <li key={row.clientId} className="p-4 flex flex-col lg:flex-row lg:items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold break-words">{row.clientName}</p>
                    {!row.access ? <Badge variant="outline" className="mt-1 text-amber-700">Sin portal</Badge>
                      : !row.access.isActive ? <Badge variant="secondary" className="mt-1">Desactivado</Badge> : null}
                  </div>
                  <div className="grid grid-cols-2 sm:flex sm:flex-wrap gap-2 lg:shrink-0 [&>button]:h-auto [&>button]:min-h-9 [&>button]:whitespace-normal [&>button]:py-2 [&_svg]:shrink-0">
                    <Button size="sm" variant="outline" onClick={() => setShareId(row.clientId)} disabled={!row.access}>
                      <Link2 className="h-4 w-4 mr-2" /> Compartir acceso
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setEditId(row.clientId)}>
                      <Pencil className="h-4 w-4 mr-2" /> Editar cliente
                    </Button>
                    <Button size="sm" variant="outline"
                      onClick={() => setHistoryTarget({ id: row.clientId, name: row.clientName })}>
                      <History className="h-4 w-4 mr-2" /> Historial
                    </Button>
                    <Button size="sm" onClick={() => bypass.mutate({ clientId: row.clientId, clientName: row.clientName })}
                      disabled={bypass.isPending || !row.access?.isActive}>
                      {bypass.isPending && bypass.variables?.clientId === row.clientId
                        ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Abriendo...</>
                        : <><LogIn className="h-4 w-4 mr-2" /> Acceder</>}
                    </Button>
                  </div>
                </li>
              ))}
              {filtered.length === 0 && <li className="p-8 text-center text-muted-foreground text-sm">No hay clientes que coincidan con los filtros.</li>}
            </ul>
          )}
        </CardContent>
      </Card>
      <Dialog open={!!shareTarget} onOpenChange={open => !open && setShareId(null)}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto w-[calc(100%-2rem)]">
          <DialogHeader>
            <DialogTitle>Compartir acceso · {shareTarget?.clientName}</DialogTitle>
            <DialogDescription>Copia el enlace y el PIN para compartirlos con el cliente.</DialogDescription>
          </DialogHeader>
          {shareTarget?.access && <div className="space-y-4 min-w-0">
            {!shareTarget.access.isActive && <p className="text-sm text-amber-700">Este portal está desactivado. El cliente no podrá acceder.</p>}
            <div className="space-y-2">
              <label htmlFor="portal-share-link" className="text-sm font-medium">Enlace del portal</label>
              <Input id="portal-share-link" readOnly value={portalUrl || 'Enlace no disponible'} />
              <Button variant="outline" disabled={!portalUrl} onClick={() => copyToClipboard(portalUrl, 'Enlace')}>
                <Copy className="h-4 w-4 mr-2" /> Copiar enlace
              </Button>
            </div>
            <div className="space-y-2">
              <label htmlFor="portal-share-pin" className="text-sm font-medium">PIN de acceso</label>
              <Input id="portal-share-pin" readOnly value={shareTarget.access.accessPin} className="font-mono tracking-widest" />
              <Button variant="outline" onClick={() => copyToClipboard(shareTarget.access!.accessPin, 'PIN')}>
                <Copy className="h-4 w-4 mr-2" /> Copiar PIN
              </Button>
            </div>
          </div>}
        </DialogContent>
      </Dialog>
      <Dialog open={!!editTarget} onOpenChange={open => !open && setEditId(null)}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto w-[calc(100%-2rem)]">
          <DialogHeader>
            <DialogTitle>Editar cliente · {editTarget?.clientName}</DialogTitle>
            <DialogDescription>Opciones actuales de su portal. Los cambios se guardan al activar o desactivar cada opción.</DialogDescription>
          </DialogHeader>
          {editTarget && <div className="space-y-4">
            <div className="flex items-center justify-between gap-4">
              <label htmlFor="portal-photos" className="text-sm font-medium">Fotos del reporte</label>
              <Switch id="portal-photos" checked={editTarget.photosVisibleToClient} disabled={togglePhotos.isPending}
                onCheckedChange={enabled => togglePhotos.mutate({ clientId: editTarget.clientId, enabled })} />
            </div>
            <div className="flex items-center justify-between gap-4">
              <label htmlFor="portal-reservations" className="text-sm font-medium">Crear reservas</label>
              <Switch id="portal-reservations" checked={editTarget.allowReservationCreation} disabled={toggleReservations.isPending}
                onCheckedChange={enabled => toggleReservations.mutate({ clientId: editTarget.clientId, enabled })} />
            </div>
            <div className="flex items-center justify-between gap-4">
              <label htmlFor="portal-incidents" className="text-sm font-medium">Incidencias</label>
              <Switch id="portal-incidents" checked={editTarget.allowIncidents} disabled={toggleIncidents.isPending}
                onCheckedChange={enabled => toggleIncidents.mutate({ clientId: editTarget.clientId, enabled })} />
            </div>
            <div className="border-t pt-4 text-sm space-y-2">
              <p>Estado: {editTarget.access ? (editTarget.access.isActive ? 'Activo' : 'Desactivado') : 'Sin portal'}</p>
              <p className="text-muted-foreground">Último acceso: {editTarget.access?.lastAccessAt
                ? new Date(editTarget.access.lastAccessAt).toLocaleString('es-ES', { timeZone: 'Europe/Madrid' }) : '—'}</p>
              {!editTarget.access && <Button variant="outline" disabled={createAccess.isPending}
                onClick={() => createAccess.mutate(editTarget.clientId)}>
                <Link2 className="h-4 w-4 mr-2" /> {createAccess.isPending ? 'Creando...' : 'Crear acceso'}
              </Button>}
            </div>
          </div>}
        </DialogContent>
      </Dialog>
      <ClientReservationHistoryModal open={!!historyTarget} onOpenChange={open => !open && setHistoryTarget(null)}
        clientId={historyTarget?.id ?? null} clientName={historyTarget?.name ?? null} />
    </div>
  );
};

export default ClientPortalsAdmin;
