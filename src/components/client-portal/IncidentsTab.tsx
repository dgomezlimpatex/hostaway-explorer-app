import { useState } from 'react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { AlertTriangle, MapPin, Check, X, Clock, ChevronRight, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Textarea } from '@/components/ui/textarea';
import {
  usePortalIncidents,
  usePortalUpdateIncident,
  PortalIncident,
  PortalIncidentStatus,
} from '@/hooks/usePortalIncidents';

const statusConfig: Record<PortalIncidentStatus, { label: string; className: string }> = {
  open: { label: 'Nueva', className: 'bg-amber-100 text-amber-800 border-amber-200' },
  in_progress: { label: 'En proceso', className: 'bg-sky-100 text-sky-800 border-sky-200' },
  resolved: { label: 'Resuelta', className: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
  discarded: { label: 'Descartada', className: 'bg-slate-100 text-slate-700 border-slate-200' },
};

interface Props {
  clientId: string;
}

export const IncidentsTab = ({ clientId }: Props) => {
  const { data: incidents = [], isLoading } = usePortalIncidents(clientId);
  const [selected, setSelected] = useState<PortalIncident | null>(null);
  const [note, setNote] = useState('');
  const updateMutation = usePortalUpdateIncident();

  const handleAction = async (toStatus: 'resolved' | 'discarded' | 'in_progress') => {
    if (!selected) return;
    await updateMutation.mutateAsync({
      incidentId: selected.id,
      toStatus,
      note: note.trim() || undefined,
      clientId,
    });
    setSelected(null);
    setNote('');
  };

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-primary" />
          Incidencias
        </h2>
        <p className="text-xs sm:text-sm text-muted-foreground">
          Reportes de los equipos de limpieza sobre tus propiedades
        </p>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground py-8 text-center">Cargando incidencias…</p>
      ) : incidents.length === 0 ? (
        <Card className="p-8 text-center border-dashed">
          <AlertTriangle className="h-10 w-10 mx-auto text-muted-foreground mb-3 opacity-50" />
          <p className="text-sm text-muted-foreground">No tienes incidencias reportadas.</p>
        </Card>
      ) : (
        <div className="space-y-2">
          {incidents.map((i) => {
            const cfg = statusConfig[i.status];
            return (
              <Card
                key={i.id}
                className="p-3 sm:p-4 cursor-pointer hover:bg-accent/40 transition-colors"
                onClick={() => {
                  setSelected(i);
                  setNote('');
                }}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-sm sm:text-base">
                        {i.category?.label ?? 'Incidencia'}
                      </span>
                      <Badge variant="outline" className={cfg.className}>
                        {cfg.label}
                      </Badge>
                      {i.media && i.media.length > 0 && (
                        <Badge variant="outline" className="text-xs">
                          {i.media.length} foto{i.media.length !== 1 ? 's' : ''}
                        </Badge>
                      )}
                    </div>
                    <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-xs sm:text-sm text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <MapPin className="h-3.5 w-3.5" />
                        {i.property?.nombre ?? '—'}
                        {i.location ? ` · ${i.location}` : ''}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="h-3.5 w-3.5" />
                        {format(new Date(i.created_at), "d MMM yyyy · HH:mm", { locale: es })}
                      </span>
                    </div>
                    <p className="text-xs sm:text-sm mt-2 line-clamp-2">{i.description}</p>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0 mt-1" />
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <Sheet open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
          {selected && (
            <>
              <SheetHeader>
                <SheetTitle className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-primary" />
                  {selected.category?.label ?? 'Incidencia'}
                </SheetTitle>
              </SheetHeader>

              <div className="mt-4 space-y-4">
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant="outline" className={statusConfig[selected.status].className}>
                    {statusConfig[selected.status].label}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    {format(new Date(selected.created_at), "d 'de' MMM yyyy · HH:mm", { locale: es })}
                  </span>
                </div>

                <div>
                  <div className="text-xs font-medium text-muted-foreground mb-1">Propiedad</div>
                  <div className="text-sm">
                    {selected.property?.nombre ?? '—'}
                    {selected.location && (
                      <span className="text-muted-foreground"> · {selected.location}</span>
                    )}
                  </div>
                </div>

                <div>
                  <div className="text-xs font-medium text-muted-foreground mb-1">Descripción</div>
                  <p className="text-sm whitespace-pre-wrap">{selected.description}</p>
                </div>

                {selected.media && selected.media.length > 0 && (
                  <div>
                    <div className="text-xs font-medium text-muted-foreground mb-2">
                      Evidencias ({selected.media.length})
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      {selected.media.map((m) => (
                        <a
                          key={m.id}
                          href={m.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="block aspect-square rounded-md overflow-hidden bg-muted"
                        >
                          {m.kind === 'video' ? (
                            <video src={m.url} className="w-full h-full object-cover" />
                          ) : (
                            <img
                              src={m.url}
                              alt="Evidencia"
                              className="w-full h-full object-cover"
                            />
                          )}
                        </a>
                      ))}
                    </div>
                  </div>
                )}

                {selected.resolution_note && (
                  <div className="rounded-md border border-emerald-200 bg-emerald-50 p-3">
                    <div className="text-xs font-medium text-emerald-800 mb-1">Resolución</div>
                    <p className="text-sm text-emerald-900">{selected.resolution_note}</p>
                  </div>
                )}

                {selected.client_discard_reason && (
                  <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
                    <div className="text-xs font-medium text-slate-700 mb-1">Motivo de descarte</div>
                    <p className="text-sm text-slate-800">{selected.client_discard_reason}</p>
                  </div>
                )}

                {(selected.status === 'open' || selected.status === 'in_progress') && (
                  <div className="space-y-3 border-t pt-4">
                    <div>
                      <label className="text-xs font-medium text-muted-foreground">
                        Comentario (opcional)
                      </label>
                      <Textarea
                        value={note}
                        onChange={(e) => setNote(e.target.value)}
                        placeholder="Añade un comentario para el equipo…"
                        rows={3}
                        className="mt-1"
                      />
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      {selected.status === 'open' && (
                        <Button
                          variant="outline"
                          onClick={() => handleAction('in_progress')}
                          disabled={updateMutation.isPending}
                        >
                          <Clock className="h-4 w-4 mr-1" />
                          En proceso
                        </Button>
                      )}
                      <Button
                        onClick={() => handleAction('resolved')}
                        disabled={updateMutation.isPending}
                        className="bg-emerald-600 hover:bg-emerald-700"
                      >
                        {updateMutation.isPending ? (
                          <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                        ) : (
                          <Check className="h-4 w-4 mr-1" />
                        )}
                        Resolver
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => handleAction('discarded')}
                        disabled={updateMutation.isPending}
                        className="text-rose-600 hover:text-rose-700"
                      >
                        <X className="h-4 w-4 mr-1" />
                        Descartar
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
};
