import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSede } from '@/contexts/SedeContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
    <div className="flex flex-wrap gap-1.5">
      {properties.slice(0, 8).map((code, i) => (
        <span
          key={i}
          className="px-2 py-0.5 bg-muted text-muted-foreground text-[10px] font-bold rounded uppercase tracking-wider"
        >
          {code}
        </span>
      ))}
      {properties.length > 8 && (
        <span className="px-2 py-0.5 border border-border text-muted-foreground/70 text-[10px] font-bold rounded uppercase tracking-wider">
          +{properties.length - 8} más
        </span>
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
  defaultOpen = false,
  onEdit, 
  onCopy, 
  onOpen, 
  onDelete,
  onApplyChanges,
  onAutoMergeNewTasks,
}: { 
  link: LaundryShareLink;
  highlight?: boolean;
  defaultOpen?: boolean;
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
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const total = link.snapshotTaskIds?.length || 0;
  const preparedCount = stats.prepared + stats.delivered;
  const deliveredPercent = total > 0 ? Math.round((stats.delivered / total) * 100) : 0;
  const hasNewTasks = !!changes && changes.newTasks.length > 0;
  const hasRemovedTasks = !!changes && changes.removedTasks.length > 0;

  // Auto-merge new tasks into snapshot in background (preserves manual edits)
  const autoMergedRef = useRef<string>('');
  useEffect(() => {
    if (!hasNewTasks || !changes) return;
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

  const preparedOnlyPercent = total > 0 ? Math.round((stats.prepared / total) * 100) : 0;
  const isCompleted = total > 0 && stats.delivered === total;

  return (
    <Collapsible 
      open={isOpen} 
      onOpenChange={setIsOpen}
      className={cn(
        'bg-card border border-border rounded-2xl shadow-sm overflow-hidden group transition-all hover:shadow-md',
        highlight && 'ring-2 ring-primary/40 border-primary/40',
        isOpen && 'shadow-md',
      )}
    >
      {/* Collapsed/Always-visible header */}
      <div className="flex items-center gap-3 p-4">
        <CollapsibleTrigger asChild>
          <button className="flex items-center gap-3 flex-1 min-w-0 text-left">
            <HealthDot link={link} changes={changes} />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-foreground text-sm md:text-base leading-tight truncate">
                  {formatDateRange(link.dateStart, link.dateEnd)}
                </h3>
                {total > 0 && (
                  <span className={cn(
                    'text-[11px] font-extrabold shrink-0',
                    isCompleted ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground',
                  )}>
                    {deliveredPercent}%
                  </span>
                )}
              </div>
              <div className="flex items-center gap-3 mt-0.5 text-[11px] text-muted-foreground font-medium">
                <span className="inline-flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {formatExpirationStatus(link.expiresAt, link.isPermanent)}
                </span>
                {total > 0 && (
                  <span>{total} apt · {preparedCount} prep · {stats.delivered} entreg</span>
                )}
              </div>
            </div>
            <ChevronDown className={cn(
              'h-4 w-4 text-muted-foreground transition-transform shrink-0',
              isOpen && 'rotate-180'
            )} />
          </button>
        </CollapsibleTrigger>
        <div className="flex items-center gap-2 shrink-0">
          {hasRemovedTasks && (
            <button
              onClick={handleApplyRemoved}
              disabled={applying}
              className="px-2 py-1 bg-amber-50 text-amber-700 rounded-md text-[10px] font-bold border border-amber-100 flex items-center gap-1 hover:bg-amber-100 transition-colors dark:bg-amber-500/10 dark:text-amber-300 dark:border-amber-500/20"
              title="Hay tareas que ya no existen. Pulsa para sincronizar."
            >
              {applying ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <AlertTriangle className="h-3 w-3" />
              )}
              {applying ? '...' : changes!.removedTasks.length}
            </button>
          )}
        </div>
      </div>

      {/* Compact progress bar (always visible when has tasks) */}
      {total > 0 && (
        <div className="px-4 pb-3">
          <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden flex">
            <div 
              className="bg-blue-500 h-full transition-all" 
              style={{ width: `${preparedOnlyPercent}%` }}
            />
            <div 
              className="bg-emerald-500 h-full border-l border-background transition-all"
              style={{ width: `${deliveredPercent}%` }}
            />
          </div>
        </div>
      )}

      <CollapsibleContent>
        {/* Properties */}
        <div className="px-5 pb-4">
          <ShareLinkProperties 
            dateStart={link.dateStart} 
            dateEnd={link.dateEnd} 
            snapshotTaskIds={link.snapshotTaskIds}
          />
        </div>

        {/* Actions toolbar */}
        <div className="px-5 pb-3 flex items-center gap-2">
          <TooltipProvider delayDuration={100}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="outline" size="sm" className="h-8 text-xs" onClick={onEdit}>
                  <Pencil className="h-3.5 w-3.5 mr-1.5" />
                  Editar
                </Button>
              </TooltipTrigger>
              <TooltipContent>Editar tareas incluidas</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="outline" size="sm" className="h-8 text-xs" onClick={onOpen}>
                  <ExternalLink className="h-3.5 w-3.5 mr-1.5" />
                  Abrir
                </Button>
              </TooltipTrigger>
              <TooltipContent>Abrir enlace</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>

        {/* Footer: URL + actions */}
        <div className="px-5 py-3 bg-muted/30 border-t border-border/60 flex items-center justify-between gap-3">
          <button 
            onClick={onCopy}
            className="flex items-center gap-2 truncate flex-1 min-w-0 group/link text-left"
          >
            <LinkIcon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            <span className="text-[11px] font-mono text-muted-foreground truncate group-hover/link:text-primary transition-colors">
              {getShareLinkUrl(link.token).replace('https://', '')}
            </span>
          </button>
          <div className="flex items-center gap-1.5 shrink-0">
            <Button
              variant="outline"
              size="sm"
              onClick={onCopy}
              className="h-7 px-3 text-[11px] font-bold rounded-lg hover:border-primary/40 hover:text-primary"
            >
              <Copy className="h-3 w-3 mr-1" />
              Copiar
            </Button>
            <TooltipProvider delayDuration={100}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-7 w-7 min-h-0 min-w-0 text-muted-foreground hover:text-destructive"
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
      </CollapsibleContent>
    </Collapsible>
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

  // Split active into today vs past (by dateStart)
  const todayStr = useMemo(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }, []);

  // Search filter on active links
  const activeLinks = useMemo(() => {
    if (!search.trim()) return allActive;
    const q = search.toLowerCase();
    return allActive.filter(l => 
      formatDateRange(l.dateStart, l.dateEnd).toLowerCase().includes(q) ||

      l.token.toLowerCase().includes(q)
    );
  }, [allActive, search]);

  // Today's link covers today, past = older than today (dateStart < today)
  const todayLinks = useMemo(
    () => activeLinks.filter(l => l.dateStart <= todayStr && l.dateEnd >= todayStr),
    [activeLinks, todayStr]
  );
  const pastLinks = useMemo(
    () => activeLinks.filter(l => l.dateEnd < todayStr),
    [activeLinks, todayStr]
  );
  const upcomingLinks = useMemo(
    () => activeLinks.filter(l => l.dateStart > todayStr),
    [activeLinks, todayStr]
  );

  const showSearch = allActive.length > 5;


  return (
    <div className="min-h-screen bg-muted/30">
      {/* Sticky header */}
      <div className="sticky top-0 z-30 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 border-b border-border/60">
        <div className="container mx-auto px-4 max-w-4xl">
          <div className="flex items-center justify-between gap-3 py-4">
            <div className="flex items-center gap-3 min-w-0">
              <button
                onClick={() => navigate('/')}
                className="p-2.5 bg-card hover:bg-muted rounded-xl transition-all border border-border shadow-sm shrink-0 group"
              >
                <ArrowLeft className="w-4 h-4 text-muted-foreground group-hover:text-foreground transition-colors" />
              </button>
              <div className="min-w-0">
                <h1 className="text-xl md:text-2xl font-bold text-foreground leading-tight tracking-tight truncate">
                  Enlaces de Lavandería
                </h1>
                <p className="text-xs md:text-sm text-muted-foreground font-medium truncate">
                  {activeSede?.nombre || 'Todas las sedes'} · Centro Operativo
                </p>
              </div>
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="p-2.5 bg-card hover:bg-muted rounded-xl border border-border shadow-sm text-muted-foreground hover:text-foreground transition-all shrink-0">
                  <MoreHorizontal className="w-4 h-4" />
                </button>
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
        </div>
      </div>

      <div className="container mx-auto py-6 px-4 max-w-4xl space-y-6">

        {/* Delivery schedule */}
        <div className="rounded-2xl border border-border bg-card p-5">
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Días de reparto</p>
              <p className="text-xs text-muted-foreground mt-0.5">Calendario actual de entregas</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {[
              { label: 'Lunes', short: 'L', active: true },
              { label: 'Martes', short: 'M', active: false },
              { label: 'Miércoles', short: 'X', active: true },
              { label: 'Jueves', short: 'J', active: false },
              { label: 'Viernes', short: 'V', active: true },
              { label: 'Sábado', short: 'S', active: false },
              { label: 'Domingo', short: 'D', active: true },
            ].map((day) => (
              <div
                key={day.label}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold border ${
                  day.active
                    ? 'bg-primary/10 text-primary border-primary/20'
                    : 'bg-muted/40 text-muted-foreground/60 border-transparent line-through'
                }`}
              >
                <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                  day.active ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground/70'
                }`}>{day.short}</span>
                {day.label}
              </div>
            ))}
          </div>
        </div>

        

        {/* Generate scheduled link — primary CTA */}
        <button 
          onClick={() => setScheduledModalOpen(true)} 
          className="group w-full py-5 border-2 border-dashed border-border rounded-2xl flex items-center justify-center gap-3 text-muted-foreground font-bold hover:border-primary/50 hover:text-primary hover:bg-primary/5 transition-all"
        >
          <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center group-hover:bg-primary/10 transition-colors">
            <Plus className="w-5 h-5" strokeWidth={2.5} />
          </div>
          Generar nuevo enlace de reparto
        </button>

        {/* Active Links */}
        <div className="space-y-4">
          <div className="flex items-center justify-between border-b border-border pb-3">
            <div className="flex items-center gap-2.5">
              <div className="w-2 h-2 rounded-full bg-primary" />
              <span className="text-xs font-bold uppercase tracking-[0.1em] text-muted-foreground">
                Enlaces Activos
                {allActive.length > 0 && (
                  <span className="ml-1 text-foreground">· {allActive.length}</span>
                )}
              </span>
            </div>
            <button
              onClick={() => refetch()}
              className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-primary transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Actualizar
            </button>
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
            <div className="space-y-5">
              {/* Today */}
              {todayLinks.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 px-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-primary">Hoy</span>
                    <div className="h-px flex-1 bg-border" />
                  </div>
                  {todayLinks.map((link) => (
                    <LinkCard
                      key={link.id}
                      link={link}
                      highlight={highlightedId === link.id}
                      defaultOpen
                      onEdit={() => handleEditClick(link)}
                      onCopy={() => handleCopyLink(link.token)}
                      onOpen={() => openExternalLink(link.token)}
                      onDelete={() => handleDeleteClick(link)}
                      onApplyChanges={(ids) => handleApplyChanges(link.id, ids)}
                      onAutoMergeNewTasks={(ids, existing, original) => handleAutoMergeNewTasks(link.id, ids, existing, original)}
                    />
                  ))}
                </div>
              )}

              {/* Upcoming */}
              {upcomingLinks.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 px-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Próximos · {upcomingLinks.length}</span>
                    <div className="h-px flex-1 bg-border" />
                  </div>
                  {upcomingLinks.map((link) => (
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
              )}

              {/* Past */}
              {pastLinks.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 px-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Pasados · {pastLinks.length}</span>
                    <div className="h-px flex-1 bg-border" />
                  </div>
                  {pastLinks.map((link) => (
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
              )}

              {todayLinks.length === 0 && upcomingLinks.length === 0 && pastLinks.length === 0 && (
                <div className="rounded-lg border border-dashed py-8 text-center">
                  <p className="text-sm text-muted-foreground">Sin enlaces activos en los filtros</p>
                </div>
              )}
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
                Genera tu primer enlace de reparto desde el botón superior
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
