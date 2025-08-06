import { TaskReport, CreateTaskReportData } from '@/types/taskReports';

interface OfflineOperation {
  id: string;
  type: 'create' | 'update' | 'uploadMedia';
  data: any;
  timestamp: number;
  retryCount: number;
}

const OFFLINE_KEY = 'task_reports_offline';
const MAX_RETRY_COUNT = 3;

class OfflineStorageManager {
  private operations: OfflineOperation[] = [];

  constructor() {
    this.loadOperations();
  }

  private loadOperations(): void {
    try {
      const stored = localStorage.getItem(OFFLINE_KEY);
      this.operations = stored ? JSON.parse(stored) : [];
    } catch (error) {
      console.error('Error loading offline operations:', error);
      this.operations = [];
    }
  }

  private saveOperations(): void {
    try {
      localStorage.setItem(OFFLINE_KEY, JSON.stringify(this.operations));
    } catch (error) {
      console.error('Error saving offline operations:', error);
    }
  }

  addOperation(type: OfflineOperation['type'], data: any): string {
    const operation: OfflineOperation = {
      id: `${type}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type,
      data,
      timestamp: Date.now(),
      retryCount: 0
    };

    this.operations.push(operation);
    this.saveOperations();
    return operation.id;
  }

  removeOperation(id: string): void {
    this.operations = this.operations.filter(op => op.id !== id);
    this.saveOperations();
  }

  getPendingOperations(): OfflineOperation[] {
    return this.operations.filter(op => op.retryCount < MAX_RETRY_COUNT);
  }

  incrementRetryCount(id: string): void {
    const operation = this.operations.find(op => op.id === id);
    if (operation) {
      operation.retryCount++;
      this.saveOperations();
    }
  }

  clearOperations(): void {
    this.operations = [];
    this.saveOperations();
  }

  // Guardar reporte temporalmente offline
  saveReportOffline(reportId: string, data: Partial<TaskReport>): void {
    const key = `offline_report_${reportId}`;
    try {
      localStorage.setItem(key, JSON.stringify({
        ...data,
        offline: true,
        lastModified: Date.now()
      }));
    } catch (error) {
      console.error('Error saving report offline:', error);
    }
  }

  // Obtener reporte offline
  getReportOffline(reportId: string): Partial<TaskReport> | null {
    const key = `offline_report_${reportId}`;
    try {
      const stored = localStorage.getItem(key);
      return stored ? JSON.parse(stored) : null;
    } catch (error) {
      console.error('Error getting offline report:', error);
      return null;
    }
  }

  // Limpiar reporte offline cuando se sincroniza
  removeReportOffline(reportId: string): void {
    const key = `offline_report_${reportId}`;
    localStorage.removeItem(key);
  }
}

export const offlineStorage = new OfflineStorageManager();