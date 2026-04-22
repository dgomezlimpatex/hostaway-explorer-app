import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Search, Eye, EyeOff, Copy, ExternalLink, Link2, LogIn, Loader2, Camera, CameraOff,
  CalendarPlus, CalendarOff, History,
} from 'lucide-react';
import {
  useAdminClientPortals,
  useToggleClientPhotosVisibility,
  useToggleClientReservationCreation,
  useCreatePortalAccess,
} from '@/hooks/useClientPortal';
import { useAdminPortalBypass } from '@/hooks/useAdminPortalBypass';
import { ClientReservationHistoryModal } from '@/components/client-portal/ClientReservationHistoryModal';
import { useToast } from '@/hooks/use-toast';

const createClientSlug = (name: string): string =>
  name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .substring(0, 50);

type StatusFilter = 'all' | 'active' | 'inactive' | 'missing';
type PhotosFilter = 'all' | 'enabled' | 'disabled';

const ClientPortalsAdmin = () => {
  const { data: rows = [], isLoading } = useAdminClientPortals();
  const togglePhotos = useToggleClientPhotosVisibility();
  const toggleReservations = useToggleClientReservationCreation();
  const createAccess = useCreatePortalAccess();
  const bypass = useAdminPortalBypass();
  const { toast } = useToast();

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [photosFilter, setPhotosFilter] = useState<PhotosFilter>('all');
  const [shownPins, setShownPins] = useState<Set<string>>(new Set());
  const [historyTarget, setHistoryTarget] = useState<{ id: string; name: string } | null>(null);

  const filtered = useMemo(() => {
    return rows.filter(r => {
      if (search && !r.clientName.toLowerCase().includes(search.toLowerCase())) return false;
      if (statusFilter !== 'all') {
        const isActive = r.access?.isActive === true;
        const isInactive = r.access && !r.access.isActive;
        const isMissing = !r.access;
        if (statusFilter === 'active' && !isActive) return false;
        if (statusFilter === 'inactive' && !isInactive) return false;
        if (statusFilter === 'missing' && !isMissing) return false;
      }
      if (photosFilter === 'enabled' && !r.photosVisibleToClient) return false;
      if (photosFilter === 'disabled' && r.photosVisibleToClient) return false;
      return true;
    });
  }, [rows, search, statusFilter, photosFilter]);

  const togglePin = (id: string) => {
    setShownPins(prev => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: 'Copiado', description: `${label} copiado al portapapeles` });
  };

  const buildPortalUrl = (clientName: string, shortCode: string) =>
    `${window.location.origin}/portal/${createClientSlug(clientName)}-${shortCode}`;

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Portales de clientes</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Gestiona el acceso de cada cliente a su portal y la visibilidad de fotos del reporte.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Filtros</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar cliente..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as StatusFilter)}>
            <SelectTrigger><SelectValue placeholder="Estado" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los estados</SelectItem>
              <SelectItem value="active">Portal activo</SelectItem>
              <SelectItem value="inactive">Portal desactivado</SelectItem>
              <SelectItem value="missing">Sin portal</SelectItem>
            </SelectContent>
          </Select>
          <Select value={photosFilter} onValueChange={(v) => setPhotosFilter(v as PhotosFilter)}>
            <SelectTrigger><SelectValue placeholder="Fotos" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas las fotos</SelectItem>
              <SelectItem value="enabled">Fotos habilitadas</SelectItem>
              <SelectItem value="disabled">Fotos deshabilitadas</SelectItem>
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="py-12 text-center">
              <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>PIN</TableHead>
                    <TableHead>Enlace</TableHead>
                    <TableHead className="text-center">Fotos</TableHead>
                    <TableHead className="text-center">Crear reservas</TableHead>
                    <TableHead>Último acceso</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((row) => {
                    const a = row.access;
                    const portalUrl = a?.shortCode ? buildPortalUrl(row.clientName, a.shortCode) : '';
                    const pinShown = a ? shownPins.has(a.id) : false;

                    return (
                      <TableRow key={row.clientId}>
                        <TableCell className="font-medium">{row.clientName}</TableCell>
                        <TableCell>
                          {!a ? (
                            <Badge variant="outline" className="text-amber-700 border-amber-300 bg-amber-50">⚠️ Sin crear</Badge>
                          ) : a.isActive ? (
                            <Badge className="bg-emerald-500/15 text-emerald-700 border-emerald-200 hover:bg-emerald-500/20">✅ Activo</Badge>
                          ) : (
                            <Badge variant="secondary">⏸️ Desactivado</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          {a ? (
                            <div className="flex items-center gap-1">
                              <code className="text-xs bg-muted px-2 py-1 rounded font-mono tracking-widest">
                                {pinShown ? a.accessPin : '••••••'}
                              </code>
                              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => togglePin(a.id)}>
                                {pinShown ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                              </Button>
                              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => copyToClipboard(a.accessPin, 'PIN')}>
                                <Copy className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {portalUrl ? (
                            <div className="flex items-center gap-1">
                              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => copyToClipboard(portalUrl, 'Enlace')}>
                                <Copy className="h-3.5 w-3.5" />
                              </Button>
                              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => window.open(portalUrl, '_blank')}>
                                <ExternalLink className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-center">
                          <div className="flex items-center justify-center gap-2">
                            {row.photosVisibleToClient
                              ? <Camera className="h-4 w-4 text-emerald-600" />
                              : <CameraOff className="h-4 w-4 text-muted-foreground" />}
                            <Switch
                              checked={row.photosVisibleToClient}
                              onCheckedChange={(checked) =>
                                togglePhotos.mutate({ clientId: row.clientId, enabled: checked })}
                              disabled={togglePhotos.isPending}
                            />
                          </div>
                        </TableCell>
                        <TableCell className="text-center">
                          <div className="flex items-center justify-center gap-2">
                            {row.allowReservationCreation
                              ? <CalendarPlus className="h-4 w-4 text-emerald-600" />
                              : <CalendarOff className="h-4 w-4 text-muted-foreground" />}
                            <Switch
                              checked={row.allowReservationCreation}
                              onCheckedChange={(checked) =>
                                toggleReservations.mutate({ clientId: row.clientId, enabled: checked })}
                              disabled={toggleReservations.isPending}
                            />
                          </div>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {a?.lastAccessAt
                            ? new Date(a.lastAccessAt).toLocaleDateString('es-ES')
                            : '—'}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => setHistoryTarget({ id: row.clientId, name: row.clientName })}
                              title="Ver historial de cambios del portal"
                            >
                              <History className="h-3.5 w-3.5 mr-1" />
                              Historial
                            </Button>
                            {!a ? (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => createAccess.mutate(row.clientId)}
                                disabled={createAccess.isPending}
                              >
                                <Link2 className="h-3.5 w-3.5 mr-1" />
                                Crear acceso
                              </Button>
                            ) : (
                              <Button
                                size="sm"
                                onClick={() => bypass.mutate({ clientId: row.clientId, clientName: row.clientName })}
                                disabled={bypass.isPending || !a.isActive}
                              >
                                <LogIn className="h-3.5 w-3.5 mr-1" />
                                Acceder
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {filtered.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-8 text-muted-foreground text-sm">
                        No hay clientes que coincidan con los filtros.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <ClientReservationHistoryModal
        open={!!historyTarget}
        onOpenChange={(open) => !open && setHistoryTarget(null)}
        clientId={historyTarget?.id ?? null}
        clientName={historyTarget?.name ?? null}
      />
    </div>
  );
};

export default ClientPortalsAdmin;
