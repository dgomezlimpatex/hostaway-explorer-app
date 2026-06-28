import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAddIncidentComment, useIncidents, useIncidentDetail, useIncidentStats, useUpdateIncidentStatus, IncidentStatus } from '@/hooks/useIncidents';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Card } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  AlertTriangle, Check, X, Clock, CheckCircle2, Loader2, Eye, Search, ExternalLink,
  MessageSquare, List, Plus, CalendarDays, RotateCcw,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { CreateManualIncidentDialog } from './CreateManualIncidentDialog';

const STATUS_META: Record<IncidentStatus, { label: string; color: string }> = {
  pending_limpatex: { label: 'Pendiente Limpatex', color: 'bg-amber-100 text-amber-800 border-amber-200' },
  discarded_limpatex: { label: 'Descartada (interna)', color: 'bg-gray-100 text-gray-700 border-gray-200' },
  open: { label: 'Abierta', color: 'bg-red-100 text-red-800 border-red-200' },
  in_progress: { label: 'En curso', color: 'bg-blue-100 text-blue-800 border-blue-200' },
  resolved: { label: 'Resuelta', color: 'bg-green-100 text-green-800 border-green-200' },
  discarded: { label: 'Descartada (cliente)', color: 'bg-gray-100 text-gray-700 border-gray-200' },
};

const EMPTY_MESSAGES: Record<IncidentStatus | 'all', string> = {
  pending_limpatex: 'No hay incidencias pendientes de revisión.',
  discarded_limpatex: 'No hay incidencias descartadas en esta vista.',
  open: 'No hay incidencias abiertas.',
  in_progress: 'No hay incidencias en curso.',
  resolved: 'Todavía no hay incidencias resueltas en esta vista.',
  discarded: 'No hay incidencias descartadas en esta vista.',
  all: 'No hay incidencias registradas.',
};

export const IncidentsAdminInbox: React.FC = () => {
  const navigate = useNavigate();
  const [statusFilter, setStatusFilter] = useState<IncidentStatus | 'all'>('pending_limpatex');
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [manualDialogOpen, setManualDialogOpen] = useState(false);

  const { data: stats } = useIncidentStats();
  const { data: incidents = [], isLoading } = useIncidents({ status: statusFilter, search });
  const { data: detail } = useIncidentDetail(selectedId);
  const updateStatus = useUpdateIncidentStatus();
  const addComment = useAddIncidentComment();

  const [commentText, setCommentText] = useState('');
  const emptyMessage = EMPTY_MESSAGES[statusFilter];
  const hasSearch = search.trim().length > 0;
  const emptyHint = useMemo(() => {
    if (hasSearch) return 'La búsqueda actual puede estar ocultando incidencias de esta pestaña.';
    if (statusFilter === 'all') return 'Puedes crear una incidencia manual si necesitas registrar un aviso interno.';
    return 'Cambia a Todas o revisa el calendario para continuar la gestión operativa.';
  }, [hasSearch, statusFilter]);

  const handleViewAll = () => setStatusFilter('all');

  const handleAction = async (toStatus: IncidentStatus) => {
    if (!detail) return;
    await updateStatus.mutateAsync({
      id: detail.id,
      toStatus,
      fromStatus: detail.status,
    });
    if (toStatus === 'discarded_limpatex' || toStatus === 'resolved' || toStatus === 'discarded') {
      setSelectedId(null);
    }
  };

  const handleAddComment = async () => {
    if (!detail || !commentText.trim()) return;
    await addComment.mutateAsync({ incidentId: detail.id, body: commentText });
    setCommentText('');
  };

  const TABS: { value: IncidentStatus | 'all'; label: string; count?: number }[] = [
    { value: 'pending_limpatex', label: 'Pendientes', count: stats?.pending_limpatex },
    { value: 'open', label: 'Abiertas', count: stats?.open },
    { value: 'in_progress', label: 'En curso', count: stats?.in_progress },
    { value: 'resolved', label: 'Resueltas', count: stats?.resolved },
    { value: 'all', label: 'Todas', count: stats?.total },
  ];

  return (
    <div className="space-y-4">
      {/* Header / filtros */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <Tabs value={statusFilter} onValueChange={(v) => setStatusFilter(v as IncidentStatus | 'all')} className="flex-1">
          <TabsList className="flex-wrap h-auto">
            {TABS.map((t) => (
              <TabsTrigger key={t.value} value={t.value} className="text-xs gap-1.5">
                {t.label}
                {typeof t.count === 'number' && (
                  <span className="bg-muted text-muted-foreground rounded-full px-1.5 py-0.5 text-[10px]">
                    {t.count}
                  </span>
                )}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por descripción, propiedad…"
            className="pl-9 h-9"
          />
        </div>
      </div>

      {/* Lista */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin mr-2" /> Cargando incidencias…
        </div>
      ) : incidents.length === 0 ? (
        <Card className="p-8 sm:p-12 text-center">
          <AlertTriangle className="h-10 w-10 mx-auto mb-3 text-muted-foreground opacity-40" />
          <p className="text-sm font-medium text-foreground">{emptyMessage}</p>
          <p className="text-xs text-muted-foreground mt-1 max-w-md mx-auto">{emptyHint}</p>

          <div className="flex flex-col sm:flex-row flex-wrap items-center justify-center gap-2 mt-5">
            <Button variant="outline" onClick={handleViewAll} disabled={statusFilter === 'all'} className="w-full sm:w-auto">
              <List className="h-4 w-4 mr-2" />
              Ver todas
            </Button>
            <Button onClick={() => setManualDialogOpen(true)} className="w-full sm:w-auto">
              <Plus className="h-4 w-4 mr-2" />
              Crear incidencia manual
            </Button>
            <Button variant="secondary" onClick={() => navigate('/calendar')} className="w-full sm:w-auto">
              <CalendarDays className="h-4 w-4 mr-2" />
              Ir al calendario
            </Button>
            {hasSearch && (
              <Button variant="ghost" onClick={() => setSearch('')} className="w-full sm:w-auto">
                <RotateCcw className="h-4 w-4 mr-2" />
                Limpiar búsqueda
              </Button>
            )}
          </div>
        </Card>
      ) : (
        <div className="grid gap-2">
          {incidents.map((inc) => {
            const meta = STATUS_META[inc.status];
            return (
              <Card
                key={inc.id}
                className="p-4 hover:shadow-md transition-shadow cursor-pointer"
                onClick={() => setSelectedId(inc.id)}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <Badge variant="outline" className={cn('text-[10px]', meta.color)}>
                        {meta.label}
                      </Badge>
                      {inc.category && (
                        <Badge variant="secondary" className="text-[10px]">{inc.category.label}</Badge>
                      )}
                      {inc.reporter_kind === 'limpatex_admin' && (
                        <Badge variant="outline" className="text-[10px]">Creada por Limpatex</Badge>
                      )}
                      <span className="text-[11px] text-muted-foreground">
                        {format(new Date(inc.created_at), "d MMM yyyy 'a las' HH:mm", { locale: es })}
                      </span>
                    </div>
                    <p className="text-sm font-medium truncate">
                      {inc.client?.nombre || '—'} · {inc.property?.nombre || 'Sin propiedad'}
                      {inc.location && <span className="text-muted-foreground"> · {inc.location}</span>}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{inc.description}</p>
                    {inc.cleaner?.name && (
                      <p className="text-[11px] text-muted-foreground mt-1">
                        Reportada por: {inc.cleaner.name}
                      </p>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    {inc.media && inc.media.length > 0 && (
                      <Badge variant="outline" className="text-[10px]">
                        {inc.media.length} adjunto{inc.media.length === 1 ? '' : 's'}
                      </Badge>
                    )}
                    <Button size="sm" variant="ghost" className="h-8 gap-1">
                      <Eye className="h-3.5 w-3.5" /> Ver
                    </Button>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Detail Sheet */}
      <Sheet open={!!selectedId} onOpenChange={(o) => !o && setSelectedId(null)}>
        <SheetContent side="right" className="w-full sm:max-w-xl overflow-y-auto">
          {detail ? (
            <>
              <SheetHeader>
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant="outline" className={cn(STATUS_META[detail.status].color)}>
                    {STATUS_META[detail.status].label}
                  </Badge>
                  {detail.category && (
                    <Badge variant="secondary">{detail.category.label}</Badge>
                  )}
                </div>
                <SheetTitle className="text-left">
                  {detail.client?.nombre} · {detail.property?.nombre || 'Sin propiedad'}
                </SheetTitle>
                <SheetDescription className="text-left">
                  Reportada{' '}
                  {format(new Date(detail.created_at), "d MMM yyyy 'a las' HH:mm", { locale: es })}
                  {detail.cleaner?.name && ` por ${detail.cleaner.name}`}
                </SheetDescription>
              </SheetHeader>

              <div className="space-y-4 py-4">
                {detail.location && (
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground mb-1">UBICACIÓN</p>
                    <p className="text-sm">{detail.location}</p>
                  </div>
                )}

                <div>
                  <p className="text-xs font-semibold text-muted-foreground mb-1">DESCRIPCIÓN</p>
                  <p className="text-sm whitespace-pre-wrap">{detail.description}</p>
                </div>

                {detail.media && detail.media.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground mb-2">ADJUNTOS</p>
                    <div className="grid grid-cols-3 gap-2">
                      {detail.media.map((m) => (
                        <a
                          key={m.id}
                          href={m.url}
                          target="_blank"
                          rel="noreferrer"
                          className="aspect-square rounded-md overflow-hidden border bg-muted relative group"
                        >
                          {m.kind === 'video' ? (
                            <video src={m.url} className="w-full h-full object-cover" />
                          ) : (
                            <img src={m.url} className="w-full h-full object-cover" alt="" />
                          )}
                          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
                            <ExternalLink className="h-4 w-4 text-white opacity-0 group-hover:opacity-100" />
                          </div>
                        </a>
                      ))}
                    </div>
                  </div>
                )}

                <div className="border-t pt-4 space-y-3">
                  <p className="text-xs font-semibold text-muted-foreground mb-2 flex items-center gap-1">
                    <MessageSquare className="h-3.5 w-3.5" />
                    COMENTARIOS CON EL CLIENTE
                  </p>
                  {detail.comments && detail.comments.length > 0 ? (
                    <div className="space-y-2">
                      {detail.comments.map((comment) => (
                        <div
                          key={comment.id}
                          className={cn(
                            'rounded-md border p-3 text-sm',
                            comment.author_kind === 'client'
                              ? 'border-amber-200 bg-amber-50'
                              : 'border-blue-200 bg-blue-50'
                          )}
                        >
                          <div className="mb-1 flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
                            <span className="font-semibold">
                              {comment.author_kind === 'client' ? 'Cliente' : 'Limpatex'}
                              {comment.author_name ? ` · ${comment.author_name}` : ''}
                            </span>
                            <span>{format(new Date(comment.created_at), 'd MMM HH:mm', { locale: es })}</span>
                          </div>
                          <p className="whitespace-pre-wrap">{comment.body}</p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="rounded-md border border-dashed p-3 text-sm text-muted-foreground">
                      Todavía no hay comentarios.
                    </p>
                  )}
                  <div className="space-y-2">
                    <Textarea
                      value={commentText}
                      onChange={(e) => setCommentText(e.target.value)}
                      placeholder="Escribe un comentario visible para el cliente..."
                      className="min-h-[80px] text-sm"
                    />
                    <Button
                      onClick={handleAddComment}
                      disabled={!commentText.trim() || addComment.isPending}
                      variant="secondary"
                    >
                      {addComment.isPending ? (
                        <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                      ) : (
                        <MessageSquare className="h-4 w-4 mr-1" />
                      )}
                      Añadir comentario
                    </Button>
                  </div>
                </div>

                {/* Acciones por estado */}
                <div className="border-t pt-4 space-y-3">
                  <div className="flex flex-wrap gap-2">
                    {detail.status === 'pending_limpatex' && (
                      <>
                        <Button
                          onClick={() => handleAction('open')}
                          disabled={updateStatus.isPending}
                          className="flex-1 min-w-[140px]"
                        >
                          <Check className="h-4 w-4 mr-1" />
                          Aprobar y publicar
                        </Button>
                        <Button
                          onClick={() => handleAction('discarded_limpatex')}
                          disabled={updateStatus.isPending}
                          variant="outline"
                          className="flex-1 min-w-[140px]"
                        >
                          <X className="h-4 w-4 mr-1" />
                          Descartar
                        </Button>
                      </>
                    )}

                    {detail.status === 'open' && (
                      <>
                        <Button
                          onClick={() => handleAction('in_progress')}
                          disabled={updateStatus.isPending}
                          variant="secondary"
                        >
                          <Clock className="h-4 w-4 mr-1" />
                          Marcar en curso
                        </Button>
                        <Button
                          onClick={() => handleAction('resolved')}
                          disabled={updateStatus.isPending}
                        >
                          <CheckCircle2 className="h-4 w-4 mr-1" />
                          Resolver
                        </Button>
                      </>
                    )}

                    {detail.status === 'in_progress' && (
                      <Button
                        onClick={() => handleAction('resolved')}
                        disabled={updateStatus.isPending}
                      >
                        <CheckCircle2 className="h-4 w-4 mr-1" />
                        Resolver
                      </Button>
                    )}

                    {(detail.status === 'resolved' ||
                      detail.status === 'discarded_limpatex' ||
                      detail.status === 'discarded') && (
                      <Button
                        onClick={() => handleAction('open')}
                        disabled={updateStatus.isPending}
                        variant="outline"
                      >
                        Reabrir
                      </Button>
                    )}
                  </div>

                  {(detail.discard_limpatex_reason ||
                    detail.resolution_note ||
                    detail.client_discard_reason) && (
                    <div className="text-xs text-muted-foreground space-y-1 pt-2 border-t">
                      {detail.discard_limpatex_reason && (
                        <p><strong>Motivo descarte:</strong> {detail.discard_limpatex_reason}</p>
                      )}
                      {detail.resolution_note && (
                        <p><strong>Resolución:</strong> {detail.resolution_note}</p>
                      )}
                      {detail.client_discard_reason && (
                        <p><strong>Descartada por cliente:</strong> {detail.client_discard_reason}</p>
                      )}
                    </div>
                  )}
                </div>

                {/* Historial */}
                {detail.events && detail.events.length > 0 && (
                  <div className="border-t pt-4">
                    <p className="text-xs font-semibold text-muted-foreground mb-2">HISTORIAL</p>
                    <ol className="space-y-2">
                      {detail.events.map((ev) => (
                        <li key={ev.id} className="text-xs">
                          <span className="font-medium">
                            {ev.event_type === 'created' && 'Creada'}
                            {ev.event_type === 'approved' && 'Aprobada'}
                            {ev.event_type === 'discarded_limpatex' && 'Descartada (Limpatex)'}
                            {ev.event_type === 'client_in_progress' && 'Cliente marcó en proceso'}
                            {ev.event_type === 'client_resolved' && 'Cliente marcó resuelta'}
                            {ev.event_type === 'client_discarded' && 'Cliente descartó'}
                            {ev.event_type === 'client_comment' && 'Comentario del cliente'}
                            {ev.event_type === 'limpatex_comment' && 'Comentario de Limpatex'}
                            {ev.event_type === 'status_change' && `Cambio de estado → ${ev.to_status ? STATUS_META[ev.to_status as IncidentStatus]?.label : ''}`}
                          </span>
                          <span className="text-muted-foreground">
                            {' '}·{' '}
                            {format(new Date(ev.created_at), 'd MMM HH:mm', { locale: es })}
                            {ev.actor_name && ` · ${ev.actor_name}`}
                          </span>
                          {ev.note && <p className="text-muted-foreground italic mt-0.5">"{ev.note}"</p>}
                        </li>
                      ))}
                    </ol>
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          )}
        </SheetContent>
      </Sheet>
      <CreateManualIncidentDialog open={manualDialogOpen} onOpenChange={setManualDialogOpen} />
    </div>
  );
};
