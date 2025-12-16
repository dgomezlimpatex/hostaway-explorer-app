import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSede } from '@/contexts/SedeContext';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { 
  Link, 
  Plus, 
  Copy, 
  Trash2, 
  ExternalLink, 
  Calendar,
  CalendarRange,
  Package,
  Truck,
  CheckCircle2,
  Clock,
  RefreshCw,
  Home,
  Pencil,
  AlertTriangle,
  Share2,
  ArrowLeft,
  LinkIcon,
  Sparkles,
  ChevronDown,
  ChevronUp,
  Eye,
  Search
} from 'lucide-react';
import { useLaundryShareLinks, LaundryShareLink } from '@/hooks/useLaundryShareLinks';
import { useLaundryTracking } from '@/hooks/useLaundryTracking';
import { LaundryShareLinkModal } from '@/components/laundry-share/LaundryShareLinkModal';
import { LaundryShareEditModal } from '@/components/laundry-share/LaundryShareEditModal';
import { 
  copyShareLinkToClipboard, 
  getShareLinkUrl, 
  formatDateRange, 
  formatExpirationStatus,
  isShareLinkExpired,
  detectTaskChanges
} from '@/services/laundryShareService';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useToast } from '@/hooks/use-toast';
import { format, addDays, startOfWeek, endOfWeek } from 'date-fns';
import { es } from 'date-fns/locale';
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

// Component to show properties for a share link
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

  if (isLoading) return <span className="text-xs text-muted-foreground">...</span>;
  if (!properties || properties.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-1">
      {properties.slice(0, 5).map((code, i) => (
        <Badge key={i} variant="outline" className="text-xs font-normal bg-background">
          {code}
        </Badge>
      ))}
      {properties.length > 5 && (
        <Badge variant="outline" className="text-xs font-normal bg-muted">
          +{properties.length - 5}
        </Badge>
      )}
    </div>
  );
};

// Component to show new tasks alert
const NewTasksAlert = ({ 
  dateStart, 
  dateEnd, 
  snapshotTaskIds,
  originalTaskIds,
  filters,
  onEditClick
}: { 
  dateStart: string; 
  dateEnd: string;
  snapshotTaskIds: string[];
  originalTaskIds: string[];
  filters?: Record<string, any>;
  onEditClick: () => void;
}) => {
  const sedeIds = filters?.sedeIds || (filters?.sedeId ? [filters.sedeId] : undefined);
  
  const { data: changes } = useQuery({
    queryKey: ['share-link-changes', dateStart, dateEnd, originalTaskIds, snapshotTaskIds, sedeIds],
    queryFn: () => detectTaskChanges(originalTaskIds, snapshotTaskIds, dateStart, dateEnd, sedeIds),
    staleTime: 30000,
    refetchInterval: 60000,
  });

  if (!changes || (changes.newTasks.length === 0 && changes.removedTasks.length === 0)) {
    return null;
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            onClick={onEditClick}
            className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-warning/10 text-warning text-xs font-medium hover:bg-warning/20 transition-colors"
          >
            <AlertTriangle className="h-3 w-3" />
            <span>Cambios detectados</span>
          </button>
        </TooltipTrigger>
        <TooltipContent side="top">
          <p className="text-sm">
            {changes.newTasks.length > 0 && `${changes.newTasks.length} nueva(s). `}
            {changes.removedTasks.length > 0 && `${changes.removedTasks.length} eliminada(s).`}
          </p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

// Progress bar for deliveries
const DeliveryProgress = ({ shareLinkId, totalTasks }: { shareLinkId: string; totalTasks: number }) => {
  const { stats } = useLaundryTracking(shareLinkId);
  
  if (totalTasks === 0) return null;

  const preparedPercent = Math.round(((stats.prepared + stats.delivered) / totalTasks) * 100);
  const deliveredPercent = Math.round((stats.delivered / totalTasks) * 100);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-xs">
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1.5">
            <Package className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-muted-foreground">{totalTasks}</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-blue-500" />
            <span className="text-blue-600 dark:text-blue-400">{stats.prepared + stats.delivered} prep.</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
            <span className="text-emerald-600 dark:text-emerald-400">{stats.delivered} entreg.</span>
          </span>
        </div>
        <span className={`font-semibold ${deliveredPercent === 100 ? 'text-emerald-600 dark:text-emerald-400' : 'text-foreground'}`}>
          {deliveredPercent}%
        </span>
      </div>
      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
        <div 
          className="h-full bg-gradient-to-r from-blue-500 to-emerald-500 rounded-full transition-all duration-500"
          style={{ width: `${deliveredPercent}%` }}
        />
      </div>
    </div>
  );
};

// Link card component
const LinkCard = ({ 
  link, 
  onEdit, 
  onCopy, 
  onOpen, 
  onDelete 
}: { 
  link: LaundryShareLink;
  onEdit: () => void;
  onCopy: () => void;
  onOpen: () => void;
  onDelete: () => void;
}) => {
  return (
    <Card className="group hover:shadow-lg hover:border-primary/20 transition-all duration-300">
      <CardContent className="p-0">
        <div className="p-4 space-y-3">
          {/* Header */}
          <div className="flex items-start justify-between gap-2">
            <div className="space-y-1 min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-semibold text-base">
                  {formatDateRange(link.dateStart, link.dateEnd)}
                </h3>
                {link.isPermanent ? (
                  <Badge className="bg-primary/10 text-primary border-0 text-xs">
                    <Sparkles className="h-3 w-3 mr-1" />
                    Permanente
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-xs text-muted-foreground font-normal">
                    <Clock className="h-3 w-3 mr-1" />
                    {formatExpirationStatus(link.expiresAt, link.isPermanent)}
                  </Badge>
                )}
              </div>
              <NewTasksAlert 
                dateStart={link.dateStart}
                dateEnd={link.dateEnd}
                snapshotTaskIds={link.snapshotTaskIds}
                originalTaskIds={link.originalTaskIds}
                filters={link.filters}
                onEditClick={onEdit}
              />
            </div>
            
            {/* Quick actions */}
            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onEdit}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Editar</TooltipContent>
                </Tooltip>
              </TooltipProvider>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onOpen}>
                      <ExternalLink className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Abrir</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          </div>

          {/* Properties */}
          <ShareLinkProperties 
            dateStart={link.dateStart} 
            dateEnd={link.dateEnd} 
            snapshotTaskIds={link.snapshotTaskIds}
          />
          
          {/* Progress */}
          <DeliveryProgress shareLinkId={link.id} totalTasks={link.snapshotTaskIds?.length || 0} />
        </div>
        
        {/* Footer with URL and actions */}
        <div className="flex items-center gap-2 px-4 py-3 bg-muted/30 border-t">
          <button 
            onClick={onCopy}
            className="flex-1 flex items-center gap-2 px-3 py-2 rounded-md bg-background hover:bg-muted transition-colors text-left min-w-0"
          >
            <LinkIcon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            <span className="text-xs font-mono text-muted-foreground truncate">
              {getShareLinkUrl(link.token).replace('https://', '')}
            </span>
          </button>
          <Button variant="secondary" size="sm" onClick={onCopy} className="shrink-0">
            <Copy className="h-3.5 w-3.5 mr-1.5" />
            Copiar
          </Button>
          <Button 
            variant="ghost" 
            size="icon" 
            className="h-8 w-8 text-destructive hover:text-destructive shrink-0"
            onClick={onDelete}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

const LaundryShareManagement = () => {
  const { toast } = useToast();
  const navigate = useNavigate();
  const { activeSede } = useSede();
  const { shareLinks, isLoading, refetch, deactivateShareLink } = useLaundryShareLinks();
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedLink, setSelectedLink] = useState<LaundryShareLink | null>(null);
  const [showExpired, setShowExpired] = useState(false);
  const [allowDateEdit, setAllowDateEdit] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  
  const [dateStart, setDateStart] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [dateEnd, setDateEnd] = useState(format(addDays(new Date(), 7), 'yyyy-MM-dd'));

  // Fetch property codes for all tasks in active links for search functionality
  const allTaskIds = shareLinks?.flatMap(l => l.snapshotTaskIds) || [];
  const { data: taskPropertyMap } = useQuery({
    queryKey: ['laundry-share-properties-search', allTaskIds],
    queryFn: async () => {
      if (allTaskIds.length === 0) return new Map<string, string>();
      
      const { data, error } = await supabase
        .from('tasks')
        .select('id, property, properties(codigo)')
        .in('id', allTaskIds);
      
      if (error) throw error;
      
      const map = new Map<string, string>();
      (data || []).forEach(t => {
        const code = (t.properties as any)?.codigo || t.property;
        map.set(t.id, code.toLowerCase());
      });
      return map;
    },
    enabled: allTaskIds.length > 0,
  });

  const handleCopyLink = async (token: string) => {
    const success = await copyShareLinkToClipboard(token);
    if (success) {
      toast({
        title: 'Enlace copiado',
        description: 'Ya puedes compartirlo por WhatsApp',
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

  const openExternalLink = (token: string) => {
    window.open(getShareLinkUrl(token), '_blank');
  };

  const handleWeeklyPlannerClick = () => {
    const today = new Date();
    const weekStart = startOfWeek(today, { weekStartsOn: 1 });
    const weekEnd = endOfWeek(today, { weekStartsOn: 1 });
    setDateStart(format(weekStart, 'yyyy-MM-dd'));
    setDateEnd(format(weekEnd, 'yyyy-MM-dd'));
    setCreateModalOpen(true);
  };

  // Filter links by search query
  const filterBySearch = (links: LaundryShareLink[]) => {
    if (!searchQuery.trim() || !taskPropertyMap) return links;
    const query = searchQuery.toLowerCase().trim();
    return links.filter(link => 
      link.snapshotTaskIds.some(taskId => {
        const propertyCode = taskPropertyMap.get(taskId);
        return propertyCode?.includes(query);
      })
    );
  };

  const activeLinks = filterBySearch(shareLinks?.filter(l => !isShareLinkExpired(l.expiresAt)) || []);
  const expiredLinks = filterBySearch(shareLinks?.filter(l => isShareLinkExpired(l.expiresAt)) || []);

  // Stats
  const totalTasks = activeLinks.reduce((acc, l) => acc + (l.snapshotTaskIds?.length || 0), 0);

  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-background to-muted/30">
      <div className="container mx-auto py-6 px-4 max-w-5xl space-y-6">
        
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button 
            variant="ghost" 
            size="icon"
            onClick={() => navigate(-1)}
            className="shrink-0"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl font-bold truncate">Enlaces de Lavandería</h1>
            <p className="text-sm text-muted-foreground">
              {activeSede?.nombre || 'Todas las sedes'}
            </p>
          </div>
          <Button onClick={() => setCreateModalOpen(true)} className="shrink-0">
            <Plus className="h-4 w-4 mr-2" />
            <span className="hidden sm:inline">Nuevo</span>
          </Button>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <button
            onClick={handleWeeklyPlannerClick}
            className="flex flex-col items-center gap-2 p-4 rounded-xl border-2 border-dashed hover:border-primary/50 hover:bg-primary/5 transition-all group"
          >
            <div className="p-3 rounded-full bg-primary/10 group-hover:bg-primary/20 transition-colors">
              <CalendarRange className="h-5 w-5 text-primary" />
            </div>
            <span className="text-sm font-medium">Semana Actual</span>
          </button>
          
          <button
            onClick={() => {
              setDateStart(format(new Date(), 'yyyy-MM-dd'));
              setDateEnd(format(new Date(), 'yyyy-MM-dd'));
              setAllowDateEdit(false);
              setCreateModalOpen(true);
            }}
            className="flex flex-col items-center gap-2 p-4 rounded-xl border-2 border-dashed hover:border-primary/50 hover:bg-primary/5 transition-all group"
          >
            <div className="p-3 rounded-full bg-primary/10 group-hover:bg-primary/20 transition-colors">
              <Calendar className="h-5 w-5 text-primary" />
            </div>
            <span className="text-sm font-medium">Solo Hoy</span>
          </button>
          
          <button
            onClick={() => {
              setDateStart(format(addDays(new Date(), 1), 'yyyy-MM-dd'));
              setDateEnd(format(addDays(new Date(), 1), 'yyyy-MM-dd'));
              setAllowDateEdit(false);
              setCreateModalOpen(true);
            }}
            className="flex flex-col items-center gap-2 p-4 rounded-xl border-2 border-dashed hover:border-primary/50 hover:bg-primary/5 transition-all group"
          >
            <div className="p-3 rounded-full bg-primary/10 group-hover:bg-primary/20 transition-colors">
              <Package className="h-5 w-5 text-primary" />
            </div>
            <span className="text-sm font-medium">Mañana</span>
          </button>
          
          <button
            onClick={() => {
              setAllowDateEdit(true);
              setCreateModalOpen(true);
            }}
            className="flex flex-col items-center gap-2 p-4 rounded-xl border-2 border-dashed hover:border-primary/50 hover:bg-primary/5 transition-all group"
          >
            <div className="p-3 rounded-full bg-primary/10 group-hover:bg-primary/20 transition-colors">
              <Sparkles className="h-5 w-5 text-primary" />
            </div>
            <span className="text-sm font-medium">Personalizado</span>
          </button>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por código de propiedad..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-3 gap-3">
          <Card className="bg-gradient-to-br from-primary/5 to-transparent">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2.5 rounded-lg bg-primary/10">
                <LinkIcon className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{activeLinks.length}</p>
                <p className="text-xs text-muted-foreground">Activos</p>
              </div>
            </CardContent>
          </Card>
          
          <Card className="bg-gradient-to-br from-emerald-500/5 to-transparent">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2.5 rounded-lg bg-emerald-500/10">
                <Package className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div>
                <p className="text-2xl font-bold">{totalTasks}</p>
                <p className="text-xs text-muted-foreground">Tareas</p>
              </div>
            </CardContent>
          </Card>
          
          <Card className="bg-gradient-to-br from-muted to-transparent">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2.5 rounded-lg bg-muted">
                <Clock className="h-5 w-5 text-muted-foreground" />
              </div>
              <div>
                <p className="text-2xl font-bold">{expiredLinks.length}</p>
                <p className="text-xs text-muted-foreground">Expirados</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Active Links */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <Share2 className="h-5 w-5 text-primary" />
              Enlaces Activos
            </h2>
            <Button variant="ghost" size="sm" onClick={() => refetch()}>
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : activeLinks.length > 0 ? (
            <div className="grid gap-3 md:grid-cols-2">
              {activeLinks.map((link) => (
                <LinkCard
                  key={link.id}
                  link={link}
                  onEdit={() => handleEditClick(link)}
                  onCopy={() => handleCopyLink(link.token)}
                  onOpen={() => openExternalLink(link.token)}
                  onDelete={() => handleDeleteClick(link)}
                />
              ))}
            </div>
          ) : (
            <Card className="border-dashed">
              <CardContent className="py-12 flex flex-col items-center text-center">
                <div className="p-4 rounded-full bg-muted mb-4">
                  <Share2 className="h-8 w-8 text-muted-foreground/50" />
                </div>
                <h3 className="font-semibold mb-1">Sin enlaces activos</h3>
                <p className="text-sm text-muted-foreground mb-4 max-w-xs">
                  Crea un enlace para compartir con los repartidores
                </p>
                <Button onClick={() => setCreateModalOpen(true)} size="sm">
                  <Plus className="h-4 w-4 mr-2" />
                  Crear enlace
                </Button>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Expired Links */}
        {expiredLinks.length > 0 && (
          <Collapsible open={showExpired} onOpenChange={setShowExpired}>
            <CollapsibleTrigger asChild>
              <button className="flex items-center gap-2 w-full py-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
                {showExpired ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                <span>Enlaces expirados ({expiredLinks.length})</span>
              </button>
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-2 pt-2">
              {expiredLinks.map((link) => (
                <div 
                  key={link.id} 
                  className="flex items-center justify-between p-3 rounded-lg bg-muted/50 opacity-60"
                >
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">{formatDateRange(link.dateStart, link.dateEnd)}</span>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-destructive"
                    onClick={() => handleDeleteClick(link)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </CollapsibleContent>
          </Collapsible>
        )}
      </div>

      {/* Modals */}
      <LaundryShareLinkModal
        open={createModalOpen}
        onOpenChange={setCreateModalOpen}
        dateStart={dateStart}
        dateEnd={dateEnd}
        sedeIds={activeSede ? [activeSede.id] : undefined}
        allowDateEdit={allowDateEdit}
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
