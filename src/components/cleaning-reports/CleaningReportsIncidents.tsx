import React, { useMemo, useState } from 'react';
import { useTaskReports } from '@/hooks/useTaskReports';
import { useIncidentManagement } from '@/hooks/useIncidentManagement';
import { useCleaners } from '@/hooks/useCleaners';
import { useTaskMedia } from '@/hooks/useTaskMedia';
import {
  IncidentStatsCards,
  IncidentsList,
  IncidentModal,
  IncidentLoadingSkeleton,
} from './incident-components';

interface CleaningReportsIncidentsProps {
  filters: {
    dateRange: string;
    cleaner: string;
    status: string;
    property: string;
    hasIncidents: string;
  };
}

export const CleaningReportsIncidents: React.FC<CleaningReportsIncidentsProps> = ({
  filters,
}) => {
  const { reports, isLoading } = useTaskReports();
  const { cleaners } = useCleaners();
  const { updateIncident, isUpdating } = useIncidentManagement();
  const [selectedIncident, setSelectedIncident] = useState<any>(null);
  const [showIncidentModal, setShowIncidentModal] = useState(false);
  const [incidentStatus, setIncidentStatus] = useState('');
  const [resolutionNotes, setResolutionNotes] = useState('');
  const [assignedTo, setAssignedTo] = useState('');

  // Obtener imágenes del reporte seleccionado
  const { data: reportMedia = [] } = useTaskMedia(selectedIncident?.reportId);

  // Procesar incidencias de los reportes
  const incidents = useMemo(() => {
    if (!reports) return [];
    
    const allIncidents: any[] = [];
    
    reports.forEach(report => {
      if (report.issues_found && Array.isArray(report.issues_found)) {
        report.issues_found.forEach((issue: any, index: number) => {
          allIncidents.push({
            id: `${report.id}-${index}`,
            reportId: report.id,
            taskId: report.task_id,
            cleanerId: report.cleaner_id,
            incidentIndex: index,
            title: issue.title || 'Incidencia sin título',
            description: issue.description || '',
            severity: issue.severity || 'medium',
            category: issue.category || 'general',
            status: issue.status || 'open',
            createdAt: report.created_at,
            location: issue.location || '',
            resolutionNotes: issue.resolutionNotes || '',
            resolvedAt: issue.resolvedAt || null,
            resolvedBy: issue.resolvedBy || null,
            assignedTo: issue.assignedTo || '',
            updatedAt: issue.updatedAt || report.created_at,
          });
        });
      }
    });
    
    return allIncidents.sort((a, b) => 
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }, [reports]);

  // Estadísticas de incidencias
  const incidentStats = useMemo(() => {
    const total = incidents.length;
    const open = incidents.filter(i => i.status === 'open').length;
    const inProgress = incidents.filter(i => i.status === 'in_progress').length;
    const resolved = incidents.filter(i => i.status === 'resolved').length;
    const critical = incidents.filter(i => i.severity === 'high').length;
    
    return { total, open, inProgress, resolved, critical };
  }, [incidents]);

  const handleIncidentClick = (incident: any) => {
    setSelectedIncident(incident);
    setIncidentStatus(incident.status);
    setResolutionNotes(incident.resolutionNotes || '');
    setAssignedTo(incident.assignedTo || 'unassigned');
    setShowIncidentModal(true);
  };

  const handleUpdateIncident = () => {
    if (!selectedIncident) return;

    updateIncident({
      reportId: selectedIncident.reportId,
      incidentIndex: selectedIncident.incidentIndex,
      updates: {
        status: incidentStatus as 'open' | 'in_progress' | 'resolved',
        resolutionNotes,
        assignedTo,
        resolvedBy: incidentStatus === 'resolved' ? 'current_user' : undefined,
      }
    });
    
    setShowIncidentModal(false);
  };

  if (isLoading) {
    return <IncidentLoadingSkeleton />;
  }

  return (
    <div className="space-y-6">
      <IncidentStatsCards incidentStats={incidentStats} />
      
      <IncidentsList
        incidents={incidents}
        cleaners={cleaners}
        onIncidentClick={handleIncidentClick}
      />

      <IncidentModal
        showIncidentModal={showIncidentModal}
        setShowIncidentModal={setShowIncidentModal}
        selectedIncident={selectedIncident}
        incidentStatus={incidentStatus}
        setIncidentStatus={setIncidentStatus}
        resolutionNotes={resolutionNotes}
        setResolutionNotes={setResolutionNotes}
        assignedTo={assignedTo}
        setAssignedTo={setAssignedTo}
        cleaners={cleaners}
        reportMedia={reportMedia}
        handleUpdateIncident={handleUpdateIncident}
        isUpdating={isUpdating}
      />
    </div>
  );
};