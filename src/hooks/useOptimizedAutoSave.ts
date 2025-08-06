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

  // Configuración dinámica del intervalo de autoguardado
  const getAutoSaveInterval = useCallback(() => {
    if (!isOnline) return 0; // No autoguardar offline
    if (isMobile) {
      return isSlowConnection ? 15000 : 10000; // 15s conexión lenta, 10s móvil normal
    }
    return 5000; // 5s escritorio
  }, [isOnline, isMobile, isSlowConnection]);

  const saveData = useCallback(() => {
    const now = Date.now();
    const interval = getAutoSaveInterval();
    
    // Verificar si han pasado suficientes tiempo desde el último guardado
    if (now - lastSaveRef.current < interval) {
      return;
    }

    // Verificar si los datos han cambiado
    if (JSON.stringify(data) === JSON.stringify(lastDataRef.current)) {
      return;
    }

    if (!isOnline && reportId) {
      // Guardar offline
      offlineStorage.saveReportOffline(reportId, data);
      console.log('Auto-saved offline:', reportId);
    } else if (isOnline) {
      // Guardar online silenciosamente
      onSave(data, true);
      console.log('Auto-saved online');
    }

    lastDataRef.current = data;
    lastSaveRef.current = now;
  }, [data, onSave, reportId, isOnline, getAutoSaveInterval]);

  // Configurar autoguardado
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

    // Configurar nuevo timeout
    timeoutRef.current = setTimeout(() => {
      saveData();
    }, interval);

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [data, enabled, saveData, getAutoSaveInterval]);

  // Guardar inmediatamente cuando se recupera conexión
  useEffect(() => {
    if (isOnline && reportId) {
      const offlineData = offlineStorage.getReportOffline(reportId);
      if (offlineData) {
        console.log('Syncing offline data for report:', reportId);
        onSave(offlineData, true);
        offlineStorage.removeReportOffline(reportId);
      }
    }
  }, [isOnline, reportId, onSave]);

  // Función para forzar guardado manual
  const forceSave = useCallback(() => {
    if (isOnline) {
      onSave(data, false); // No silencioso para mostrar feedback
    } else if (reportId) {
      offlineStorage.saveReportOffline(reportId, data);
    }
    lastDataRef.current = data;
    lastSaveRef.current = Date.now();
  }, [data, onSave, reportId, isOnline]);

  return {
    forceSave,
    isOnline,
    autoSaveEnabled: enabled && getAutoSaveInterval() > 0,
    autoSaveInterval: getAutoSaveInterval(),
  };
};