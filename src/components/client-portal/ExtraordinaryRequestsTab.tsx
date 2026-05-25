import { useState } from 'react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Plus, Sparkles, X, Check, Clock, MapPin } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import {
  useClientExtraordinaryRequests,
  useCancelExtraordinaryRequest,
} from '@/hooks/useExtraordinaryRequests';
import { CreateExtraordinaryRequestModal } from './CreateExtraordinaryRequestModal';

interface Property {
  id: string;
  nombre: string;
  codigo: string;
  direccion: string;
}

interface ExtraordinaryRequestsTabProps {
  clientId: string;
  properties: Property[];
}

const statusConfig: Record<string, { label: string; className: string; icon: any }> = {
  active: { label: 'Activa', className: 'bg-emerald-100 text-emerald-800 border-emerald-200', icon: Check },
  cancelled: { label: 'Cancelada', className: 'bg-rose-100 text-rose-800 border-rose-200', icon: X },
  completed: { label: 'Completada', className: 'bg-slate-100 text-slate-700 border-slate-200', icon: Check },
};

export const ExtraordinaryRequestsTab = ({ clientId, properties }: ExtraordinaryRequestsTabProps) => {
  const [open, setOpen] = useState(false);
  const { data: requests = [], isLoading } = useClientExtraordinaryRequests(clientId);
  const cancelMutation = useCancelExtraordinaryRequest();

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Servicios Extraordinarios
          </h2>
          <p className="text-xs sm:text-sm text-muted-foreground">
            Solicita servicios especiales para tus huéspedes
          </p>
        </div>
        <Button size="sm" onClick={() => setOpen(true)}>
          <Plus className="h-4 w-4 mr-1" />
          Nueva
        </Button>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground py-8 text-center">Cargando solicitudes…</p>
      ) : requests.length === 0 ? (
        <Card className="p-8 text-center border-dashed">
          <Sparkles className="h-10 w-10 mx-auto text-muted-foreground mb-3 opacity-50" />
          <p className="text-sm text-muted-foreground">
            Aún no has solicitado ningún servicio extraordinario.
          </p>
          <Button variant="outline" size="sm" className="mt-4" onClick={() => setOpen(true)}>
            <Plus className="h-4 w-4 mr-1" />
            Crear nueva tarea extraordinaria
          </Button>
        </Card>
      ) : (
        <div className="space-y-2">
          {requests.map((r) => {
            const cfg = statusConfig[r.status] ?? statusConfig.active;
            const StatusIcon = cfg.icon;
            return (
              <Card key={r.id} className="p-3 sm:p-4">
                <div className="flex items-start justify-between gap-3">
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
                      <span className="flex items-center gap-1">
                        <MapPin className="h-3.5 w-3.5" />
                        {r.property?.nombre ?? '—'}
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
                          if (confirm('¿Cancelar esta solicitud?')) cancelMutation.mutate(r.id);
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

      <CreateExtraordinaryRequestModal
        open={open}
        onOpenChange={setOpen}
        clientId={clientId}
        properties={properties}
      />
    </div>
  );
};
