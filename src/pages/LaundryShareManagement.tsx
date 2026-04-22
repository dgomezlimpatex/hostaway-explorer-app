import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSede } from '@/contexts/SedeContext';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { 
  Plus, 
  Copy, 
  Trash2, 
  ExternalLink, 
  Calendar,
  Truck,
  Clock,
  RefreshCw,
  Pencil,
  AlertTriangle,
  Share2,
  ArrowLeft,
  LinkIcon,
  Sparkles,
  ChevronDown,
  ChevronUp,
  MoreHorizontal,
  Search,
  Check,
  Loader2,
} from 'lucide-react';
import { useLaundryShareLinks, LaundryShareLink } from '@/hooks/useLaundryShareLinks';
import { useLaundryTracking } from '@/hooks/useLaundryTracking';
import { LaundryShareEditModal } from '@/components/laundry-share/LaundryShareEditModal';
import { LaundryScheduledLinkModal } from '@/components/laundry-share/LaundryScheduledLinkModal';
import { LaundryScheduleConfigModal } from '@/components/laundry-share/LaundryScheduleConfigModal';
import { QuickDayLinksWidget } from '@/components/laundry-share/QuickDayLinksWidget';
import { 
  copyShareLinkToClipboard, 
  getShareLinkUrl, 
  formatDateRange, 
  formatExpirationStatus,
  isShareLinkExpired,
  detectTaskChanges,
  fetchLaundryTasksForDateRange,
} from '@/services/laundryShareService';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useToast } from '@/hooks/use-toast';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
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
import { cn } from '@/lib/utils';

// ============================================================
// Sub-components
// ============================================================

const ShareLinkProperties = ({ 
  dateStart, 
  dateEnd,
  snapshotTaskIds 
}: { 
  dateStart: string; 
  dateEnd: string;
  snapshotTaskIds: string[];
}) => {
  const { data: properties, isLoading } = useQuery({
    queryKey: ['share-link-properties', dateStart, dateEnd, snapshotTaskIds],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tasks')
        .select('id, property, properties(codigo)')
        .gte('date', dateStart)
        .lte('date', dateEnd);

      if (error) throw error;
      const snapshotSet = new Set(snapshotTaskIds);
      const includedTasks = (data || []).filter(t => snapshotSet.has(t.id));
      const uniqueCodes = [...new Set(includedTasks.map(t => 
        (t.properties as any)?.codigo || t.property
      ))].sort((a, b) => a.localeCompare(b, 'es', { numeric: true }));
      return uniqueCodes;
    },
  });

  if (isLoading) return <span className="text-xs text-muted-foreground">…</span>;
  if (!properties || properties.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-1">
      {properties.slice(0, 8).map((code, i) => (
        <Badge key={i} variant="outline" className="text-[10px] font-normal py-0 px-1.5 h-5 bg-background">
          {code}
        </Badge>
      ))}
      {properties.length > 8 && (
        <Badge variant="outline" className="text-[10px] font-normal py-0 px-1.5 h-5 bg-muted">
          +{properties.length - 8}
        </Badge>
      )}
    </div>
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
  });
};

// Health dot (status at a glance)
const HealthDot = ({ link, changes }: { link: LaundryShareLink; changes?: ChangesInfo }) => {
  const { stats } = useLaundryTracking(link.id);
  const total = link.snapshotTaskIds?.length || 0;
  const hasChanges = changes && (changes.newTasks.length > 0 || changes.removedTasks.length > 0);

  let color = 'bg-muted-foreground/40';
  let label = 'Sin actividad';

  if (hasChanges) {
    color = 'bg-amber-500';
    label = 'Cambios pendientes';
  } else if (total > 0 && stats.delivered === total) {
    color = 'bg-emerald-500';
    label = 'Completado';
  } else if (stats.prepared + stats.delivered > 0) {
    color = 'bg-blue-500';
    label = 'En preparación';
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className={cn('inline-block h-2 w-2 rounded-full shrink-0', color)} />
        </TooltipTrigger>
        <TooltipContent side="left">{label}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

// ============================================================
// LinkCard — list-style row, always-visible actions
// ============================================================

const LinkCard = ({ 
  link, 
  highlight,
  onEdit, 
  onCopy, 
  onOpen, 
  onDelete,
  onApplyChanges,
  onAutoMergeNewTasks,
}: { 
  link: LaundryShareLink;
  highlight?: boolean;
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
}) => {
  const { data: changes } = useTaskChanges(link);
  const { stats } = useLaundryTracking(link.id);
  const total = link.snapshotTaskIds?.length || 0;
  const preparedCount = stats.prepared + stats.delivered;
  const deliveredPercent = total > 0 ? Math.round((stats.delivered / total) * 100) : 0;
  const hasNewTasks = !!changes && changes.newTasks.length > 0;
  const hasRemovedTasks = !!changes && changes.removedTasks.length > 0;

  // Auto-merge new tasks into snapshot in background (preserves manual edits)
  const autoMergedRef = useRef<string>('');
  useEffect(() => {
    if (!hasNewTasks || !changes) return;
    // Use a stable signature to avoid loops
    const signature = `${link.id}:${changes.newTasks.sort().join(',')}`;
    if (autoMergedRef.current === signature) return;
    autoMergedRef.current = signature;

    (async () => {
      const sedeIds = link.filters?.sedeIds || (link.filters?.sedeId ? [link.filters.sedeId] : undefined);
      const currentIds = await fetchLaundryTasksForDateRange(link.dateStart, link.dateEnd, sedeIds);
      await onAutoMergeNewTasks(currentIds, link.snapshotTaskIds, link.originalTaskIds);
    })();
  }, [hasNewTasks, changes, link.id, link.dateStart, link.dateEnd, link.filters, link.snapshotTaskIds, link.originalTaskIds, onAutoMergeNewTasks]);

  const [applying, setApplying] = useState(false);
  const handleApplyRemoved = async () => {
    if (!changes) return;
    setApplying(true);
    try {
      const sedeIds = link.filters?.sedeIds || (link.filters?.sedeId ? [link.filters.sedeId] : undefined);
      const currentIds = await fetchLaundryTasksForDateRange(link.dateStart, link.dateEnd, sedeIds);
      onApplyChanges(currentIds);
    } finally {
      setApplying(false);
    }
  };

  return (
    <div 
      className={cn(
        'rounded-lg border bg-card transition-all',
        highlight && 'ring-2 ring-blue-500/50 border-blue-500/30',
      )}
    >
      {/* Body */}
      <div className="p-3 space-y-2.5">
        {/* Line 1: date + status chips + actions */}
        <div className="flex items-center gap-2">
          <HealthDot link={link} changes={changes} />
          <h3 className="font-medium text-sm truncate">
            {formatDateRange(link.dateStart, link.dateEnd)}
          </h3>
          {link.isPermanent ? (
            <Badge className="bg-primary/10 text-primary border-0 text-[10px] py-0 px-1.5 h-5 font-medium">
              <Sparkles className="h-2.5 w-2.5 mr-0.5" />
              Permanente
            </Badge>
          ) : (
            <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
              <Clock className="h-3 w-3" />
              {formatExpirationStatus(link.expiresAt, link.isPermanent)}
            </span>
          )}
          {hasRemovedTasks && (
            <button
              onClick={handleApplyRemoved}
              disabled={applying}
              className="ml-auto inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 text-[11px] font-medium hover:bg-amber-500/20 transition-colors"
              title="Hay tareas que ya no existen. Pulsa para sincronizar."
            >
              {applying ? <Loader2 className="h-3 w-3 animate-spin" /> : <AlertTriangle className="h-3 w-3" />}
              {applying ? 'Sincronizando' : `${changes!.removedTasks.length} eliminada${changes!.removedTasks.length > 1 ? 's' : ''}`}
            </button>
          )}
          <div className={cn('flex items-center gap-0.5', !hasRemovedTasks && 'ml-auto')}>
            <TooltipProvider delayDuration={100}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-7 w-7 min-h-0 min-w-0" onClick={onEdit}>
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Editar tareas incluidas</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-7 w-7 min-h-0 min-w-0" onClick={onOpen}>
                    <ExternalLink className="h-3.5 w-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Abrir</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </div>

        {/* Line 2: properties */}
        <ShareLinkProperties 
          dateStart={link.dateStart} 
          dateEnd={link.dateEnd} 
          snapshotTaskIds={link.snapshotTaskIds}
        />

        {/* Line 3: progress + stats */}
        {total > 0 && (
          <div className="space-y-1.5">
            <Progress 
              value={deliveredPercent} 
              className="h-1 bg-muted"
              indicatorClassName={cn(
                'bg-gradient-to-r from-blue-500 to-emerald-500',
                deliveredPercent === 100 && 'from-emerald-500 to-emerald-500',
              )}
            />
            <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
              <span className="font-medium text-foreground">{total}</span>
              <span className="text-blue-600 dark:text-blue-400">{preparedCount} prep.</span>
              <span className="text-emerald-600 dark:text-emerald-400">{stats.delivered} entreg.</span>
              <span className={cn(
                'ml-auto font-semibold',
                deliveredPercent === 100 ? 'text-emerald-600 dark:text-emerald-400' : 'text-foreground',
              )}>
                {deliveredPercent}%
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Footer: URL + actions */}
      <div className="flex items-center gap-1 px-3 py-2 border-t bg-muted/20">
        <button 
          onClick={onCopy}
          className="flex-1 flex items-center gap-1.5 px-2 py-1 rounded hover:bg-muted/60 transition-colors text-left min-w-0"
        >
          <LinkIcon className="h-3 w-3 text-muted-foreground shrink-0" />
          <span className="text-[11px] font-mono text-muted-foreground truncate">
            {getShareLinkUrl(link.token).replace('https://', '')}
          </span>
        </button>
        <TooltipProvider delayDuration={100}>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" className="h-7 w-7 min-h-0 min-w-0" onClick={onCopy}>
                <Copy className="h-3.5 w-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Copiar enlace</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-7 w-7 min-h-0 min-w-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                onClick={onDelete}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Desactivar</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
    </div>
  );
};

// ============================================================
// Main page
// ============================================================

const LaundryShareManagement = () => {
  const { toast } = useToast();
  const navigate = useNavigate();
  const { activeSede } = useSede();
  const { shareLinks, isLoading, refetch, deactivateShareLink, applyTaskChanges } = useLaundryShareLinks();
  const [scheduledModalOpen, setScheduledModalOpen] = useState(false);
  const [configModalOpen, setConfigModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedLink, setSelectedLink] = useState<LaundryShareLink | null>(null);
  const [showExpired, setShowExpired] = useState(false);
  const [search, setSearch] = useState('');
  const [highlightedId, setHighlightedId] = useState<string | null>(null);

  // Track newly created links to highlight them briefly
  const linkIds = useMemo(() => (shareLinks || []).map(l => l.id).join(','), [shareLinks]);
  useEffect(() => {
    if (!shareLinks || shareLinks.length === 0) return;
    const sorted = [...shareLinks].sort((a, b) => 
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
    const newest = sorted[0];
    if (newest && Date.now() - new Date(newest.createdAt).getTime() < 5000) {
      setHighlightedId(newest.id);
      const t = setTimeout(() => setHighlightedId(null), 5000);
      return () => clearTimeout(t);
    }
  }, [linkIds, shareLinks]);

  const handleCopyLink = async (token: string) => {
    const success = await copyShareLinkToClipboard(token, true);
    if (success) {
      toast({
        title: 'Enlace copiado',
        description: 'Ya puedes compartirlo por WhatsApp',
        action: (
          <button
            onClick={() => window.open(getShareLinkUrl(token, true), '_blank')}
            className="text-xs font-medium underline"
          >
            Abrir
          </button>
        ),
      });
    }
  };

  const handleEditClick = (link: LaundryShareLink) => {
    setSelectedLink(link);
    setEditModalOpen(true);
  };

  const handleDeleteClick = (link: LaundryShareLink) => {
    setSelectedLink(link);
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (selectedLink) {
      await deactivateShareLink.mutateAsync(selectedLink.id);
      setDeleteDialogOpen(false);
      setSelectedLink(null);
    }
  };

  const handleApplyChanges = async (linkId: string, currentTaskIds: string[]) => {
    await applyTaskChanges.mutateAsync({ linkId, currentTaskIds });
  };

  // Auto-merge: silently add new tasks to snapshot without removing existing ones.
  // Receives `originalTaskIds` so the merge only re-adds tasks that didn't exist
  // in the previous baseline — preserving any manual exclusion the admin made.
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
    [applyTaskChanges]
  );

  const handleCleanExpired = async () => {
    const ids = expiredLinks.map(l => l.id);
    await Promise.all(ids.map(id => deactivateShareLink.mutateAsync(id)));
    toast({
      title: 'Enlaces eliminados',
      description: `${ids.length} enlaces expirados eliminados`,
    });
  };

  const openExternalLink = (token: string) => {
    window.open(getShareLinkUrl(token, true), '_blank');
  };

  const allActive = shareLinks?.filter(l => !isShareLinkExpired(l.expiresAt)) || [];
  const expiredLinks = shareLinks?.filter(l => isShareLinkExpired(l.expiresAt)) || [];

  // Search filter on active links
  const activeLinks = useMemo(() => {
    if (!search.trim()) return allActive;
    const q = search.toLowerCase();
    return allActive.filter(l => 
      formatDateRange(l.dateStart, l.dateEnd).toLowerCase().includes(q) ||
      l.token.toLowerCase().includes(q)
    );
  }, [allActive, search]);

  const showSearch = allActive.length > 5;

  return (
    <div className="min-h-screen bg-background">
      {/* Sticky header */}
      <div className="sticky top-0 z-30 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <div className="container mx-auto px-4 max-w-3xl">
          <div className="flex items-center gap-3 py-3">
            <Button 
              variant="ghost" 
              size="icon"
              onClick={() => navigate('/')}
              className="shrink-0 h-9 w-9 min-h-0 min-w-0"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div className="flex-1 min-w-0">
              <h1 className="text-xl font-semibold truncate leading-tight">Enlaces de Lavandería</h1>
              <p className="text-xs text-muted-foreground truncate">
                {activeSede?.nombre || 'Todas las sedes'}
              </p>
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-9 w-9 min-h-0 min-w-0 shrink-0">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52">
                <DropdownMenuItem onClick={() => setConfigModalOpen(true)}>
                  <Calendar className="h-4 w-4 mr-2" />
                  Configurar horarios
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setShowExpired(v => !v)} disabled={expiredLinks.length === 0}>
                  {showExpired ? <ChevronUp className="h-4 w-4 mr-2" /> : <ChevronDown className="h-4 w-4 mr-2" />}
                  {showExpired ? 'Ocultar' : 'Ver'} expirados ({expiredLinks.length})
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem 
                  onClick={handleCleanExpired} 
                  disabled={expiredLinks.length === 0}
                  className="text-destructive focus:text-destructive"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Limpiar expirados
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          <div className="h-px bg-border/60" />
        </div>
      </div>

      <div className="container mx-auto py-5 px-4 max-w-3xl space-y-5">
        
        {/* Quick day cards */}
        <QuickDayLinksWidget />

        {/* Generate scheduled link — secondary action */}
        <Button 
          onClick={() => setScheduledModalOpen(true)} 
          variant="outline"
          size="sm"
          className="w-full"
        >
          <Plus className="h-3.5 w-3.5 mr-1.5" />
          Generar enlace de reparto personalizado
        </Button>

        {/* Active Links */}
        <div className="space-y-2.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Share2 className="h-3.5 w-3.5 text-blue-500" />
              <h2 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Enlaces activos
              </h2>
              {allActive.length > 0 && (
                <span className="text-[11px] text-muted-foreground">· {allActive.length}</span>
              )}
            </div>
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-7 w-7 min-h-0 min-w-0"
              onClick={() => refetch()}
            >
              <RefreshCw className="h-3.5 w-3.5" />
            </Button>
          </div>

          {showSearch && (
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Buscar por fecha o token..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-8 pl-8 text-xs"
              />
            </div>
          )}

          {isLoading ? (
            <div className="flex items-center justify-center py-10">
              <RefreshCw className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : activeLinks.length > 0 ? (
            <div className="space-y-2">
              {activeLinks.map((link) => (
                <LinkCard
                  key={link.id}
                  link={link}
                  highlight={highlightedId === link.id}
                  onEdit={() => handleEditClick(link)}
                  onCopy={() => handleCopyLink(link.token)}
                  onOpen={() => openExternalLink(link.token)}
                  onDelete={() => handleDeleteClick(link)}
                  onApplyChanges={(ids) => handleApplyChanges(link.id, ids)}
                  onAutoMergeNewTasks={(ids, existing, original) => handleAutoMergeNewTasks(link.id, ids, existing, original)}
                />
              ))}
            </div>
          ) : search ? (
            <div className="rounded-lg border border-dashed py-8 text-center">
              <p className="text-sm text-muted-foreground">Sin resultados para "{search}"</p>
            </div>
          ) : (
            <div className="rounded-lg border border-dashed py-8 px-4 text-center">
              <div className="inline-flex p-2.5 rounded-full bg-muted/60 mb-2">
                <Truck className="h-5 w-5 text-muted-foreground/60" />
              </div>
              <p className="text-sm font-medium mb-0.5">Sin enlaces activos</p>
              <p className="text-xs text-muted-foreground">
                Usa los accesos rápidos de Hoy o Mañana para crear tu primer enlace
              </p>
            </div>
          )}
        </div>

        {/* Expired Links (collapsible) */}
        {expiredLinks.length > 0 && (
          <Collapsible open={showExpired} onOpenChange={setShowExpired}>
            <CollapsibleTrigger asChild>
              <button className="flex items-center gap-1.5 w-full py-1.5 text-[11px] font-medium uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors">
                {showExpired ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                <span>Expirados · {expiredLinks.length}</span>
              </button>
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-1 pt-1">
              {expiredLinks.map((link) => (
                <div 
                  key={link.id} 
                  className="flex items-center justify-between px-3 py-2 rounded-md bg-muted/30 opacity-60 hover:opacity-100 transition-opacity"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <Calendar className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    <span className="text-xs truncate">{formatDateRange(link.dateStart, link.dateEnd)}</span>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 min-h-0 min-w-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                    onClick={() => handleDeleteClick(link)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
            </CollapsibleContent>
          </Collapsible>
        )}
      </div>

      {/* Modals */}
      <LaundryScheduledLinkModal
        open={scheduledModalOpen}
        onOpenChange={setScheduledModalOpen}
      />

      <LaundryScheduleConfigModal
        open={configModalOpen}
        onOpenChange={setConfigModalOpen}
      />

      <LaundryShareEditModal
        open={editModalOpen}
        onOpenChange={setEditModalOpen}
        shareLink={selectedLink}
      />

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Desactivar este enlace?</AlertDialogTitle>
            <AlertDialogDescription>
              El enlace dejará de funcionar y los repartidores no podrán acceder.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Desactivar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default LaundryShareManagement;
