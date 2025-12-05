import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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
  Package,
  Truck,
  CheckCircle2,
  Clock,
  AlertCircle,
  RefreshCw,
  Home,
  Pencil,
  AlertTriangle
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
  if (!properties || properties.length === 0) return <span className="text-muted-foreground text-xs">Sin propiedades</span>;

  return (
    <div className="flex items-center gap-1 flex-wrap">
      <Home className="h-3 w-3 text-muted-foreground shrink-0" />
      <span className="text-xs text-muted-foreground">
        {properties.length <= 3 
          ? properties.join(', ')
          : `${properties.slice(0, 3).join(', ')} +${properties.length - 3} más`
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
  filters,
  onEditClick
}: { 
  dateStart: string; 
  dateEnd: string;
  snapshotTaskIds: string[];
  filters?: Record<string, any>;
  onEditClick: () => void;
}) => {
  // Extract sedeIds from filters if available
  const sedeIds = filters?.sedeIds || (filters?.sedeId ? [filters.sedeId] : undefined);
  
  const { data: changes } = useQuery({
    queryKey: ['share-link-changes', dateStart, dateEnd, snapshotTaskIds, sedeIds],
    queryFn: () => detectTaskChanges(snapshotTaskIds, dateStart, dateEnd, sedeIds),
    staleTime: 30000, // 30 seconds
    refetchInterval: 60000, // Refetch every minute
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
            className="flex items-center gap-1 px-2 py-1 rounded-md bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 text-xs font-medium hover:bg-amber-200 dark:hover:bg-amber-900/50 transition-colors"
          >
            <AlertTriangle className="h-3 w-3" />
            {hasNew && <span>+{changes.newTasks.length} nuevas</span>}
            {hasNew && hasRemoved && <span className="mx-0.5">/</span>}
            {hasRemoved && <span className="text-red-600 dark:text-red-400">-{changes.removedTasks.length} eliminadas</span>}
          </button>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs">
          <p className="text-sm">
            {hasNew && `${changes.newTasks.length} tarea(s) nueva(s) no incluida(s) en el enlace. `}
            {hasRemoved && `${changes.removedTasks.length} tarea(s) del enlace ya no existe(n). `}
            Haz clic para editar.
          </p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

// Component to show tracking stats for a share link
const ShareLinkStats = ({ shareLinkId }: { shareLinkId: string }) => {
  const { stats } = useLaundryTracking(shareLinkId);
  
  const total = stats.pending + stats.prepared + stats.delivered;
  if (total === 0) return <span className="text-muted-foreground text-sm">Sin entregas registradas</span>;

  return (
    <div className="flex items-center gap-3 text-sm">
      <div className="flex items-center gap-1">
        <Package className="h-4 w-4 text-muted-foreground" />
        <span>{total} total</span>
      </div>
      <div className="flex items-center gap-1 text-blue-600">
        <Package className="h-4 w-4" />
        <span>{stats.prepared + stats.delivered}</span>
      </div>
      <div className="flex items-center gap-1 text-green-600">
        <CheckCircle2 className="h-4 w-4" />
        <span>{stats.delivered}</span>
      </div>
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

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
              ← Volver
            </Button>
          </div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Link className="h-6 w-6" />
            Gestión de Enlaces de Lavandería
          </h1>
          <p className="text-muted-foreground mt-1">
            Crea y gestiona enlaces compartibles para los repartidores
          </p>
        </div>
        <Button onClick={() => setCreateModalOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Nuevo Enlace
        </Button>
      </div>

        {/* Quick create section */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Crear Enlace Rápido</CardTitle>
            <CardDescription>
              Selecciona el rango de fechas para generar un nuevo enlace compartible
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col sm:flex-row gap-4 items-end">
              <div className="space-y-2 flex-1">
                <Label htmlFor="dateStart">Fecha inicio</Label>
                <Input
                  id="dateStart"
                  type="date"
                  value={dateStart}
                  onChange={(e) => setDateStart(e.target.value)}
                />
              </div>
              <div className="space-y-2 flex-1">
                <Label htmlFor="dateEnd">Fecha fin</Label>
                <Input
                  id="dateEnd"
                  type="date"
                  value={dateEnd}
                  onChange={(e) => setDateEnd(e.target.value)}
                />
              </div>
              <Button onClick={() => setCreateModalOpen(true)}>
                <Link className="h-4 w-4 mr-2" />
                Generar Enlace
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Active links list */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-lg">Enlaces Activos</CardTitle>
              <CardDescription>
                {shareLinks?.length || 0} enlaces activos
              </CardDescription>
            </div>
            <Button variant="ghost" size="icon" onClick={() => refetch()}>
              <RefreshCw className="h-4 w-4" />
            </Button>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-8 text-muted-foreground">
                Cargando enlaces...
              </div>
            ) : shareLinks && shareLinks.length > 0 ? (
              <div className="space-y-3">
                {shareLinks.map((link) => {
                  const expired = isShareLinkExpired(link.expiresAt);
                  
                  return (
                    <div
                      key={link.id}
                      className={`p-4 rounded-lg border ${expired ? 'bg-muted/50 opacity-60' : 'bg-card'}`}
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="space-y-1 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium">
                              {formatDateRange(link.dateStart, link.dateEnd)}
                            </span>
                            {expired ? (
                              <Badge variant="destructive">Expirado</Badge>
                            ) : link.isPermanent ? (
                              <Badge variant="secondary">Permanente</Badge>
                            ) : (
                              <Badge variant="outline">
                                <Clock className="h-3 w-3 mr-1" />
                                {formatExpirationStatus(link.expiresAt, link.isPermanent)}
                              </Badge>
                            )}
                            {!expired && (
                              <NewTasksAlert 
                                dateStart={link.dateStart}
                                dateEnd={link.dateEnd}
                                snapshotTaskIds={link.snapshotTaskIds}
                                filters={link.filters}
                                onEditClick={() => handleEditClick(link)}
                              />
                            )}
                          </div>
                          
                          <div className="text-sm text-muted-foreground font-mono">
                            {getShareLinkUrl(link.token)}
                          </div>
                          
                          <ShareLinkProperties 
                            dateStart={link.dateStart} 
                            dateEnd={link.dateEnd} 
                            snapshotTaskIds={link.snapshotTaskIds}
                          />
                          <ShareLinkStats shareLinkId={link.id} />
                        </div>
                        
                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleEditClick(link)}
                          >
                            <Pencil className="h-4 w-4 mr-1" />
                            Editar
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleCopyLink(link.token)}
                          >
                            <Copy className="h-4 w-4 mr-1" />
                            Copiar
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openExternalLink(link.token)}
                          >
                            <ExternalLink className="h-4 w-4 mr-1" />
                            Abrir
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-destructive hover:text-destructive"
                            onClick={() => handleDeleteClick(link)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-12 text-muted-foreground">
                <Link className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No hay enlaces activos</p>
                <p className="text-sm">Crea un nuevo enlace para compartir con los repartidores</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Create modal */}
        <LaundryShareLinkModal
          open={createModalOpen}
          onOpenChange={setCreateModalOpen}
          dateStart={dateStart}
          dateEnd={dateEnd}
        />

        {/* Edit modal */}
        <LaundryShareEditModal
          open={editModalOpen}
          onOpenChange={setEditModalOpen}
          shareLink={selectedLink}
        />

        {/* Delete confirmation dialog */}
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
  );
};

export default LaundryShareManagement;
