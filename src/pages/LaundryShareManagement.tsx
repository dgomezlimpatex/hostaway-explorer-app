import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import {
  AlertTriangle,
  ArrowLeft,
  Calendar,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock3,
  Copy,
  ExternalLink,
  Link2,
  Loader2,
  MoreHorizontal,
  Pencil,
  Plus,
  RefreshCw,
  Route,
  Settings2,
  Trash2,
  Truck,
} from 'lucide-react';
import { useSede } from '@/contexts/SedeContext';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { useLaundryDeliverySchedule } from '@/hooks/useLaundrySchedule';
import { useLaundryShareLinks, LaundryShareLink } from '@/hooks/useLaundryShareLinks';
import { useLaundryTracking } from '@/hooks/useLaundryTracking';
import { supabase } from '@/integrations/supabase/client';
import {
  formatDateRange,
  getShareLinkUrl,
  isShareLinkExpired,
  copyShareLinkToClipboard,
  detectTaskChanges,
  fetchLaundryTasksForDateRange,
} from '@/services/laundryShareService';
import { useQuery } from '@tanstack/react-query';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
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
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { LaundryShareEditModal } from '@/components/laundry-share/LaundryShareEditModal';
import { LaundryScheduledLinkModal } from '@/components/laundry-share/LaundryScheduledLinkModal';
import { LaundryScheduleConfigModal } from '@/components/laundry-share/LaundryScheduleConfigModal';

const ROUTE_OWNER_EMAIL = 'dgomezlimpatex@gmail.com';

const formatDeliveryDateLabel = (value: string, short = false) => {
  try {
    return format(
      parseISO(`${value}T12:00:00`),
      short ? 'EEE d MMM' : "EEEE d 'de' MMMM yyyy",
      { locale: es },
    );
  } catch {
    return value;
  }
};

const getDeliveryDate = (link: LaundryShareLink) =>
  link.deliveryDate || link.filters?.deliveryDate || link.dateEnd;

const formatTime = (value: string | null) => {
  if (!value) return 'Pendiente';
  return new Date(value).toLocaleTimeString('es-ES', {
    hour: '2-digit',
    minute: '2-digit',
  });
};

const ManagedDeliveryCard = ({
  link,
  isToday,
  canManage,
  onEdit,
  onCopy,
  onOpen,
  onDelete,
}: {
  link: LaundryShareLink;
  isToday: boolean;
  canManage: boolean;
  onEdit: () => void;
  onCopy: () => void;
  onOpen: () => void;
  onDelete: () => void;
}) => {
  const { stats } = useLaundryTracking(link.id);
  const total = link.snapshotTaskIds?.length || 0;
  const completed = stats.prepared + stats.delivered;
  const progress = total > 0 ? Math.min(100, Math.round((completed / total) * 100)) : 0;
  const deliveryDate = getDeliveryDate(link);
  const syncError = link.syncStatus === 'error';

  return (
    <article className={cn(
      'rounded-2xl border bg-card p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md',
      isToday ? 'border-primary/40 ring-1 ring-primary/10' : 'border-border/80',
    )}>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <div className={cn(
            'flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-xl border',
            isToday ? 'border-primary/20 bg-primary/10 text-primary' : 'border-border bg-muted/50 text-foreground',
          )}>
            <span className="text-[10px] font-bold uppercase leading-none tracking-wide">
              {formatDeliveryDateLabel(deliveryDate, true).split(' ')[0]}
            </span>
            <span className="mt-1 text-lg font-bold leading-none">
              {formatDeliveryDateLabel(deliveryDate, true).split(' ')[1]}
            </span>
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="truncate text-sm font-bold text-foreground sm:text-base">
                {isToday ? 'Reparto de hoy' : formatDeliveryDateLabel(deliveryDate)}
              </h3>
              {isToday && (
                <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-primary">
                  Hoy
                </span>
              )}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {total} {total === 1 ? 'bolsa' : 'bolsas'} · {completed} preparadas · {stats.delivered} entregadas
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:justify-end">
          <Button
            variant="outline"
            size="sm"
            onClick={onOpen}
            className="h-9 flex-1 gap-1.5 rounded-lg px-3 text-xs sm:flex-none"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            Abrir
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={onCopy}
            className="h-9 flex-1 gap-1.5 rounded-lg px-3 text-xs sm:flex-none"
          >
            <Copy className="h-3.5 w-3.5" />
            Copiar
          </Button>
          {canManage && (
            <TooltipProvider delayDuration={150}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={onEdit}
                    className="h-9 w-9 shrink-0 rounded-lg text-muted-foreground hover:text-foreground"
                    aria-label="Gestionar excepciones"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Gestionar excepciones</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
          {canManage && (
            <TooltipProvider delayDuration={150}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={onDelete}
                    className="h-9 w-9 shrink-0 rounded-lg text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                    aria-label="Desactivar enlace"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Desactivar enlace</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>
      </div>

      <div className="mt-4 flex items-center gap-3">
        <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
          <div
            className={cn(
              'h-full rounded-full transition-[width] duration-300',
              progress === 100 ? 'bg-emerald-500' : 'bg-primary',
            )}
            style={{ width: `${progress}%` }}
          />
        </div>
        <span className="min-w-10 text-right text-xs font-bold tabular-nums text-foreground">{progress}%</span>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
        <span className="inline-flex items-center gap-1">
          <Clock3 className="h-3 w-3" />
          {link.lastSyncedAt ? `Actualizado ${formatTime(link.lastSyncedAt)}` : 'Pendiente de sincronizar'}
        </span>
        <span className={cn(
          'inline-flex items-center gap-1 font-semibold',
          syncError ? 'text-destructive' : 'text-emerald-600 dark:text-emerald-400',
        )}>
          <span className={cn('h-1.5 w-1.5 rounded-full', syncError ? 'bg-destructive' : 'bg-emerald-500')} />
          {syncError ? 'Revisar sincronización' : 'Enlace actualizado'}
        </span>
      </div>
    </article>
  );
};

interface ChangesInfo {
  newTasks: string[];
  removedTasks: string[];
}

const useTaskChanges = (link: LaundryShareLink) => {
  const sedeIds = link.filters?.sedeIds || (link.filters?.sedeId ? [link.filters.sedeId] : undefined);
  return useQuery<ChangesInfo>({
    queryKey: ['share-link-changes', link.dateStart, link.dateEnd, link.originalTaskIds, link.snapshotTaskIds, sedeIds],
    queryFn: () => detectTaskChanges(link.originalTaskIds, link.snapshotTaskIds, link.dateStart, link.dateEnd, sedeIds),
    staleTime: 30000,
    refetchInterval: 60000,
    enabled: !link.autoManaged,
  });
};

type HistoricLinkRowProps = {
  link: LaundryShareLink;
  canManage: boolean;
  onEdit: () => void;
  onCopy: () => void;
  onOpen: () => void;
  onDelete: () => void;
  onApplyChanges: (currentTaskIds: string[]) => void;
  onAutoMergeNewTasks: (
    currentTaskIds: string[],
    existingSnapshotIds: string[],
    originalTaskIds: string[],
  ) => Promise<void>;
};

const HistoricLinkRow = ({
  link,
  canManage,
  onEdit,
  onCopy,
  onOpen,
  onDelete,
  onApplyChanges,
  onAutoMergeNewTasks,
}: HistoricLinkRowProps) => (
  <HistoricLinkRowContent
    link={link}
    canManage={canManage}
    onEdit={onEdit}
    onCopy={onCopy}
    onOpen={onOpen}
    onDelete={onDelete}
    onApplyChanges={onApplyChanges}
    onAutoMergeNewTasks={onAutoMergeNewTasks}
  />
);

type HistoricLinkRowContentProps = {
  link: LaundryShareLink;
  canManage: boolean;
  onEdit: () => void;
  onCopy: () => void;
  onOpen: () => void;
  onDelete: () => void;
  onApplyChanges: (currentTaskIds: string[]) => void;
  onAutoMergeNewTasks: (
    currentTaskIds: string[],
    existingSnapshotIds: string[],
    originalTaskIds: string[],
  ) => Promise<void>;
};

const HistoricLinkRowContent = ({
  link,
  canManage,
  onEdit,
  onCopy,
  onOpen,
  onDelete,
  onApplyChanges,
  onAutoMergeNewTasks,
}: HistoricLinkRowContentProps) => {
  const { data: changes } = useTaskChanges(link);
  const [applying, setApplying] = useState(false);
  const autoMergedRef = useRef('');
  const hasRemovedTasks = !!changes?.removedTasks.length;
  const hasNewTasks = !!changes?.newTasks.length;

  useEffect(() => {
    if (!hasNewTasks || !changes) return;
    const signature = `${link.id}:${changes.newTasks.slice().sort().join(',')}`;
    if (autoMergedRef.current === signature) return;
    autoMergedRef.current = signature;

    const mergeNewTasks = async () => {
      const sedeIds = link.filters?.sedeIds || (link.filters?.sedeId ? [link.filters.sedeId] : undefined);
      const currentTaskIds = await fetchLaundryTasksForDateRange(link.dateStart, link.dateEnd, sedeIds);
      await onAutoMergeNewTasks(currentTaskIds, link.snapshotTaskIds, link.originalTaskIds);
    };

    void mergeNewTasks();
  }, [changes, hasNewTasks, link.dateEnd, link.dateStart, link.filters, link.id, link.originalTaskIds, link.snapshotTaskIds, onAutoMergeNewTasks]);

  const applyRemovedTasks = async () => {
    if (!changes) return;
    setApplying(true);
    try {
      const sedeIds = link.filters?.sedeIds || (link.filters?.sedeId ? [link.filters.sedeId] : undefined);
      const currentTaskIds = await fetchLaundryTasksForDateRange(link.dateStart, link.dateEnd, sedeIds);
      onApplyChanges(currentTaskIds);
    } finally {
      setApplying(false);
    }
  };

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border/70 bg-card px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 items-center gap-3">
        <Link2 className="h-4 w-4 shrink-0 text-muted-foreground" />
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <p className="truncate text-sm font-semibold text-foreground">{formatDateRange(link.dateStart, link.dateEnd)}</p>
            {canManage && hasRemovedTasks && (
              <Button variant="outline" size="sm" onClick={() => void applyRemovedTasks()} disabled={applying} className="h-7 gap-1 px-2 text-[10px] font-bold text-amber-700 hover:text-amber-800">
                <AlertTriangle className="h-3 w-3" />
                {applying ? '...' : `${changes?.removedTasks.length} retiradas`}
              </Button>
            )}
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Enlace anterior · {link.snapshotTaskIds?.length || 0} bolsas{hasNewTasks ? ' · Nuevas tareas añadidas automáticamente' : ''}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2 sm:shrink-0">
        <Button variant="outline" size="sm" onClick={onOpen} className="h-9 flex-1 gap-1.5 text-xs sm:flex-none">
          <ExternalLink className="h-3.5 w-3.5" /> Abrir
        </Button>
        <Button variant="outline" size="sm" onClick={onCopy} className="h-9 flex-1 gap-1.5 text-xs sm:flex-none">
          <Copy className="h-3.5 w-3.5" /> Copiar
        </Button>
        {canManage && (
          <Button variant="ghost" size="icon" onClick={onEdit} className="h-9 w-9 text-muted-foreground" aria-label="Editar enlace">
            <Pencil className="h-3.5 w-3.5" />
          </Button>
        )}
        {canManage && (
          <Button variant="ghost" size="icon" onClick={onDelete} className="h-9 w-9 text-muted-foreground hover:text-destructive" aria-label="Desactivar enlace">
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>
    </div>
  );
};

const PrimaryDeliveryHero = ({
  link,
  todayStr,
  managedCount,
  onOpen,
  onCopy,
}: {
  link: LaundryShareLink;
  todayStr: string;
  managedCount: number;
  onOpen: () => void;
  onCopy: () => void;
}) => {
  const { stats } = useLaundryTracking(link.id);
  const total = link.snapshotTaskIds?.length || 0;
  const completed = stats.prepared + stats.delivered;
  const progress = total > 0 ? Math.min(100, Math.round((completed / total) * 100)) : 0;
  const deliveryDate = getDeliveryDate(link);
  const isToday = deliveryDate === todayStr;

  return (
    <>
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-background/60">Operativa de lavandería</p>
          <h2 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">
            {isToday ? 'Reparto de hoy' : 'Próximo reparto'}
          </h2>
          <p className="mt-1 text-sm capitalize text-background/70">{formatDeliveryDateLabel(deliveryDate)}</p>
        </div>
        <div className="hidden rounded-xl border border-background/15 bg-background/10 px-3 py-2 text-right sm:block">
          <p className="text-[10px] uppercase tracking-wide text-background/60">Enlaces activos</p>
          <p className="mt-1 text-xl font-bold tabular-nums">{managedCount}</p>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-3 gap-2 sm:max-w-md">
        <div className="rounded-xl border border-background/15 bg-background/10 px-3 py-2.5">
          <p className="text-[10px] uppercase tracking-wide text-background/60">Bolsas</p>
          <p className="mt-1 text-lg font-bold tabular-nums">{total}</p>
        </div>
        <div className="rounded-xl border border-background/15 bg-background/10 px-3 py-2.5">
          <p className="text-[10px] uppercase tracking-wide text-background/60">Preparadas</p>
          <p className="mt-1 text-lg font-bold tabular-nums">{stats.prepared}</p>
        </div>
        <div className="rounded-xl border border-background/15 bg-background/10 px-3 py-2.5">
          <p className="text-[10px] uppercase tracking-wide text-background/60">Entregadas</p>
          <p className="mt-1 text-lg font-bold tabular-nums">{stats.delivered}</p>
        </div>
      </div>

      <div className="mt-5">
        <div className="flex items-center justify-between text-xs text-background/70">
          <span>Progreso de la ruta</span>
          <span className="font-bold tabular-nums text-background">{progress}%</span>
        </div>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-background/15">
          <div className="h-full rounded-full bg-primary-foreground transition-[width] duration-300" style={{ width: `${progress}%` }} />
        </div>
      </div>

      <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:items-center">
        <Button onClick={onOpen} className="h-10 gap-2 rounded-lg bg-background px-4 text-sm font-semibold text-foreground hover:bg-background/90">
          <ExternalLink className="h-4 w-4" /> Abrir enlace
        </Button>
        <Button variant="ghost" onClick={onCopy} className="h-10 gap-2 rounded-lg text-background hover:bg-background/10 hover:text-background">
          <Copy className="h-4 w-4" /> Copiar enlace
        </Button>
      </div>
    </>
  );
};

const LaundryShareManagement = () => {
  const { toast } = useToast();
  const navigate = useNavigate();
  const { activeSede } = useSede();
  const { user } = useAuth();
  const { schedules } = useLaundryDeliverySchedule();
  const {
    shareLinks,
    isLoading,
    refetch,
    deactivateShareLink,
    applyTaskChanges,
  } = useLaundryShareLinks();
  const isRouteOwner = user?.email?.trim().toLowerCase() === ROUTE_OWNER_EMAIL;

  const [scheduledModalOpen, setScheduledModalOpen] = useState(false);
  const [configModalOpen, setConfigModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedLink, setSelectedLink] = useState<LaundryShareLink | null>(null);
  const [showHistoric, setShowHistoric] = useState(false);
  const [showExpired, setShowExpired] = useState(false);
  const [search, setSearch] = useState('');
  const [isSyncing, setIsSyncing] = useState(false);

  const todayStr = useMemo(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  }, []);

  const activeLinks = useMemo(
    () => (shareLinks || []).filter(link => !isShareLinkExpired(link.expiresAt)),
    [shareLinks],
  );
  const expiredLinks = useMemo(
    () => (shareLinks || []).filter(link => isShareLinkExpired(link.expiresAt)),
    [shareLinks],
  );
  const managedLinks = useMemo(
    () => activeLinks
      .filter(link => link.autoManaged && link.linkType === 'scheduled' && link.workflowVersion !== 'route_v2')
      .sort((a, b) => getDeliveryDate(a).localeCompare(getDeliveryDate(b))),
    [activeLinks],
  );
  const upcomingManagedLinks = useMemo(
    () => managedLinks.filter(link => getDeliveryDate(link) >= todayStr),
    [managedLinks, todayStr],
  );
  const primaryLink = upcomingManagedLinks[0] || managedLinks[0] || null;
  const followingLinks = upcomingManagedLinks
    .filter(link => link.id !== primaryLink?.id)
    .slice(0, 2);
  const historicLinks = useMemo(() => {
    const legacyLinks = activeLinks.filter(link => !link.autoManaged && link.workflowVersion !== 'route_v2');
    const query = search.trim().toLowerCase();
    if (!query) return legacyLinks;
    return legacyLinks.filter(link =>
      formatDateRange(link.dateStart, link.dateEnd).toLowerCase().includes(query)
      || link.token.toLowerCase().includes(query),
    );
  }, [activeLinks, search]);
  const activeScheduleNames = useMemo(
    () => (schedules || []).filter(schedule => schedule.isActive),
    [schedules],
  );

  const handleApplyChanges = async (linkId: string, currentTaskIds: string[]) => {
    await applyTaskChanges.mutateAsync({ linkId, currentTaskIds });
  };

  const handleAutoMergeNewTasks = useCallback(
    async (
      linkId: string,
      currentTaskIds: string[],
      existingSnapshotIds: string[],
      originalTaskIds: string[],
    ) => {
      await applyTaskChanges.mutateAsync({
        linkId,
        currentTaskIds,
        existingSnapshotIds,
        originalTaskIds,
        mode: 'merge',
        silent: true,
      });
    },
    [applyTaskChanges],
  );

  const handleSyncNow = async () => {
    if (!isRouteOwner || !activeSede?.id) return;
    setIsSyncing(true);
    try {
      const { error } = await supabase.functions.invoke('manage-laundry-classic-links', {
        body: { action: 'reconcile', sedeId: activeSede.id, source: 'manual' },
      });
      if (error) throw error;
      await refetch();
      toast({ title: 'Enlaces actualizados', description: 'Se han revisado los próximos repartos.' });
    } catch (error) {
      console.error('Error syncing protocolized laundry links:', error);
      toast({ title: 'No se pudo actualizar', description: 'Revisa la configuración e inténtalo de nuevo.', variant: 'destructive' });
    } finally {
      setIsSyncing(false);
    }
  };

  const handleCopyLink = async (token: string) => {
    if (!await copyShareLinkToClipboard(token, true)) return;
    toast({ title: 'Enlace copiado', description: 'Ya puedes compartirlo por WhatsApp.' });
  };

  const openLink = (token: string) => window.open(getShareLinkUrl(token, true), '_blank');

  const openEdit = (link: LaundryShareLink) => {
    setSelectedLink(link);
    setEditModalOpen(true);
  };

  const openDelete = (link: LaundryShareLink) => {
    setSelectedLink(link);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (!selectedLink) return;
    await deactivateShareLink.mutateAsync(selectedLink.id);
    setDeleteDialogOpen(false);
    setSelectedLink(null);
  };

  return (
    <div className="min-h-screen bg-muted/30">
      <header className="sticky top-0 z-30 border-b border-border/70 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <Button variant="outline" size="icon" onClick={() => navigate('/')} className="h-9 w-9 shrink-0 rounded-lg" aria-label="Volver al inicio">
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div className="flex min-w-0 items-center gap-2.5">
              <div className="hidden h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary sm:flex">
                <Truck className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <h1 className="truncate text-base font-bold tracking-tight text-foreground sm:text-lg">Enlaces de lavandería</h1>
                <p className="truncate text-[11px] text-muted-foreground">{activeSede?.nombre || 'Todas las sedes'} · Operativa diaria</p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            {isRouteOwner && (
              <Button variant="outline" size="sm" onClick={() => navigate('/lavanderia/orden')} className="h-9 gap-1.5 rounded-lg px-2.5 text-xs sm:px-3">
                <Route className="h-3.5 w-3.5 text-primary" />
                <span className="hidden sm:inline">Orden de rutas</span>
                <span className="sm:hidden">Rutas</span>
              </Button>
            )}
            {isRouteOwner && (
              <Button variant="outline" size="icon" onClick={handleSyncNow} disabled={isSyncing} className="h-9 w-9 rounded-lg" aria-label="Sincronizar enlaces">
                <RefreshCw className={cn('h-3.5 w-3.5', isSyncing && 'animate-spin')} />
              </Button>
            )}
            {isRouteOwner && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="icon" className="h-9 w-9 rounded-lg" aria-label="Más opciones">
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuItem onClick={() => setConfigModalOpen(true)}>
                    <Settings2 className="mr-2 h-4 w-4" /> Configurar días de reparto
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setShowExpired(value => !value)} disabled={expiredLinks.length === 0}>
                    {showExpired ? <ChevronUp className="mr-2 h-4 w-4" /> : <ChevronDown className="mr-2 h-4 w-4" />}
                    {showExpired ? 'Ocultar' : 'Ver'} expirados ({expiredLinks.length})
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => void Promise.all(expiredLinks.map(link => deactivateShareLink.mutateAsync(link.id)))} disabled={expiredLinks.length === 0} className="text-destructive focus:text-destructive">
                    <Trash2 className="mr-2 h-4 w-4" /> Limpiar expirados
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl space-y-5 px-4 py-5 sm:px-6 sm:py-7">
        <section className="grid gap-5 lg:grid-cols-[minmax(0,1.55fr)_minmax(280px,0.85fr)]">
          <div className="rounded-2xl bg-foreground p-5 text-background shadow-sm sm:p-6">
            {primaryLink ? (
              <PrimaryDeliveryHero
                link={primaryLink}
                todayStr={todayStr}
                managedCount={managedLinks.length}
                onOpen={() => openLink(primaryLink.token)}
                onCopy={() => void handleCopyLink(primaryLink.token)}
              />
            ) : (
              <>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-background/60">Operativa de lavandería</p>
                  <h2 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">Sin reparto preparado</h2>
                </div>
                <div className="mt-6 rounded-xl border border-dashed border-background/25 bg-background/5 p-4 text-sm text-background/70">
                  El sistema creará los próximos enlaces automáticamente. También puedes generar uno de un día activo.
                  <div className="mt-4">
                    <Button onClick={() => setScheduledModalOpen(true)} className="h-10 rounded-lg bg-background text-foreground hover:bg-background/90">
                      <Plus className="mr-2 h-4 w-4" /> Generar enlace
                    </Button>
                  </div>
                </div>
              </>
            )}
          </div>

          <aside className="rounded-2xl border border-border bg-card p-5 shadow-sm sm:p-6">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-primary">Control rápido</p>
                <h2 className="mt-2 text-lg font-bold tracking-tight">Rutas preparadas</h2>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">Enlaces únicos, actualizados automáticamente y listos para compartir.</p>
              </div>
              <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-500" />
            </div>
            <div className="mt-5 grid grid-cols-2 gap-2">
              <div className="rounded-xl bg-muted/60 px-3 py-2.5">
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Automáticos</p>
                <p className="mt-1 text-lg font-bold tabular-nums text-foreground">{managedLinks.length}</p>
              </div>
              <div className="rounded-xl bg-muted/60 px-3 py-2.5">
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Próximos</p>
                <p className="mt-1 text-lg font-bold tabular-nums text-foreground">{upcomingManagedLinks.length}</p>
              </div>
            </div>
            <div className="mt-5 border-t border-border pt-4">
              <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">Días activos</p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {activeScheduleNames.length > 0 ? activeScheduleNames.map(schedule => (
                  <span key={schedule.id} className="rounded-full border border-primary/20 bg-primary/5 px-2.5 py-1 text-xs font-semibold text-primary">
                    {schedule.name}
                  </span>
                )) : <span className="text-xs text-muted-foreground">No hay días configurados</span>}
              </div>
            </div>
            <Button variant="outline" onClick={() => setScheduledModalOpen(true)} className="mt-5 h-10 w-full gap-2 rounded-lg text-sm">
              <Plus className="h-4 w-4" /> Generar enlace puntual
            </Button>
          </aside>
        </section>

        <section className="space-y-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-primary">Ventana operativa</p>
              <h2 className="mt-1 text-xl font-bold tracking-tight text-foreground">Próximos repartos</h2>
              <p className="mt-1 text-sm text-muted-foreground">Los tres siguientes enlaces se mantienen actualizados sin cambiar su enlace.</p>
            </div>
            <Button variant="ghost" size="sm" onClick={() => void refetch()} className="h-9 w-fit gap-1.5 px-2 text-xs text-muted-foreground hover:text-foreground">
              <RefreshCw className="h-3.5 w-3.5" /> Actualizar vista
            </Button>
          </div>

          {isLoading ? (
            <div className="flex min-h-28 items-center justify-center rounded-2xl border border-dashed border-border bg-card">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : followingLinks.length > 0 ? (
            <div className="grid gap-3 lg:grid-cols-2">
              {followingLinks.map(link => (
                <ManagedDeliveryCard
                  key={link.id}
                  link={link}
                  isToday={getDeliveryDate(link) === todayStr}
                  canManage={isRouteOwner}
                  onEdit={() => openEdit(link)}
                  onCopy={() => void handleCopyLink(link.token)}
                  onOpen={() => openLink(link.token)}
                  onDelete={() => openDelete(link)}
                />
              ))}
            </div>
          ) : primaryLink ? (
            <div className="rounded-2xl border border-dashed border-border bg-card px-4 py-5 text-sm text-muted-foreground">
              El siguiente enlace aparecerá aquí cuando el sistema prepare una nueva ruta.
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-border bg-card px-4 py-6 text-sm text-muted-foreground">
              Aún no hay enlaces automáticos. Pulsa «Generar enlace puntual» para preparar un día activo.
            </div>
          )}
        </section>

        <section className="rounded-2xl border border-border bg-card shadow-sm">
          <Collapsible open={showHistoric} onOpenChange={setShowHistoric}>
            <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
              <CollapsibleTrigger asChild>
                <button className="flex min-w-0 items-center gap-3 text-left">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                    <Link2 className="h-4 w-4" />
                  </div>
                  <span className="min-w-0">
                    <span className="block text-sm font-bold text-foreground">Enlaces anteriores</span>
                    <span className="mt-0.5 block text-xs text-muted-foreground">Se mantienen disponibles, pero no forman parte de la operativa automática.</span>
                  </span>
                  {showHistoric ? <ChevronUp className="h-4 w-4 shrink-0 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />}
                </button>
              </CollapsibleTrigger>
              <span className="text-xs font-semibold text-muted-foreground">{historicLinks.length} enlaces</span>
            </div>
            <CollapsibleContent>
              <div className="space-y-3 border-t border-border p-4 sm:p-5">
                {historicLinks.length > 0 && (
                  <div className="relative">
                    <Input value={search} onChange={event => setSearch(event.target.value)} placeholder="Buscar por fecha o token..." className="h-10 text-sm" />
                  </div>
                )}
                {historicLinks.length > 0 ? historicLinks.map(link => (
                  <HistoricLinkRow
                    key={link.id}
                    link={link}
                    canManage={isRouteOwner}
                    onEdit={() => openEdit(link)}
                    onCopy={() => void handleCopyLink(link.token)}
                    onOpen={() => openLink(link.token)}
                    onDelete={() => openDelete(link)}
                    onApplyChanges={(ids) => void handleApplyChanges(link.id, ids)}
                    onAutoMergeNewTasks={(ids, existing, original) => handleAutoMergeNewTasks(link.id, ids, existing, original)}
                  />
                )) : (
                  <p className="py-3 text-sm text-muted-foreground">No hay enlaces anteriores activos.</p>
                )}
              </div>
            </CollapsibleContent>
          </Collapsible>
        </section>

        {isRouteOwner && expiredLinks.length > 0 && (
          <section className="rounded-2xl border border-border bg-card shadow-sm">
            <Collapsible open={showExpired} onOpenChange={setShowExpired}>
              <CollapsibleTrigger asChild>
                <button className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left sm:px-5">
                  <span className="flex items-center gap-2 text-sm font-semibold text-muted-foreground"><Trash2 className="h-4 w-4" /> Enlaces expirados ({expiredLinks.length})</span>
                  {showExpired ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                </button>
              </CollapsibleTrigger>
              <CollapsibleContent className="space-y-2 border-t border-border p-4 sm:p-5">
                {expiredLinks.map(link => (
                  <div key={link.id} className="flex items-center justify-between gap-3 rounded-lg bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
                    <span className="truncate">{formatDateRange(link.dateStart, link.dateEnd)}</span>
                    <Button variant="ghost" size="icon" onClick={() => openDelete(link)} className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive" aria-label="Desactivar enlace expirado">
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))}
              </CollapsibleContent>
            </Collapsible>
          </section>
        )}
      </main>

      <LaundryScheduledLinkModal open={scheduledModalOpen} onOpenChange={setScheduledModalOpen} />
      {isRouteOwner && <LaundryScheduleConfigModal open={configModalOpen} onOpenChange={setConfigModalOpen} />}
      <LaundryShareEditModal open={editModalOpen} onOpenChange={setEditModalOpen} shareLink={selectedLink} />

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Desactivar este enlace?</AlertDialogTitle>
            <AlertDialogDescription>El enlace dejará de funcionar y el equipo de ruta no podrá acceder.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => void confirmDelete()} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Desactivar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default LaundryShareManagement;
