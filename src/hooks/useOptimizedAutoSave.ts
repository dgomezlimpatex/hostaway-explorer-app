import { useEffect, useRef, useCallback } from 'react';
import { useNetworkStatus } from './useNetworkStatus';
import { useDeviceType } from './use-mobile';
import { offlineStorage } from '@/utils/offlineStorage';

interface UseOptimizedAutoSaveProps {
  data: any;
  onSave: (data: any, silent?: boolean) => void;
  reportId?: string;
  enabled?: boolean;
}

export const useOptimizedAutoSave = ({ 
  data, 
  onSave, 
  reportId,
  enabled = true 
}: UseOptimizedAutoSaveProps) => {
  const { isOnline, isSlowConnection } = useNetworkStatus();
  const { isMobile } = useDeviceType();
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastDataRef = useRef<any>(null);
  const lastSaveRef = useRef<number>(0);
  const isInitialLoadRef = useRef<boolean>(true);

  // Configuración dinámica del intervalo de autoguardado
  const getAutoSaveInterval = useCallback(() => {
    if (!isOnline) return 0; // No autoguardar offline
    if (isMobile) {
      return isSlowConnection ? 20000 : 15000; // Más tiempo en móvil
    }
    return 8000; // Más conservador en escritorio
  }, [isOnline, isMobile, isSlowConnection]);

  const saveData = useCallback(() => {
    const now = Date.now();
    const interval = getAutoSaveInterval();
    
    // No autoguardar si es la carga inicial
    if (isInitialLoadRef.current) {
      isInitialLoadRef.current = false;
      lastDataRef.current = data;
      return;
    }
    
    // Verificar si han pasado suficientes tiempo desde el último guardado
    if (now - lastSaveRef.current < interval) {
      return;
    }

    // Verificar si los datos han cambiado significativamente
    const currentDataStr = JSON.stringify(data);
    const lastDataStr = JSON.stringify(lastDataRef.current);
    
    if (currentDataStr === lastDataStr) {
      return;
    }

    // Verificar que los datos tienen contenido válido
    if (!data || Object.keys(data).length === 0) {
      return;
    }

    if (!isOnline && reportId) {
      // Guardar offline con throttling
      offlineStorage.saveReportOffline(reportId, data);
      console.log('🔄 Auto-saved offline:', reportId);
    } else if (isOnline) {
      // Guardar online silenciosamente con debounce
      try {
        onSave(data, true);
        console.log('🔄 Auto-saved online');
      } catch (error) {
        console.error('❌ Auto-save error:', error);
        // Fallback a offline si falla
        if (reportId) {
          offlineStorage.saveReportOffline(reportId, data);
        }
      }
    }

    lastDataRef.current = data;
    lastSaveRef.current = now;
  }, [data, onSave, reportId, isOnline, getAutoSaveInterval]);

  // Configurar autoguardado con debounce mejorado
  useEffect(() => {
    if (!enabled) return;

    const interval = getAutoSaveInterval();
    
    if (interval === 0) {
      // Limpiar timeout si no hay conexión
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      return;
    }

    // Limpiar timeout anterior
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    // Configurar nuevo timeout con debounce
    timeoutRef.current = setTimeout(() => {
      saveData();
    }, interval);

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [data, enabled, saveData, getAutoSaveInterval]);

  // Sincronizar datos offline cuando se recupera conexión
  useEffect(() => {
    if (isOnline && reportId && !isInitialLoadRef.current) {
      const offlineData = offlineStorage.getReportOffline(reportId);
      if (offlineData && Object.keys(offlineData).length > 0) {
        console.log('🔄 Syncing offline data for report:', reportId);
        try {
          onSave(offlineData, true);
          offlineStorage.removeReportOffline(reportId);
          console.log('✅ Offline data synced successfully');
        } catch (error) {
          console.error('❌ Failed to sync offline data:', error);
        }
      }
    }
  }, [isOnline, reportId, onSave]);

  // Función para forzar guardado manual con protección contra race conditions
  const forceSave = useCallback(() => {
    if (!data || Object.keys(data).length === 0) {
      console.warn('⚠️ Attempted to save empty data');
      return;
    }

    // Prevenir múltiples guardados simultáneos
    const now = Date.now();
    if (now - lastSaveRef.current < 2000) { // 2 segundos mínimo entre guardados forzados
      console.log('⏱️ Force save throttled, too frequent');
      return;
    }

    if (isOnline) {
      try {
        onSave(data, false); // No silencioso para mostrar feedback
        console.log('💾 Force saved online');
      } catch (error) {
        console.error('❌ Force save error:', error);
        if (reportId) {
          offlineStorage.saveReportOffline(reportId, data);
          console.log('💾 Force saved offline as fallback');
        }
      }
    } else if (reportId) {
      offlineStorage.saveReportOffline(reportId, data);
      console.log('💾 Force saved offline');
    }
    
    lastDataRef.current = data;
    lastSaveRef.current = now;
  }, [data, onSave, reportId, isOnline]);

  return {
    forceSave,
    isOnline,
    autoSaveEnabled: enabled && getAutoSaveInterval() > 0,
    autoSaveInterval: getAutoSaveInterval(),
    lastSaved: lastSaveRef.current,
  };
};