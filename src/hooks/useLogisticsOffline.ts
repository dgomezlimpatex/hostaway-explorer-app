import { useState, useEffect, useCallback, useRef } from 'react';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface OfflineOperation {
  id: string;
  type: 'create' | 'update' | 'delete';
  table: string;
  data: any;
  timestamp: number;
  retries: number;
}

interface CacheData {
  picklists: any[];
  picklistItems: any[];
  properties: any[];
  inventoryProducts: any[];
  lastSync: number;
}

export const useLogisticsOffline = () => {
  const { isOnline } = useNetworkStatus();
  const { toast } = useToast();
  const [isSync, setIsSync] = useState(false);
  const [pendingOperations, setPendingOperations] = useState<OfflineOperation[]>([]);
  const [cachedData, setCachedData] = useState<CacheData | null>(null);
  const syncTimeoutRef = useRef<NodeJS.Timeout>();

  // Load cached data and pending operations on init
  useEffect(() => {
    loadCachedData();
    loadPendingOperations();
  }, []);

  // Auto sync when coming online
  useEffect(() => {
    if (isOnline && pendingOperations.length > 0) {
      // Delay sync to avoid immediate sync after connection
      syncTimeoutRef.current = setTimeout(() => {
        syncPendingOperations();
      }, 2000);
    }

    return () => {
      if (syncTimeoutRef.current) {
        clearTimeout(syncTimeoutRef.current);
      }
    };
  }, [isOnline, pendingOperations.length]);

  const loadCachedData = useCallback(() => {
    try {
      const cached = localStorage.getItem('logistics-cache');
      if (cached) {
        const data = JSON.parse(cached);
        // Check if cache is not too old (24 hours)
        if (Date.now() - data.lastSync < 24 * 60 * 60 * 1000) {
          setCachedData(data);
        }
      }
    } catch (error) {
      console.error('Error loading cached data:', error);
    }
  }, []);

  const loadPendingOperations = useCallback(() => {
    try {
      const pending = localStorage.getItem('logistics-pending-operations');
      if (pending) {
        setPendingOperations(JSON.parse(pending));
      }
    } catch (error) {
      console.error('Error loading pending operations:', error);
    }
  }, []);

  const saveCacheData = useCallback((data: Partial<CacheData>) => {
    try {
      const currentCache = cachedData || {
        picklists: [],
        picklistItems: [],
        properties: [],
        inventoryProducts: [],
        lastSync: 0
      };

      const newCache = {
        ...currentCache,
        ...data,
        lastSync: Date.now()
      };

      localStorage.setItem('logistics-cache', JSON.stringify(newCache));
      setCachedData(newCache);
    } catch (error) {
      console.error('Error saving cache data:', error);
    }
  }, [cachedData]);

  const addPendingOperation = useCallback((operation: Omit<OfflineOperation, 'id' | 'timestamp' | 'retries'>) => {
    const newOperation: OfflineOperation = {
      ...operation,
      id: `${operation.type}_${Date.now()}_${Math.random()}`,
      timestamp: Date.now(),
      retries: 0
    };

    const updatedOperations = [...pendingOperations, newOperation];
    setPendingOperations(updatedOperations);
    localStorage.setItem('logistics-pending-operations', JSON.stringify(updatedOperations));

    return newOperation.id;
  }, [pendingOperations]);

  const removePendingOperation = useCallback((operationId: string) => {
    const updatedOperations = pendingOperations.filter(op => op.id !== operationId);
    setPendingOperations(updatedOperations);
    localStorage.setItem('logistics-pending-operations', JSON.stringify(updatedOperations));
  }, [pendingOperations]);

  const syncPendingOperations = useCallback(async () => {
    if (!isOnline || isSync || pendingOperations.length === 0) return;

    setIsSync(true);
    let syncedCount = 0;
    let errorCount = 0;

    try {
      for (const operation of pendingOperations) {
        try {
          let success = false;

          switch (operation.type) {
            case 'create':
              const { error: createError } = await supabase
                .from(operation.table as any)
                .insert(operation.data);
              success = !createError;
              break;

            case 'update':
              const { error: updateError } = await supabase
                .from(operation.table as any)
                .update(operation.data.updates)
                .eq('id', operation.data.id);
              success = !updateError;
              break;

            case 'delete':
              const { error: deleteError } = await supabase
                .from(operation.table as any)
                .delete()
                .eq('id', operation.data.id);
              success = !deleteError;
              break;
          }

          if (success) {
            removePendingOperation(operation.id);
            syncedCount++;
          } else {
            // Increment retry count
            const updatedOperation = { ...operation, retries: operation.retries + 1 };
            const updatedOperations = pendingOperations.map(op => 
              op.id === operation.id ? updatedOperation : op
            );
            setPendingOperations(updatedOperations);
            localStorage.setItem('logistics-pending-operations', JSON.stringify(updatedOperations));
            errorCount++;
          }
        } catch (error) {
          console.error('Error syncing operation:', error);
          errorCount++;
        }
      }

      if (syncedCount > 0) {
        toast({
          title: "Sincronización completada",
          description: `${syncedCount} operaciones sincronizadas${errorCount > 0 ? `, ${errorCount} con errores` : ''}`
        });
      }

    } catch (error) {
      console.error('Error during sync:', error);
      toast({
        title: "Error en sincronización",
        description: "No se pudieron sincronizar todas las operaciones",
        variant: "destructive"
      });
    } finally {
      setIsSync(false);
    }
  }, [isOnline, isSync, pendingOperations, toast, removePendingOperation]);

  const getCachedPicklists = useCallback(() => {
    return cachedData?.picklists || [];
  }, [cachedData]);

  const getCachedProperties = useCallback(() => {
    return cachedData?.properties || [];
  }, [cachedData]);

  const getCachedInventoryProducts = useCallback(() => {
    return cachedData?.inventoryProducts || [];
  }, [cachedData]);

  const updateCache = useCallback(async () => {
    if (!isOnline) return false;

    try {
      const [picklistsRes, propertiesRes, productsRes] = await Promise.all([
        supabase.from('logistics_picklists').select('*').order('created_at', { ascending: false }),
        supabase.from('properties').select('id, nombre, codigo').order('nombre'),
        supabase.from('inventory_products').select('id, name, unit_of_measure').order('name')
      ]);

      if (picklistsRes.data && propertiesRes.data && productsRes.data) {
        saveCacheData({
          picklists: picklistsRes.data,
          properties: propertiesRes.data,
          inventoryProducts: productsRes.data
        });
        return true;
      }
    } catch (error) {
      console.error('Error updating cache:', error);
    }
    
    return false;
  }, [isOnline, saveCacheData]);

  const clearCache = useCallback(() => {
    localStorage.removeItem('logistics-cache');
    localStorage.removeItem('logistics-pending-operations');
    setCachedData(null);
    setPendingOperations([]);
  }, []);

  return {
    isOnline,
    isSync,
    pendingOperations: pendingOperations.length,
    cachedData,
    addPendingOperation,
    syncPendingOperations,
    getCachedPicklists,
    getCachedProperties,
    getCachedInventoryProducts,
    updateCache,
    clearCache
  };
};