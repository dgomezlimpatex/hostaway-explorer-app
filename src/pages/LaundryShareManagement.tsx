import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { 
  Link, 
  Plus, 
  Copy, 
  Trash2, 
  ExternalLink, 
  Calendar,
  Package,
  Truck,
  CheckCircle2,
  Clock,
  RefreshCw,
  Home,
  Pencil,
  AlertTriangle,
  Sparkles,
  Share2,
  ArrowLeft,
  LinkIcon
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
import { format, addDays } from 'date-fns';
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
      
      // Filter to only include tasks in the snapshot
      const snapshotSet = new Set(snapshotTaskIds);
      const includedTasks = (data || []).filter(t => snapshotSet.has(t.id));
      
      // Get unique property codes, sorted alphabetically
      const uniqueCodes = [...new Set(includedTasks.map(t => 
        (t.properties as any)?.codigo || t.property
      ))].sort((a, b) => a.localeCompare(b, 'es', { numeric: true }));
      
      return uniqueCodes;
    },
  });

  if (isLoading) return <span className="text-muted-foreground text-xs">Cargando...</span>;
  if (!properties || properties.length === 0) return null;

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <Home className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
      <span className="text-sm text-muted-foreground">
        {properties.length <= 4 
          ? properties.join(', ')
          : `${properties.slice(0, 4).join(', ')} +${properties.length - 4} más`
        }
      </span>
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
  // Extract sedeIds from filters if available
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

  const hasNew = changes.newTasks.length > 0;
  const hasRemoved = changes.removedTasks.length > 0;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            onClick={onEditClick}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 text-xs font-medium hover:bg-amber-200 dark:hover:bg-amber-900/50 transition-colors"
          >
            <AlertTriangle className="h-3 w-3" />
            {hasNew && <span>+{changes.newTasks.length} nuevas</span>}
            {hasNew && hasRemoved && <span className="mx-0.5">/</span>}
            {hasRemoved && <span className="text-red-600 dark:text-red-400">-{changes.removedTasks.length}</span>}
          </button>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs">
          <p className="text-sm">
            {hasNew && `${changes.newTasks.length} tarea(s) nueva(s) no incluida(s). `}
            {hasRemoved && `${changes.removedTasks.length} tarea(s) eliminada(s). `}
            Haz clic para editar.
          </p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

// Compact real-time counter for deliveries
const ShareLinkCounter = ({ shareLinkId, totalTasks }: { shareLinkId: string; totalTasks: number }) => {
  const { stats } = useLaundryTracking(shareLinkId);
  
  if (totalTasks === 0) return null;

  const preparedCount = stats.prepared + stats.delivered;
  const deliveredPercent = Math.round((stats.delivered / totalTasks) * 100);

  return (
    <div className="flex items-center gap-3 text-sm flex-wrap">
      <div className="flex items-center gap-1.5">
        <Package className="h-4 w-4 text-muted-foreground" />
        <span className="text-muted-foreground">{totalTasks} total</span>
      </div>
      <div className="h-4 w-px bg-border" />
      <div className="flex items-center gap-1.5">
        <div className="h-2 w-2 rounded-full bg-blue-400" />
        <span className="text-blue-600 dark:text-blue-400 font-medium">{preparedCount}/{totalTasks} preparadas</span>
      </div>
      <div className="flex items-center gap-1.5">
        <div className="h-2 w-2 rounded-full bg-emerald-500" />
        <span className="text-emerald-600 dark:text-emerald-400 font-medium">{stats.delivered}/{totalTasks} entregadas</span>
      </div>
      <Badge 
        variant={deliveredPercent === 100 ? "default" : "secondary"}
        className={deliveredPercent === 100 ? "bg-emerald-500 hover:bg-emerald-600" : ""}
      >
        {deliveredPercent}%
      </Badge>
    </div>
  );
};

const LaundryShareManagement = () => {
  const { toast } = useToast();
  const navigate = useNavigate();
  const { shareLinks, isLoading, refetch, deactivateShareLink } = useLaundryShareLinks();
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedLink, setSelectedLink] = useState<LaundryShareLink | null>(null);
  
  // Default date range: today + 7 days
  const [dateStart, setDateStart] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [dateEnd, setDateEnd] = useState(format(addDays(new Date(), 7), 'yyyy-MM-dd'));

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
    const url = getShareLinkUrl(token);
    window.open(url, '_blank');
  };

  const activeLinks = shareLinks?.filter(l => !isShareLinkExpired(l.expiresAt)) || [];
  const expiredLinks = shareLinks?.filter(l => isShareLinkExpired(l.expiresAt)) || [];

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/20">
      <div className="container mx-auto py-6 px-4 space-y-8">
        {/* Hero Header */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary/10 via-primary/5 to-background border p-6 md:p-8">
          <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
          <div className="relative">
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => navigate(-1)}
              className="mb-4 -ml-2 text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="h-4 w-4 mr-1" />
              Volver
            </Button>
            
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <div className="p-2.5 rounded-xl bg-primary/10">
                    <Share2 className="h-6 w-6 text-primary" />
                  </div>
                  <h1 className="text-2xl md:text-3xl font-bold">
                    Enlaces de Lavandería
                  </h1>
                </div>
                <p className="text-muted-foreground max-w-xl">
                  Genera enlaces seguros para compartir las entregas de lavandería con los repartidores. 
                  Sin necesidad de login, actualización en tiempo real.
                </p>
              </div>
              
              <Button 
                size="lg" 
                onClick={() => setCreateModalOpen(true)}
                className="shrink-0 shadow-lg shadow-primary/20"
              >
                <Plus className="h-5 w-5 mr-2" />
                Nuevo Enlace
              </Button>
            </div>
            
            {/* Quick Stats */}
            <div className="flex flex-wrap gap-4 mt-6">
              <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-background/80 border">
                <LinkIcon className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium">{activeLinks.length} activos</span>
              </div>
              {expiredLinks.length > 0 && (
                <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-background/80 border">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">{expiredLinks.length} expirados</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Quick Create Card */}
        <Card className="border-dashed border-2 hover:border-primary/50 transition-colors">
          <CardContent className="p-6">
            <div className="flex flex-col lg:flex-row lg:items-end gap-6">
              <div className="flex-1 space-y-4">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-primary" />
                  <h3 className="font-semibold text-lg">Crear Enlace Rápido</h3>
                </div>
                <p className="text-sm text-muted-foreground">
                  Selecciona el rango de fechas y genera un enlace instantáneamente
                </p>
                <div className="flex flex-col sm:flex-row gap-4">
                  <div className="space-y-2 flex-1">
                    <Label htmlFor="dateStart" className="text-xs text-muted-foreground">Desde</Label>
                    <Input
                      id="dateStart"
                      type="date"
                      value={dateStart}
                      onChange={(e) => setDateStart(e.target.value)}
                      className="bg-background"
                    />
                  </div>
                  <div className="space-y-2 flex-1">
                    <Label htmlFor="dateEnd" className="text-xs text-muted-foreground">Hasta</Label>
                    <Input
                      id="dateEnd"
                      type="date"
                      value={dateEnd}
                      onChange={(e) => setDateEnd(e.target.value)}
                      className="bg-background"
                    />
                  </div>
                </div>
              </div>
              <Button 
                onClick={() => setCreateModalOpen(true)}
                variant="outline"
                size="lg"
                className="lg:w-auto w-full"
              >
                <Link className="h-4 w-4 mr-2" />
                Generar Enlace
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Active Links Section */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <h2 className="text-xl font-semibold">Enlaces Activos</h2>
              <Badge variant="secondary" className="rounded-full">
                {activeLinks.length}
              </Badge>
            </div>
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => refetch()}
              className="text-muted-foreground"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Actualizar
            </Button>
          </div>

          {isLoading ? (
            <Card>
              <CardContent className="py-12">
                <div className="flex flex-col items-center justify-center text-muted-foreground">
                  <RefreshCw className="h-8 w-8 animate-spin mb-4" />
                  <p>Cargando enlaces...</p>
                </div>
              </CardContent>
            </Card>
          ) : activeLinks.length > 0 ? (
            <div className="grid gap-4">
              {activeLinks.map((link) => (
                <Card 
                  key={link.id} 
                  className="group hover:shadow-md transition-all duration-200 overflow-hidden"
                >
                  <CardContent className="p-0">
                    <div className="flex flex-col lg:flex-row">
                      {/* Main Content */}
                      <div className="flex-1 p-5 space-y-4">
                        {/* Header with date and badges */}
                        <div className="flex flex-wrap items-center gap-2">
                          <div className="flex items-center gap-2">
                            <Calendar className="h-4 w-4 text-primary" />
                            <span className="font-semibold text-lg">
                              {formatDateRange(link.dateStart, link.dateEnd)}
                            </span>
                          </div>
                          {link.isPermanent ? (
                            <Badge className="bg-primary/10 text-primary hover:bg-primary/20 border-0">
                              Permanente
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-muted-foreground">
                              <Clock className="h-3 w-3 mr-1" />
                              {formatExpirationStatus(link.expiresAt, link.isPermanent)}
                            </Badge>
                          )}
                          <NewTasksAlert 
                            dateStart={link.dateStart}
                            dateEnd={link.dateEnd}
                            snapshotTaskIds={link.snapshotTaskIds}
                            originalTaskIds={link.originalTaskIds}
                            filters={link.filters}
                            onEditClick={() => handleEditClick(link)}
                          />
                        </div>
                        
                        {/* URL */}
                        <div 
                          className="flex items-center gap-2 p-2.5 rounded-lg bg-muted/50 cursor-pointer hover:bg-muted transition-colors"
                          onClick={() => handleCopyLink(link.token)}
                        >
                          <LinkIcon className="h-4 w-4 text-muted-foreground shrink-0" />
                          <span className="text-sm font-mono text-muted-foreground truncate flex-1">
                            {getShareLinkUrl(link.token)}
                          </span>
                          <Copy className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                        </div>
                        
                        {/* Properties */}
                        <ShareLinkProperties 
                          dateStart={link.dateStart} 
                          dateEnd={link.dateEnd} 
                          snapshotTaskIds={link.snapshotTaskIds}
                        />
                        
                        {/* Real-time Counter */}
                        <ShareLinkCounter shareLinkId={link.id} totalTasks={link.snapshotTaskIds?.length || 0} />
                      </div>
                      
                      {/* Actions Sidebar */}
                      <div className="flex lg:flex-col items-center gap-1 p-3 lg:p-4 border-t lg:border-t-0 lg:border-l bg-muted/30">
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleEditClick(link)}
                                className="h-9 w-9"
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Editar tareas</TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                        
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleCopyLink(link.token)}
                                className="h-9 w-9"
                              >
                                <Copy className="h-4 w-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Copiar enlace</TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                        
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => openExternalLink(link.token)}
                                className="h-9 w-9"
                              >
                                <ExternalLink className="h-4 w-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Abrir enlace</TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                        
                        <div className="flex-1 lg:flex-none" />
                        
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleDeleteClick(link)}
                                className="h-9 w-9 text-destructive hover:text-destructive hover:bg-destructive/10"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Desactivar enlace</TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card className="border-dashed">
              <CardContent className="py-16">
                <div className="flex flex-col items-center justify-center text-center">
                  <div className="p-4 rounded-full bg-muted mb-4">
                    <Share2 className="h-10 w-10 text-muted-foreground/50" />
                  </div>
                  <h3 className="font-semibold text-lg mb-2">No hay enlaces activos</h3>
                  <p className="text-muted-foreground text-sm max-w-sm mb-6">
                    Crea un nuevo enlace para compartir las entregas de lavandería con los repartidores
                  </p>
                  <Button onClick={() => setCreateModalOpen(true)}>
                    <Plus className="h-4 w-4 mr-2" />
                    Crear primer enlace
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Expired Links Section (collapsed) */}
        {expiredLinks.length > 0 && (
          <div className="space-y-4">
            <h2 className="text-lg font-medium text-muted-foreground">
              Enlaces Expirados ({expiredLinks.length})
            </h2>
            <div className="grid gap-3 opacity-60">
              {expiredLinks.map((link) => (
                <Card key={link.id} className="bg-muted/30">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">
                          {formatDateRange(link.dateStart, link.dateEnd)}
                        </span>
                        <Badge variant="destructive" className="text-xs">Expirado</Badge>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteClick(link)}
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* Modals */}
        <LaundryShareLinkModal
          open={createModalOpen}
          onOpenChange={setCreateModalOpen}
          dateStart={dateStart}
          dateEnd={dateEnd}
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
                El enlace dejará de funcionar y los repartidores no podrán acceder a él.
                Esta acción no se puede deshacer.
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
    </div>
  );
};

export default LaundryShareManagement;
