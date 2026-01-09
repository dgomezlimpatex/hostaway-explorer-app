import { useMemo, useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useLaundryShareLinkByToken } from '@/hooks/useLaundryShareLinks';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Loader2, AlertCircle, Package, Truck, CheckCircle2, RefreshCw, Building2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { formatDateRange } from '@/services/laundryShareService';
import { groupApartmentsByBuilding, LaundryApartment, BuildingGroup } from '@/services/laundryScheduleService';
import { BuildingCollectionGroup } from '@/components/laundry-share/BuildingCollectionGroup';
import { BuildingDeliveryGroup } from '@/components/laundry-share/BuildingDeliveryGroup';
import { Toaster } from '@/components/ui/toaster';
import { useToast } from '@/hooks/use-toast';

const PublicLaundryScheduledView = () => {
  const { token } = useParams<{ token: string }>();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'collect' | 'deliver'>('collect');

  // Fetch share link data
  const { 
    data: shareLink, 
    isLoading: isLoadingLink, 
    error: linkError 
  } = useLaundryShareLinkByToken(token);

  // Fetch tracking data
  const { data: trackingData, isLoading: isLoadingTracking, refetch: refetchTracking } = useQuery({
    queryKey: ['laundry-scheduled-tracking', shareLink?.id],
    queryFn: async () => {
      if (!shareLink?.id) return [];
      
      const { data, error } = await supabase
        .from('laundry_delivery_tracking')
        .select('*')
        .eq('share_link_id', shareLink.id);

      if (error) throw error;
      return data || [];
    },
    enabled: !!shareLink?.id,
  });

  // Build tracking map
  const trackingMap = useMemo(() => {
    const map = new Map<string, { collectionStatus: string; deliveryStatus: string }>();
    (trackingData || []).forEach(t => {
      map.set(t.task_id, {
        collectionStatus: t.collection_status || 'pending',
        deliveryStatus: t.status || 'pending',
      });
    });
    return map;
  }, [trackingData]);

  // Fetch tasks for the share link
  const { data: tasksData, isLoading: isLoadingTasks, refetch: refetchTasks } = useQuery({
    queryKey: ['public-laundry-scheduled-tasks', shareLink?.id],
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
            id,
            codigo,
            nombre,
            numero_sabanas,
            numero_sabanas_pequenas,
            numero_sabanas_suite,
            numero_fundas_almohada,
            numero_toallas_grandes,
            numero_toallas_pequenas,
            numero_alfombrines,
            papel_higienico,
            papel_cocina,
            champu,
            acondicionador,
            gel_ducha,
            jabon_liquido,
            amenities_bano,
            amenities_cocina,
            ambientador_bano,
            bolsas_basura,
            detergente_lavavajillas,
            bayetas_cocina,
            estropajos,
            limpiacristales,
            desinfectante_bano,
            aceite,
            vinagre,
            sal,
            azucar,
            kit_alimentario
          )
        `)
        .gte('date', shareLink.dateStart)
        .lte('date', shareLink.dateEnd);

      if (error) throw error;
      
      return (data || [])
        .filter(task => shareLink.snapshotTaskIds.includes(task.id))
        .sort((a, b) => {
          const codeA = (a.properties as any)?.codigo || a.property || '';
          const codeB = (b.properties as any)?.codigo || b.property || '';
          return codeA.localeCompare(codeB, 'es', { numeric: true });
        });
    },
    enabled: !!shareLink,
  });

  // Map to LaundryApartment format
  const apartments: LaundryApartment[] = useMemo(() => {
    if (!tasksData) return [];

    return tasksData.map(task => {
      const prop = task.properties as any;
      const tracking = trackingMap.get(task.id);

      return {
        taskId: task.id,
        propertyId: prop?.id || '',
        propertyCode: prop?.codigo || task.property,
        propertyName: prop?.nombre || task.property,
        address: task.address,
        date: task.date,
        serviceTime: `${task.start_time} - ${task.end_time}`,
        cleaner: task.cleaner || undefined,
        textiles: {
          sheets: prop?.numero_sabanas || 0,
          sheetsSmall: prop?.numero_sabanas_pequenas || 0,
          sheetsSuite: prop?.numero_sabanas_suite || 0,
          pillowCases: prop?.numero_fundas_almohada || 0,
          towelsLarge: prop?.numero_toallas_grandes || 0,
          towelsSmall: prop?.numero_toallas_pequenas || 0,
          bathMats: prop?.numero_alfombrines || 0,
        },
        amenities: {
          toiletPaper: prop?.papel_higienico || 0,
          kitchenPaper: prop?.papel_cocina || 0,
          shampoo: prop?.champu || 0,
          conditioner: prop?.acondicionador || 0,
          showerGel: prop?.gel_ducha || 0,
          liquidSoap: prop?.jabon_liquido || 0,
          bathroomAmenities: prop?.amenities_bano || 0,
          kitchenAmenities: prop?.amenities_cocina || 0,
          bathroomAirFreshener: prop?.ambientador_bano || 0,
          trashBags: prop?.bolsas_basura || 0,
          dishwasherDetergent: prop?.detergente_lavavajillas || 0,
          kitchenCloths: prop?.bayetas_cocina || 0,
          sponges: prop?.estropajos || 0,
          glassCleaner: prop?.limpiacristales || 0,
          bathroomDisinfectant: prop?.desinfectante_bano || 0,
          oil: prop?.aceite || 0,
          vinegar: prop?.vinagre || 0,
          salt: prop?.sal || 0,
          sugar: prop?.azucar || 0,
          foodKit: prop?.kit_alimentario || 0,
        },
        collectionStatus: (tracking?.collectionStatus as 'pending' | 'collected') || 'pending',
        deliveryStatus: (tracking?.deliveryStatus as 'pending' | 'prepared' | 'delivered') || 'pending',
      };
    });
  }, [tasksData, trackingMap]);

  // Group by building
  const buildingGroups = useMemo(() => 
    groupApartmentsByBuilding(apartments), 
    [apartments]
  );

  // Calculate stats
  const stats = useMemo(() => {
    const total = apartments.length;
    const collected = apartments.filter(a => {
      const t = trackingMap.get(a.taskId);
      return t?.collectionStatus === 'collected';
    }).length;
    const delivered = apartments.filter(a => {
      const t = trackingMap.get(a.taskId);
      return t?.deliveryStatus === 'delivered';
    }).length;

    return { total, collected, delivered };
  }, [apartments, trackingMap]);

  // Update tracking mutation
  const updateTracking = useMutation({
    mutationFn: async (params: { 
      taskId: string; 
      collectionStatus?: 'collected'; 
      deliveryStatus?: 'delivered';
    }) => {
      if (!shareLink?.id) throw new Error('No share link');
      const now = new Date().toISOString();

      // Check if record exists
      const { data: existing } = await supabase
        .from('laundry_delivery_tracking')
        .select('id')
        .eq('share_link_id', shareLink.id)
        .eq('task_id', params.taskId)
        .single();

      if (existing) {
        const updateData: any = {};
        if (params.collectionStatus) {
          updateData.collection_status = params.collectionStatus;
          updateData.collected_at = now;
          updateData.collected_by_name = 'Repartidor';
        }
        if (params.deliveryStatus) {
          updateData.status = params.deliveryStatus;
          updateData.delivered_at = now;
          updateData.delivered_by_name = 'Repartidor';
        }

        const { error } = await supabase
          .from('laundry_delivery_tracking')
          .update(updateData)
          .eq('id', existing.id);

        if (error) throw error;
      } else {
        const insertData: any = {
          share_link_id: shareLink.id,
          task_id: params.taskId,
          status: params.deliveryStatus || 'pending',
          collection_status: params.collectionStatus || 'pending',
        };

        if (params.collectionStatus) {
          insertData.collected_at = now;
          insertData.collected_by_name = 'Repartidor';
        }
        if (params.deliveryStatus) {
          insertData.delivered_at = now;
          insertData.delivered_by_name = 'Repartidor';
        }

        const { error } = await supabase
          .from('laundry_delivery_tracking')
          .insert(insertData);

        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['laundry-scheduled-tracking', shareLink?.id] });
    },
    onError: (error) => {
      console.error('Error updating tracking:', error);
      toast({
        title: 'Error',
        description: 'No se pudo actualizar el estado',
        variant: 'destructive',
      });
    },
  });

  // Handlers
  const handleCollect = (taskId: string) => {
    updateTracking.mutate({ taskId, collectionStatus: 'collected' });
  };

  const handleCollectAll = async (taskIds: string[]) => {
    for (const taskId of taskIds) {
      await updateTracking.mutateAsync({ taskId, collectionStatus: 'collected' });
    }
    toast({ title: 'Recogida completada', description: `${taskIds.length} apartamentos marcados` });
  };

  const handleDeliver = (taskId: string) => {
    updateTracking.mutate({ taskId, deliveryStatus: 'delivered' });
  };

  const handleDeliverAll = async (taskIds: string[]) => {
    for (const taskId of taskIds) {
      await updateTracking.mutateAsync({ taskId, deliveryStatus: 'delivered' });
    }
    toast({ title: 'Entrega completada', description: `${taskIds.length} apartamentos entregados` });
  };

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
          <p className="text-muted-foreground">Cargando lista de reparto...</p>
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
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-background border-b">
        <div className="container max-w-2xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="font-semibold text-lg">Reparto de Lavandería</h1>
              <p className="text-sm text-muted-foreground">
                {formatDateRange(shareLink.dateStart, shareLink.dateEnd)}
              </p>
            </div>
            <Button variant="ghost" size="icon" onClick={handleRefresh}>
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>

          {/* Stats */}
          <div className="flex gap-4 mt-3 text-sm">
            <div className="flex items-center gap-1">
              <Building2 className="h-4 w-4 text-muted-foreground" />
              <span>{buildingGroups.length} edificios</span>
            </div>
            <div className="flex items-center gap-1">
              <Package className="h-4 w-4 text-muted-foreground" />
              <span>{stats.total} apartamentos</span>
            </div>
          </div>

          {/* Progress bars */}
          <div className="mt-3 space-y-2">
            <div className="flex items-center gap-2 text-xs">
              <span className="w-16 text-muted-foreground">Recogida</span>
              <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                <div 
                  className="h-full bg-amber-500 transition-all duration-300"
                  style={{ width: `${stats.total > 0 ? (stats.collected / stats.total) * 100 : 0}%` }}
                />
              </div>
              <span className="w-12 text-right">{stats.collected}/{stats.total}</span>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <span className="w-16 text-muted-foreground">Entrega</span>
              <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                <div 
                  className="h-full bg-green-500 transition-all duration-300"
                  style={{ width: `${stats.total > 0 ? (stats.delivered / stats.total) * 100 : 0}%` }}
                />
              </div>
              <span className="w-12 text-right">{stats.delivered}/{stats.total}</span>
            </div>
          </div>
        </div>
      </header>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'collect' | 'deliver')} className="w-full">
        <div className="sticky top-[140px] z-[5] bg-background border-b">
          <div className="container max-w-2xl mx-auto px-4">
            <TabsList className="w-full grid grid-cols-2 h-12">
              <TabsTrigger value="collect" className="gap-2">
                <Package className="h-4 w-4" />
                Recoger Sucia
              </TabsTrigger>
              <TabsTrigger value="deliver" className="gap-2">
                <Truck className="h-4 w-4" />
                Entregar Limpia
              </TabsTrigger>
            </TabsList>
          </div>
        </div>

        {/* Collection tab */}
        <TabsContent value="collect" className="mt-0">
          <main className="container max-w-2xl mx-auto px-4 py-4">
            {buildingGroups.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No hay apartamentos para este reparto</p>
              </div>
            ) : (
              <div className="space-y-3">
                {buildingGroups.map(building => (
                  <BuildingCollectionGroup
                    key={building.buildingCode}
                    building={building}
                    trackingMap={trackingMap}
                    onCollect={handleCollect}
                    onCollectAll={handleCollectAll}
                    isUpdating={updateTracking.isPending}
                  />
                ))}
              </div>
            )}
          </main>
        </TabsContent>

        {/* Delivery tab */}
        <TabsContent value="deliver" className="mt-0">
          <main className="container max-w-2xl mx-auto px-4 py-4">
            {buildingGroups.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Truck className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No hay apartamentos para este reparto</p>
              </div>
            ) : (
              <div className="space-y-3">
                {buildingGroups.map(building => (
                  <BuildingDeliveryGroup
                    key={building.buildingCode}
                    building={building}
                    trackingMap={trackingMap}
                    onDeliver={handleDeliver}
                    onDeliverAll={handleDeliverAll}
                    isUpdating={updateTracking.isPending}
                  />
                ))}
              </div>
            )}
          </main>
        </TabsContent>
      </Tabs>

      <Toaster />
    </div>
  );
};

export default PublicLaundryScheduledView;
