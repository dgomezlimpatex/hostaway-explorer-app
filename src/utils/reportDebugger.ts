/**
 * Utilidad de debugging específica para reportes de tareas móviles
 * Ayuda a diagnosticar problemas con incidencias y media uploads
 */

interface ReportDebugData {
  timestamp: string;
  action: string;
  data: any;
  userId?: string;
  reportId?: string;
  taskId?: string;
}

class ReportDebugger {
  private static instance: ReportDebugger;
  private debugLogs: ReportDebugData[] = [];
  private maxLogs = 500; // Mantener últimos 500 logs

  static getInstance(): ReportDebugger {
    if (!ReportDebugger.instance) {
      ReportDebugger.instance = new ReportDebugger();
    }
    return ReportDebugger.instance;
  }

  /**
   * Log específico para incidencias
   */
  logIncident(action: string, data: any, reportId?: string, taskId?: string): void {
    this.addLog({
      timestamp: new Date().toISOString(),
      action: `INCIDENT_${action}`,
      data: {
        ...data,
        // Información adicional para debug
        incidentsCount: Array.isArray(data.issues) ? data.issues.length : 'N/A',
        incidentIds: Array.isArray(data.issues) ? data.issues.map((i: any) => i.id) : [],
      },
      reportId,
      taskId
    });
  }

  /**
   * Log específico para media uploads
   */
  logMedia(action: string, data: any, reportId?: string): void {
    this.addLog({
      timestamp: new Date().toISOString(),
      action: `MEDIA_${action}`,
      data: {
        ...data,
        mediaUrl: data.file_url || data.mediaUrl,
        fileSize: data.file_size || data.size,
        mediaType: data.media_type || data.type
      },
      reportId
    });
  }

  /**
   * Log para guardado de reportes
   */
  logReportSave(action: string, data: any, reportId?: string, taskId?: string): void {
    this.addLog({
      timestamp: new Date().toISOString(),
      action: `REPORT_SAVE_${action}`,
      data: {
        ...data,
        issuesCount: data.issues_found ? data.issues_found.length : 0,
        checklistCompleted: data.checklist_completed ? Object.keys(data.checklist_completed).length : 0,
        overallStatus: data.overall_status,
        hasEndTime: !!data.end_time,
        hasStartTime: !!data.start_time
      },
      reportId,
      taskId,
      userId: data.cleaner_id
    });
  }

  /**
   * Log para problemas específicos
   */
  logError(error: string, context: any, reportId?: string, taskId?: string): void {
    this.addLog({
      timestamp: new Date().toISOString(),
      action: 'ERROR',
      data: {
        error,
        context,
        stackTrace: new Error().stack
      },
      reportId,
      taskId
    });
  }

  private addLog(log: ReportDebugData): void {
    this.debugLogs.push(log);
    
    // Mantener solo los últimos logs
    if (this.debugLogs.length > this.maxLogs) {
      this.debugLogs = this.debugLogs.slice(-this.maxLogs);
    }

    // Log en consola con formato mejorado
    const prefix = this.getLogPrefix(log.action);
    console.log(`${prefix} [${log.timestamp}] ${log.action}:`, log.data);
  }

  private getLogPrefix(action: string): string {
    if (action.includes('ERROR')) return '🚨';
    if (action.includes('INCIDENT')) return '⚠️';
    if (action.includes('MEDIA')) return '📷';
    if (action.includes('REPORT')) return '📋';
    return '🔍';
  }

  /**
   * Obtener logs filtrados
   */
  getLogs(filter?: {
    action?: string;
    reportId?: string;
    taskId?: string;
    since?: Date;
  }): ReportDebugData[] {
    let logs = [...this.debugLogs];

    if (filter) {
      if (filter.action) {
        logs = logs.filter(log => log.action.includes(filter.action!));
      }
      if (filter.reportId) {
        logs = logs.filter(log => log.reportId === filter.reportId);
      }
      if (filter.taskId) {
        logs = logs.filter(log => log.taskId === filter.taskId);
      }
      if (filter.since) {
        logs = logs.filter(log => new Date(log.timestamp) >= filter.since!);
      }
    }

    return logs.reverse(); // Más recientes primero
  }

  /**
   * Exportar logs para debugging
   */
  exportLogs(): string {
    return JSON.stringify(this.debugLogs, null, 2);
  }

  /**
   * Limpiar logs
   */
  clearLogs(): void {
    this.debugLogs = [];
    console.log('🧹 ReportDebugger: Logs cleared');
  }

  /**
   * Generar reporte de debugging para un reporte específico
   */
  generateReportSummary(reportId: string): {
    incidents: ReportDebugData[];
    media: ReportDebugData[];
    saves: ReportDebugData[];
    errors: ReportDebugData[];
  } {
    const reportLogs = this.getLogs({ reportId });
    
    return {
      incidents: reportLogs.filter(log => log.action.includes('INCIDENT')),
      media: reportLogs.filter(log => log.action.includes('MEDIA')),
      saves: reportLogs.filter(log => log.action.includes('REPORT_SAVE')),
      errors: reportLogs.filter(log => log.action.includes('ERROR'))
    };
  }
}

// Hook para usar en componentes React
export const useReportDebugger = () => {
  const reportDebuggerInstance = ReportDebugger.getInstance();
  
  return {
    logIncident: (action: string, data: any, reportId?: string, taskId?: string) => 
      reportDebuggerInstance.logIncident(action, data, reportId, taskId),
    logMedia: (action: string, data: any, reportId?: string) => 
      reportDebuggerInstance.logMedia(action, data, reportId),
    logReportSave: (action: string, data: any, reportId?: string, taskId?: string) => 
      reportDebuggerInstance.logReportSave(action, data, reportId, taskId),
    logError: (error: string, context: any, reportId?: string, taskId?: string) => 
      reportDebuggerInstance.logError(error, context, reportId, taskId),
    getLogs: (filter?: any) => reportDebuggerInstance.getLogs(filter),
    exportLogs: () => reportDebuggerInstance.exportLogs(),
    clearLogs: () => reportDebuggerInstance.clearLogs(),
    generateReportSummary: (reportId: string) => reportDebuggerInstance.generateReportSummary(reportId)
  };
};

export const reportDebugger = ReportDebugger.getInstance();

// Función global para acceso desde consola de desarrollador
(window as any).reportDebugger = {
  getLogs: () => reportDebugger.getLogs(),
  exportLogs: () => reportDebugger.exportLogs(),
  clearLogs: () => reportDebugger.clearLogs(),
  generateSummary: (reportId: string) => reportDebugger.generateReportSummary(reportId)
};