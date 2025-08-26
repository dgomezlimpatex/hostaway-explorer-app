import { TaskReport, CreateTaskReportData } from '@/types/taskReports';

interface OfflineOperation {
  id: string;
  type: 'create' | 'update' | 'uploadMedia';
  data: any;
  timestamp: number;
  retryCount: number;
  priority: number; // Nueva: prioridad para ordenar operaciones
}

const OFFLINE_KEY = 'task_reports_offline';
const REPORTS_OFFLINE_KEY = 'offline_reports';
const MAX_RETRY_COUNT = 5; // Incrementado
const SYNC_BATCH_SIZE = 3; // Procesar en lotes

class OfflineStorageManager {
  private operations: OfflineOperation[] = [];
  private syncInProgress = false;

  constructor() {
    this.loadOperations();
    this.setupPeriodicCleanup();
  }

  private loadOperations(): void {
    try {
      const stored = localStorage.getItem(OFFLINE_KEY);
      this.operations = stored ? JSON.parse(stored) : [];
      
      // Limpiar operaciones muy antiguas (más de 7 días)
      const oneWeekAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
      this.operations = this.operations.filter(op => op.timestamp > oneWeekAgo);
      
      console.log('📱 Loaded offline operations:', this.operations.length);
    } catch (error) {
      console.error('❌ Error loading offline operations:', error);
      this.operations = [];
    }
  }

  private saveOperations(): void {
    try {
      // Ordenar por prioridad y timestamp
      this.operations.sort((a, b) => {
        if (a.priority !== b.priority) {
          return b.priority - a.priority; // Prioridad alta primero
        }
        return a.timestamp - b.timestamp; // Más antiguos primero
      });
      
      localStorage.setItem(OFFLINE_KEY, JSON.stringify(this.operations));
      console.log('💾 Saved offline operations:', this.operations.length);
    } catch (error) {
      console.error('❌ Error saving offline operations:', error);
      
      // Si no hay espacio, limpiar operaciones antiguas
      if (error instanceof Error && error.name === 'QuotaExceededError') {
        this.clearOldOperations();
        try {
          localStorage.setItem(OFFLINE_KEY, JSON.stringify(this.operations));
        } catch (retryError) {
          console.error('❌ Still failed after cleanup:', retryError);
        }
      }
    }
  }

  private clearOldOperations(): void {
    // Mantener solo las 50 operaciones más recientes
    this.operations = this.operations
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, 50);
    
    console.log('🧹 Cleaned old operations, kept:', this.operations.length);
  }

  private setupPeriodicCleanup(): void {
    // Limpieza cada 30 minutos
    setInterval(() => {
      this.cleanupFailedOperations();
    }, 30 * 60 * 1000);
  }

  private cleanupFailedOperations(): void {
    const initialCount = this.operations.length;
    this.operations = this.operations.filter(op => op.retryCount < MAX_RETRY_COUNT);
    
    if (this.operations.length < initialCount) {
      this.saveOperations();
      console.log(`🧹 Cleaned ${initialCount - this.operations.length} failed operations`);
    }
  }

  addOperation(type: OfflineOperation['type'], data: any, priority: number = 1): string {
    const operation: OfflineOperation = {
      id: `${type}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type,
      data: this.sanitizeData(data),
      timestamp: Date.now(),
      retryCount: 0,
      priority
    };

    this.operations.push(operation);
    this.saveOperations();
    console.log(`📱 Added offline operation: ${operation.type} (${operation.id})`);
    return operation.id;
  }

  private sanitizeData(data: any): any {
    try {
      // Remover campos que pueden causar problemas
      const sanitized = { ...data };
      
      // Remover File objects que no se pueden serializar
      if (sanitized.file instanceof File) {
        // Convertir File a metadata serializable
        sanitized.fileMetadata = {
          name: sanitized.file.name,
          size: sanitized.file.size,
          type: sanitized.file.type,
          lastModified: sanitized.file.lastModified
        };
        delete sanitized.file;
      }
      
      return sanitized;
    } catch (error) {
      console.error('❌ Error sanitizing data:', error);
      return {};
    }
  }

  removeOperation(id: string): void {
    const initialCount = this.operations.length;
    this.operations = this.operations.filter(op => op.id !== id);
    
    if (this.operations.length < initialCount) {
      this.saveOperations();
      console.log(`✅ Removed offline operation: ${id}`);
    }
  }

  getPendingOperations(): OfflineOperation[] {
    return this.operations
      .filter(op => op.retryCount < MAX_RETRY_COUNT)
      .sort((a, b) => {
        // Prioridad alta primero, luego timestamp
        if (a.priority !== b.priority) {
          return b.priority - a.priority;
        }
        return a.timestamp - b.timestamp;
      });
  }

  incrementRetryCount(id: string): void {
    const operation = this.operations.find(op => op.id === id);
    if (operation) {
      operation.retryCount++;
      
      // Reducir prioridad para operaciones que fallan mucho
      if (operation.retryCount >= 3) {
        operation.priority = Math.max(0, operation.priority - 1);
      }
      
      this.saveOperations();
      console.log(`🔄 Incremented retry count for ${id}: ${operation.retryCount}/${MAX_RETRY_COUNT}`);
    }
  }

  clearOperations(): void {
    this.operations = [];
    this.saveOperations();
    console.log('🧹 Cleared all offline operations');
  }

  // Funciones mejoradas para reportes offline
  saveReportOffline(reportId: string, data: Partial<TaskReport>): void {
    const key = `${REPORTS_OFFLINE_KEY}_${reportId}`;
    const reportData = {
      ...data,
      offline: true,
      lastModified: Date.now(),
      reportId,
      version: Date.now() // Para detectar conflictos
    };
    
    try {
      localStorage.setItem(key, JSON.stringify(reportData));
      console.log('💾 Saved report offline:', reportId);
    } catch (error) {
      console.error('❌ Error saving report offline:', error);
      
      // Intentar limpiar espacio y reintentar
      this.clearOldOfflineReports();
      try {
        localStorage.setItem(key, JSON.stringify(reportData));
        console.log('💾 Saved report offline after cleanup:', reportId);
      } catch (retryError) {
        console.error('❌ Failed to save report after cleanup:', retryError);
      }
    }
  }

  getReportOffline(reportId: string): Partial<TaskReport> | null {
    const key = `${REPORTS_OFFLINE_KEY}_${reportId}`;
    try {
      const stored = localStorage.getItem(key);
      if (stored) {
        const data = JSON.parse(stored);
        
        // Verificar que no sea muy antiguo (más de 24 horas)
        const twentyFourHoursAgo = Date.now() - (24 * 60 * 60 * 1000);
        if (data.lastModified < twentyFourHoursAgo) {
          this.removeReportOffline(reportId);
          return null;
        }
        
        return data;
      }
      return null;
    } catch (error) {
      console.error('❌ Error getting offline report:', error);
      return null;
    }
  }

  removeReportOffline(reportId: string): void {
    const key = `${REPORTS_OFFLINE_KEY}_${reportId}`;
    localStorage.removeItem(key);
    console.log('🗑️ Removed offline report:', reportId);
  }

  private clearOldOfflineReports(): void {
    const keys = Object.keys(localStorage).filter(key => 
      key.startsWith(REPORTS_OFFLINE_KEY)
    );
    
    const twentyFourHoursAgo = Date.now() - (24 * 60 * 60 * 1000);
    let removedCount = 0;
    
    keys.forEach(key => {
      try {
        const data = JSON.parse(localStorage.getItem(key) || '{}');
        if (data.lastModified && data.lastModified < twentyFourHoursAgo) {
          localStorage.removeItem(key);
          removedCount++;
        }
      } catch (error) {
        // Si no se puede parsear, mejor eliminarlo
        localStorage.removeItem(key);
        removedCount++;
      }
    });
    
    console.log(`🧹 Cleaned ${removedCount} old offline reports`);
  }

  // Función para sincronización por lotes
  async syncOperationsBatch(
    syncFn: (operation: OfflineOperation) => Promise<void>,
    onProgress?: (current: number, total: number) => void
  ): Promise<{ success: number; failed: number }> {
    if (this.syncInProgress) {
      console.log('⏳ Sync already in progress, skipping');
      return { success: 0, failed: 0 };
    }

    this.syncInProgress = true;
    const pendingOps = this.getPendingOperations();
    let successCount = 0;
    let failedCount = 0;

    console.log(`🔄 Starting batch sync of ${pendingOps.length} operations`);

    try {
      // Procesar en lotes pequeños
      for (let i = 0; i < pendingOps.length; i += SYNC_BATCH_SIZE) {
        const batch = pendingOps.slice(i, i + SYNC_BATCH_SIZE);
        
        const batchResults = await Promise.allSettled(
          batch.map(async (operation) => {
            try {
              await syncFn(operation);
              this.removeOperation(operation.id);
              return { success: true };
            } catch (error) {
              console.error(`❌ Failed to sync operation ${operation.id}:`, error);
              this.incrementRetryCount(operation.id);
              return { success: false };
            }
          })
        );

        // Contar resultados
        batchResults.forEach(result => {
          if (result.status === 'fulfilled' && result.value.success) {
            successCount++;
          } else {
            failedCount++;
          }
        });

        // Reportar progreso
        if (onProgress) {
          onProgress(i + batch.length, pendingOps.length);
        }

        // Pausa breve entre lotes
        if (i + SYNC_BATCH_SIZE < pendingOps.length) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }
    } finally {
      this.syncInProgress = false;
    }

    console.log(`✅ Batch sync completed: ${successCount} success, ${failedCount} failed`);
    return { success: successCount, failed: failedCount };
  }

  // Estadísticas para debugging
  getStats(): {
    totalOperations: number;
    pendingOperations: number;
    failedOperations: number;
    offlineReports: number;
  } {
    const pendingOps = this.getPendingOperations();
    const failedOps = this.operations.filter(op => op.retryCount >= MAX_RETRY_COUNT);
    
    const reportKeys = Object.keys(localStorage).filter(key => 
      key.startsWith(REPORTS_OFFLINE_KEY)
    );

    return {
      totalOperations: this.operations.length,
      pendingOperations: pendingOps.length,
      failedOperations: failedOps.length,
      offlineReports: reportKeys.length
    };
  }
}

export const offlineStorage = new OfflineStorageManager();