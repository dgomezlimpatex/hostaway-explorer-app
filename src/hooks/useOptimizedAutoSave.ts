import { useEffect, useRef, useCallback } from 'react';
import { useNetworkStatus } from './useNetworkStatus';
import { useDeviceType } from './use-mobile';
import { offlineStorage } from '@/utils/offlineStorage';

interface UseOptimizedAutoSaveProps {
  data: any;
  onSave: (data: any, silent?: boolean) => void;
  reportId?: string;
  enabled?: boolean;
  isCompletingRef?: React.MutableRefObject<boolean>;
}

export const useOptimizedAutoSave = ({ 
  data, 
  onSave, 
  reportId,
  enabled = true,
  isCompletingRef
}: UseOptimizedAutoSaveProps) => {
  const { isOnline, isSlowConnection } = useNetworkStatus();
  const { isMobile } = useDeviceType();
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastDataRef = useRef<any>(null);
  const lastSaveRef = useRef<number>(0);
  const isInitialLoadRef = useRef<boolean>(true);
  const saveCountRef = useRef<number>(0);

  // Reset initial load ref when reportId changes (new report)
  useEffect(() => {
    if (reportId) {
      console.log('🔄 AutoSave: New report detected, resetting state', { reportId });
      isInitialLoadRef.current = true;
      saveCountRef.current = 0;
    }
  }, [reportId]);

  // Configuración dinámica del intervalo de autoguardado
  const getAutoSaveInterval = useCallback(() => {
    if (!isOnline) return 0; // No autoguardar offline
    if (isMobile) {
      return isSlowConnection ? 15000 : 10000; // Reducido para móvil
    }
    return 5000; // Más frecuente en escritorio
  }, [isOnline, isMobile, isSlowConnection]);

  // Helper to check if data has meaningful content
  const hasChecklistContent = useCallback((checklistData: any): boolean => {
    if (!checklistData || typeof checklistData !== 'object') return false;
    const checklistCompleted = checklistData.checklist_completed;
    if (!checklistCompleted || typeof checklistCompleted !== 'object') return false;
    return Object.keys(checklistCompleted).length > 0;
  }, []);

  const saveData = useCallback(() => {
    // CRITICAL: Never auto-save during completion flow
    if (isCompletingRef?.current) {
      console.log('🛡️ AutoSave: Blocked by isCompletingRef in saveData');
      return;
    }

    const now = Date.now();
    const interval = getAutoSaveInterval();
    
    // Skip if disabled or no interval
    if (!enabled || interval === 0) {
      return;
    }

    // FIXED: On initial load, just store the reference and mark as initialized
    if (isInitialLoadRef.current) {
      console.log('📦 AutoSave: Initial load, storing baseline data');
      isInitialLoadRef.current = false;
      lastDataRef.current = JSON.parse(JSON.stringify(data));
      return;
    }
    
    // Check minimum time between saves
    if (now - lastSaveRef.current < Math.min(interval, 3000)) {
      return;
    }

    // Compare data for changes
    const currentDataStr = JSON.stringify(data);
    const lastDataStr = JSON.stringify(lastDataRef.current);
    
    if (currentDataStr === lastDataStr) {
      return;
    }

    // FIXED: Allow saving even if checklist is empty (notes could have changed)
    // Only skip if ALL data is empty
    const hasNotes = data?.notes && data.notes.trim().length > 0;
    const hasChecklist = hasChecklistContent(data);
    
    if (!hasNotes && !hasChecklist && !data?.issues_found?.length) {
      console.log('⏭️ AutoSave: Skipping - no meaningful content to save');
      return;
    }

    console.log('💾 AutoSave: Saving data...', {
      reportId,
      saveCount: ++saveCountRef.current,
      hasChecklist,
      hasNotes,
      isOnline
    });

    if (!isOnline && reportId) {
      // Guardar offline con throttling
      offlineStorage.saveReportOffline(reportId, data);
      console.log('🔄 AutoSave: Saved offline');
    } else if (isOnline) {
      // Guardar online silenciosamente
      try {
        onSave(data, true);
        console.log('🔄 AutoSave: Saved online successfully');
      } catch (error) {
        console.error('❌ AutoSave: Error saving online:', error);
        // Fallback a offline si falla
        if (reportId) {
          offlineStorage.saveReportOffline(reportId, data);
        }
      }
    }

    lastDataRef.current = JSON.parse(JSON.stringify(data));
    lastSaveRef.current = now;
  }, [data, onSave, reportId, isOnline, getAutoSaveInterval, enabled, hasChecklistContent]);

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
        console.log('🔄 AutoSave: Syncing offline data for report:', reportId);
        try {
          onSave(offlineData, true);
          offlineStorage.removeReportOffline(reportId);
          console.log('✅ AutoSave: Offline data synced successfully');
        } catch (error) {
          console.error('❌ AutoSave: Failed to sync offline data:', error);
        }
      }
    }
  }, [isOnline, reportId, onSave]);

  // Función para forzar guardado manual con protección contra race conditions
  const forceSave = useCallback(() => {
    // CRITICAL: Never force-save during completion flow
    if (isCompletingRef?.current) {
      console.log('🛡️ AutoSave: Force save blocked by isCompletingRef');
      return;
    }

    if (!data) {
      console.warn('⚠️ AutoSave: Attempted to force save with null data');
      return;
    }

    // Check for meaningful content
    const hasNotes = data?.notes && data.notes.trim().length > 0;
    const hasChecklist = hasChecklistContent(data);
    
    if (!hasNotes && !hasChecklist) {
      console.warn('⚠️ AutoSave: Force save skipped - no meaningful content');
      return;
    }

    // Prevenir múltiples guardados simultáneos
    const now = Date.now();
    if (now - lastSaveRef.current < 1500) { // 1.5 segundos mínimo entre guardados forzados
      console.log('⏱️ AutoSave: Force save throttled, too frequent');
      return;
    }

    console.log('💾 AutoSave: Force saving...', { reportId, isOnline });

    if (isOnline) {
      try {
        onSave(data, false); // No silencioso para mostrar feedback
        console.log('💾 AutoSave: Force saved online');
      } catch (error) {
        console.error('❌ AutoSave: Force save error:', error);
        if (reportId) {
          offlineStorage.saveReportOffline(reportId, data);
          console.log('💾 AutoSave: Force saved offline as fallback');
        }
      }
    } else if (reportId) {
      offlineStorage.saveReportOffline(reportId, data);
      console.log('💾 AutoSave: Force saved offline');
    }
    
    lastDataRef.current = JSON.parse(JSON.stringify(data));
    lastSaveRef.current = now;
  }, [data, onSave, reportId, isOnline, hasChecklistContent]);

  return {
    forceSave,
    isOnline,
    autoSaveEnabled: enabled && getAutoSaveInterval() > 0,
    autoSaveInterval: getAutoSaveInterval(),
    lastSaved: lastSaveRef.current,
  };
};