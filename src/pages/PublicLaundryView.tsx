import { useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useLaundryShareLinkByToken } from '@/hooks/useLaundryShareLinks';
import { useLaundryTracking, LaundryDeliveryStatus } from '@/hooks/useLaundryTracking';
import { LaundryDeliveryCard, LaundryTask } from '@/components/laundry-share/LaundryDeliveryCard';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { Loader2, AlertCircle, Package, CheckCircle2, RefreshCw, Calendar } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { formatDateRange } from '@/services/laundryShareService';
import { Toaster } from '@/components/ui/toaster';

type FilterStatus = 'all' | 'pending' | 'prepared' | 'delivered';

const PublicLaundryView = () => {
  const { token } = useParams<{ token: string }>();
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('all');
  const [filterDate, setFilterDate] = useState<string>('all');

  // Fetch share link data
  const { 
    data: shareLink, 
    isLoading: isLoadingLink, 
    error: linkError 
  } = useLaundryShareLinkByToken(token);

  // Fetch tracking data
  const { 
    trackingData, 
    isLoading: isLoadingTracking, 
    updateTracking, 
    getTaskTracking,
    stats,
    refetch: refetchTracking 
  } = useLaundryTracking(shareLink?.id);

  // Fetch tasks for the share link's date range
  const { data: tasksData, isLoading: isLoadingTasks, refetch: refetchTasks } = useQuery({
    queryKey: ['public-laundry-tasks', shareLink?.id],
    queryFn: async () => {
      if (!shareLink) return [];

      const { data, error } = await supabase
        .from('tasks')
        .select(`
          id,
          property,
          address,
          date,
          start_time,
          end_time,
          cleaner,
          propiedad_id,
          properties (
            codigo,
            numero_sabanas,
            numero_sabanas_pequenas,
            numero_sabanas_suite,
            numero_fundas_almohada,
            numero_toallas_grandes,
            numero_toallas_pequenas,
            numero_alfombrines,
            kit_alimentario,
            jabon_liquido,
            gel_ducha,
            champu,
            acondicionador,
            papel_higienico,
            cantidad_rollos_papel_higienico,
            cantidad_rollos_papel_cocina,
            amenities_bano,
            amenities_cocina
          )
        `)
        .gte('date', shareLink.dateStart)
        .lte('date', shareLink.dateEnd);

      if (error) throw error;
      
      // Sort by date first, then by property code alphabetically
      const sorted = (data || []).sort((a, b) => {
        // First sort by date
        const dateCompare = a.date.localeCompare(b.date);
        if (dateCompare !== 0) return dateCompare;
        
        // Then by property code
        const codeA = (a.properties as any)?.codigo || a.property || '';
        const codeB = (b.properties as any)?.codigo || b.property || '';
        return codeA.localeCompare(codeB, 'es', { numeric: true });
      });
      
      return sorted;
    },
    enabled: !!shareLink,
  });

  // Map tasks to LaundryTask format - only include tasks in the snapshot
  const tasks: LaundryTask[] = useMemo(() => {
    if (!tasksData || !shareLink) return [];

    const snapshotSet = new Set(shareLink.snapshotTaskIds);

    // Filter to only include tasks that are in the snapshot (manager-approved tasks)
    const includedTasks = tasksData.filter(task => snapshotSet.has(task.id));

    const mappedTasks = includedTasks.map(task => {
      const prop = task.properties as any;

      return {
        id: task.id,
        property: task.property,
        propertyCode: prop?.codigo || task.property,
        address: task.address,
        date: task.date,
        serviceTime: `${task.start_time} - ${task.end_time}`,
        cleaner: task.cleaner || undefined,
        sheets: prop?.numero_sabanas || 0,
        sheetsSmall: prop?.numero_sabanas_pequenas || 0,
        sheetsSuite: prop?.numero_sabanas_suite || 0,
        pillowCases: prop?.numero_fundas_almohada || 0,
        towelsLarge: prop?.numero_toallas_grandes || 0,
        towelsSmall: prop?.numero_toallas_pequenas || 0,
        bathMats: prop?.numero_alfombrines || 0,
        foodKit: prop?.kit_alimentario || 0,
        soapLiquid: prop?.jabon_liquido || 0,
        showerGel: prop?.gel_ducha || 0,
        shampoo: prop?.champu || 0,
        conditioner: prop?.acondicionador || 0,
        toiletPaper: prop?.papel_higienico || 0,
        toiletPaperRolls: prop?.cantidad_rollos_papel_higienico || 0,
        kitchenPaperRolls: prop?.cantidad_rollos_papel_cocina || 0,
        bathroomAmenities: prop?.amenities_bano || 0,
        kitchenAmenities: prop?.amenities_cocina || 0,
      } as LaundryTask;
    });

    return mappedTasks;
  }, [tasksData, shareLink]);

  // Get unique dates for filter
  const uniqueDates = useMemo(() => {
    const dates = [...new Set(tasks.map(t => t.date))];
    return dates.sort();
  }, [tasks]);

  // Filter tasks
  const filteredTasks = useMemo(() => {
    return tasks.filter(task => {
      // Date filter
      if (filterDate !== 'all' && task.date !== filterDate) return false;

      // Status filter
      if (filterStatus !== 'all') {
        const tracking = getTaskTracking(task.id);
        const status = tracking?.status || 'pending';
        if (status !== filterStatus) return false;
      }

      return true;
    });
  }, [tasks, filterDate, filterStatus, getTaskTracking]);

  // Group filtered tasks by date
  const tasksByDate = useMemo(() => {
    const grouped: Record<string, LaundryTask[]> = {};
    filteredTasks.forEach(task => {
      if (!grouped[task.date]) {
        grouped[task.date] = [];
      }
      grouped[task.date].push(task);
    });
    return grouped;
  }, [filteredTasks]);

  // Format date for separator
  const formatDateSeparator = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('es-ES', { 
      weekday: 'long', 
      day: 'numeric', 
      month: 'long' 
    });
  };

  // Handle status update - simplified, no name required
  const handleStatusUpdate = async (
    taskId: string, 
    status: LaundryDeliveryStatus
  ) => {
    if (!shareLink) return;

    await updateTracking.mutateAsync({
      shareLinkId: shareLink.id,
      taskId,
      status,
      personName: 'Repartidor', // Default name since we no longer ask
    });
  };

  // Refresh data
  const handleRefresh = () => {
    refetchTasks();
    refetchTracking();
  };

  // Loading state
  if (isLoadingLink || isLoadingTasks) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-4">
          <Loader2 className="h-10 w-10 animate-spin mx-auto text-primary" />
          <p className="text-muted-foreground">Cargando lista de lavandería...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (linkError || !shareLink) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="text-center space-y-4 max-w-md">
          <AlertCircle className="h-12 w-12 mx-auto text-destructive" />
          <h1 className="text-xl font-semibold">Enlace no válido</h1>
          <p className="text-muted-foreground">
            {linkError?.message || 'Este enlace no existe, ha expirado o ha sido desactivado.'}
          </p>
          <p className="text-sm text-muted-foreground">
            Contacta con el supervisor para obtener un nuevo enlace.
          </p>
        </div>
      </div>
    );
  }

  // Calculate progress percentages
  const totalTasks = tasks.length;
  const preparedCount = stats.prepared + stats.delivered;
  const deliveredCount = stats.delivered;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-background border-b">
        <div className="container max-w-2xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="font-semibold text-lg">Lista de Lavandería</h1>
              <p className="text-sm text-muted-foreground">
                {formatDateRange(shareLink.dateStart, shareLink.dateEnd)}
              </p>
            </div>
            <Button variant="ghost" size="icon" onClick={handleRefresh}>
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>

          {/* Progress stats */}
          <div className="flex gap-4 mt-3 text-sm">
            <div className="flex items-center gap-1">
              <Package className="h-4 w-4 text-muted-foreground" />
              <span>{totalTasks} total</span>
            </div>
            <div className="flex items-center gap-1 text-blue-600">
              <Package className="h-4 w-4" />
              <span>{preparedCount} preparadas</span>
            </div>
            <div className="flex items-center gap-1 text-green-600">
              <CheckCircle2 className="h-4 w-4" />
              <span>{deliveredCount} entregadas</span>
            </div>
          </div>

          {/* Progress bar */}
          <div className="mt-2 h-2 bg-muted rounded-full overflow-hidden">
            <div 
              className="h-full bg-green-500 transition-all duration-300"
              style={{ width: `${totalTasks > 0 ? (deliveredCount / totalTasks) * 100 : 0}%` }}
            />
          </div>
        </div>
      </header>

      {/* Filters */}
      <div className="container max-w-2xl mx-auto px-4 py-3 border-b bg-muted/30">
        <div className="flex gap-2">
          <Select value={filterDate} onValueChange={setFilterDate}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Fecha" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas las fechas</SelectItem>
              {uniqueDates.map(date => (
                <SelectItem key={date} value={date}>
                  {new Date(date).toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' })}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={filterStatus} onValueChange={(v) => setFilterStatus(v as FilterStatus)}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Estado" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="pending">Pendientes</SelectItem>
              <SelectItem value="prepared">Preparadas</SelectItem>
              <SelectItem value="delivered">Entregadas</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Task list */}
      <main className="container max-w-2xl mx-auto px-4 py-4">
        {filteredTasks.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No hay tareas que coincidan con los filtros</p>
          </div>
        ) : (
          <div className="space-y-4">
            {Object.entries(tasksByDate).sort(([a], [b]) => a.localeCompare(b)).map(([date, dateTasks]) => (
              <div key={date}>
                {/* Date separator */}
                <div className="flex items-center gap-2 mb-3 sticky top-[120px] bg-background py-2 z-[5]">
                  <Calendar className="h-4 w-4 text-primary" />
                  <span className="font-medium text-primary capitalize">
                    {formatDateSeparator(date)}
                  </span>
                  <div className="flex-1 h-px bg-border" />
                  <span className="text-sm text-muted-foreground">
                    {dateTasks.length} {dateTasks.length === 1 ? 'tarea' : 'tareas'}
                  </span>
                </div>
                
                {/* Tasks for this date */}
                <div className="space-y-3">
                  {dateTasks.map(task => (
                    <LaundryDeliveryCard
                      key={task.id}
                      task={task}
                      tracking={getTaskTracking(task.id)}
                      shareLinkId={shareLink.id}
                      onStatusUpdate={handleStatusUpdate}
                      isUpdating={updateTracking.isPending}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Toast notifications */}
      <Toaster />
    </div>
  );
};

export default PublicLaundryView;
