import { supabase } from '@/integrations/supabase/client';
import { TaskReport } from '@/types/taskReports';

export interface IncidentUpdate {
  status: 'open' | 'in_progress' | 'resolved';
  resolutionNotes?: string;
  assignedTo?: string;
  resolvedAt?: string;
  resolvedBy?: string;
}

export class IncidentManagementService {
  async updateIncident(
    reportId: string, 
    incidentIndex: number, 
    updates: IncidentUpdate
  ): Promise<void> {
    // Obtener el reporte actual
    const { data: report, error: fetchError } = await supabase
      .from('task_reports')
      .select('issues_found')
      .eq('id', reportId)
      .single();

    if (fetchError) {
      throw new Error(`Error fetching report: ${fetchError.message}`);
    }

    // Actualizar la incidencia específica
    const issues = Array.isArray(report.issues_found) ? [...report.issues_found] : [];
    
    if (issues[incidentIndex] && typeof issues[incidentIndex] === 'object') {
      const currentIssue = issues[incidentIndex] as any;
      issues[incidentIndex] = {
        ...currentIssue,
        ...updates,
        updatedAt: new Date().toISOString(),
      };

      // Si se marca como resuelto, agregar timestamp
      if (updates.status === 'resolved') {
        (issues[incidentIndex] as any).resolvedAt = new Date().toISOString();
        (issues[incidentIndex] as any).resolvedBy = updates.resolvedBy || 'current_user';
      }
    }

    // Guardar los cambios
    const { error: updateError } = await supabase
      .from('task_reports')
      .update({ 
        issues_found: issues,
        updated_at: new Date().toISOString()
      })
      .eq('id', reportId);

    if (updateError) {
      throw new Error(`Error updating incident: ${updateError.message}`);
    }
  }

  async assignIncident(
    reportId: string,
    incidentIndex: number,
    assignedTo: string
  ): Promise<void> {
    await this.updateIncident(reportId, incidentIndex, {
      status: 'in_progress',
      assignedTo,
    });
  }

  async resolveIncident(
    reportId: string,
    incidentIndex: number,
    resolutionNotes: string,
    resolvedBy: string
  ): Promise<void> {
    await this.updateIncident(reportId, incidentIndex, {
      status: 'resolved',
      resolutionNotes,
      resolvedBy,
      resolvedAt: new Date().toISOString(),
    });
  }

  async getIncidentHistory(reportId: string): Promise<any[]> {
    const { data, error } = await supabase
      .from('task_reports')
      .select('issues_found, updated_at, created_at')
      .eq('id', reportId)
      .order('updated_at', { ascending: false });

    if (error) {
      throw new Error(`Error fetching incident history: ${error.message}`);
    }

    return data || [];
  }
}

export const incidentManagementService = new IncidentManagementService();