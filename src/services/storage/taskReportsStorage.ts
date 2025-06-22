
// Re-export specific services from the refactored files for direct access
export { checklistTemplatesStorageService } from './checklistTemplatesStorage';
export { taskReportsStorageService as taskReportsStorageCore } from './taskReportsStorageCore';
export { taskMediaStorageService } from './taskMediaStorage';

// Legacy class that combines all services for backward compatibility
import { ChecklistTemplatesStorageService } from './checklistTemplatesStorage';
import { TaskReportsStorageService } from './taskReportsStorageCore';
import { TaskMediaStorageService } from './taskMediaStorage';

export class TaskReportsStorageServiceLegacy extends ChecklistTemplatesStorageService {
  private reportsService = new TaskReportsStorageService();
  private mediaService = new TaskMediaStorageService();

  // Delegate task reports methods
  async getTaskReports() {
    return this.reportsService.getTaskReports();
  }

  async getTaskReportByTaskId(taskId: string) {
    return this.reportsService.getTaskReportByTaskId(taskId);
  }

  async createTaskReport(reportData: any) {
    return this.reportsService.createTaskReport(reportData);
  }

  async updateTaskReport(reportId: string, updates: any) {
    return this.reportsService.updateTaskReport(reportId, updates);
  }

  // Delegate media methods
  async getTaskMedia(reportId: string) {
    return this.mediaService.getTaskMedia(reportId);
  }

  async uploadMedia(file: File, reportId: string, checklistItemId?: string) {
    return this.mediaService.uploadMedia(file, reportId, checklistItemId);
  }

  async deleteMedia(mediaId: string) {
    return this.mediaService.deleteMedia(mediaId);
  }
}

// Export the legacy service for backward compatibility with a different name to avoid conflicts
export const taskReportsStorageService = new TaskReportsStorageServiceLegacy();
