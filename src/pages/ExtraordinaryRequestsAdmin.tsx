import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Sparkles, X, Check, Clock, MapPin, User, Search, Filter, Loader2, Layers } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  useAllExtraordinaryRequests,
  useCancelExtraordinaryRequest,
  useAllExtraordinaryRequestTypes,
} from '@/hooks/useExtraordinaryRequests';
import { useClients } from '@/hooks/useClients';

const statusConfig: Record<string, { label: string; className: string; icon: any }> = {
  active: { label: 'Activa', className: 'bg-emerald-100 text-emerald-800 border-emerald-200', icon: Check },
  cancelled: { label: 'Cancelada', className: 'bg-rose-100 text-rose-800 border-rose-200', icon: X },
  completed: { label: 'Completada', className: 'bg-slate-100 text-slate-700 border-slate-200', icon: Check },
};

const ExtraordinaryRequestsAdmin = () => {
  const { data: requests = [], isLoading } = useAllExtraordinaryRequests();
  const { data: types = [] } = useAllExtraordinaryRequestTypes();
  const { data: clients = [] } = useClients();
  const cancelMutation = useCancelExtraordinaryRequest();

  const [search, setSearch] = useState('');
  const [clientFilter, setClientFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [dateFrom, setDateFrom] = useState<string>('');
  const [dateTo, setDateTo] = useState<string>('');

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return requests.filter((r: any) => {
      if (clientFilter !== 'all' && r.clientId !== clientFilter) return false;
      if (statusFilter !== 'all' && r.status !== statusFilter) return false;
      if (typeFilter !== 'all' && r.requestTypeId !== typeFilter) return false;
      if (dateFrom && r.serviceDate < dateFrom) return false;
      if (dateTo && r.serviceDate > dateTo) return false;
      if (q) {
        const hay = [
          r.clientName,
          r.property?.nombre,
          r.property?.codigo,
          r.requestTypeLabelSnapshot,
          r.guestName,
          r.notes,
        ].filter(Boolean).join(' ').toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [requests, search, clientFilter, statusFilter, typeFilter, dateFrom, dateTo]);

  const counts = useMemo(() => ({
    total: filtered.length,
    active: filtered.filter((r: any) => r.status === 'active').length,
    cancelled: filtered.filter((r: any) => r.status === 'cancelled').length,
    completed: filtered.filter((r: any) => r.status === 'completed').length,
  }), [filtered]);

  const clearFilters = () => {
    setSearch('');
    setClientFilter('all');
    setStatusFilter('all');
    setTypeFilter('all');
    setDateFrom('');
    setDateTo('');
  };

  return (
    <div className="container mx-auto p-4 sm:p-6 max-w-7xl space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Solicitudes extraordinarias
          </h1>
          <p className="text-sm text-muted-foreground">
            Histórico de todas las solicitudes creadas desde los portales de cliente.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card><CardContent className="p-3"><div className="text-xs text-muted-foreground">Total</div><div className="text-2xl font-bold">{counts.total}</div></CardContent></Card>
        <Card><CardContent className="p-3"><div className="text-xs text-muted-foreground">Activas</div><div className="text-2xl font-bold text-emerald-600">{counts.active}</div></CardContent></Card>
        <Card><CardContent className="p-3"><div className="text-xs text-muted-foreground">Canceladas</div><div className="text-2xl font-bold text-rose-600">{counts.cancelled}</div></CardContent></Card>
        <Card><CardContent className="p-3"><div className="text-xs text-muted-foreground">Completadas</div><div className="text-2xl font-bold text-slate-600">{counts.completed}</div></CardContent></Card>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Filter className="h-4 w-4" /> Filtros
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por cliente, propiedad, huésped, notas…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            <div>
              <Label className="text-xs">Cliente</Label>
              <Select value={clientFilter} onValueChange={setClientFilter}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  {clients.map((c: any) => (
                    <SelectItem key={c.id} value={c.id}>{c.nombre}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Tipo de servicio</Label>
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  {types.map((t) => (
                    <SelectItem key={t.id} value={t.id}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Estado</Label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="active">Activas</SelectItem>
                  <SelectItem value="cancelled">Canceladas</SelectItem>
                  <SelectItem value="completed">Completadas</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Desde</Label>
              <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">Hasta</Label>
              <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
            </div>
          </div>
          <div className="flex justify-end">
            <Button variant="ghost" size="sm" onClick={clearFilters}>Limpiar filtros</Button>
          </div>
        </CardContent>
      </Card>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : filtered.length === 0 ? (
        <Card className="p-12 text-center border-dashed">
          <Sparkles className="h-10 w-10 mx-auto text-muted-foreground mb-3 opacity-50" />
          <p className="text-sm text-muted-foreground">
            No hay solicitudes que coincidan con los filtros.
          </p>
        </Card>
      ) : (
        <div className="space-y-2">
          {filtered.map((r: any) => {
            const cfg = statusConfig[r.status] ?? statusConfig.active;
            const StatusIcon = cfg.icon;
            return (
              <Card key={r.id} className="p-3 sm:p-4">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-sm sm:text-base">
                        {r.requestTypeLabelSnapshot}
                      </span>
                      <Badge variant="outline" className={cfg.className}>
                        <StatusIcon className="h-3 w-3 mr-1" />
                        {cfg.label}
                      </Badge>
                    </div>
                    <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-xs sm:text-sm text-muted-foreground">
                      <span className="flex items-center gap-1 font-medium text-foreground">
                        <User className="h-3.5 w-3.5" />
                        {r.clientName ?? '—'}
                      </span>
                      <span className="flex items-center gap-1">
                        <MapPin className="h-3.5 w-3.5" />
                        {r.property?.nombre ?? '—'}
                        {r.property?.codigo ? ` (${r.property.codigo})` : ''}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="h-3.5 w-3.5" />
                        {format(new Date(r.serviceDate + 'T00:00:00'), "d 'de' MMM yyyy", { locale: es })}
                        {r.serviceTime ? ` · ${r.serviceTime.slice(0, 5)}` : ''}
                      </span>
                    </div>
                    {r.guestName && (
                      <p className="text-xs text-muted-foreground mt-1">Huésped: {r.guestName}</p>
                    )}
                    {r.notes && (
                      <p className="text-xs text-muted-foreground mt-1 italic">"{r.notes}"</p>
                    )}
                    <p className="text-[11px] text-muted-foreground/70 mt-1">
                      Creada el {format(new Date(r.createdAt), "d MMM yyyy 'a las' HH:mm", { locale: es })}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-base sm:text-lg font-bold text-emerald-600">
                      {r.costSnapshot.toFixed(2)} €
                    </div>
                    {r.status === 'active' && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 text-xs text-rose-600 hover:text-rose-700"
                        disabled={cancelMutation.isPending}
                        onClick={() => {
                          if (confirm(`¿Cancelar esta solicitud? Se cancelará también la tarea asociada.`)) {
                            cancelMutation.mutate(r.id);
                          }
                        }}
                      >
                        Cancelar
                      </Button>
                    )}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default ExtraordinaryRequestsAdmin;
