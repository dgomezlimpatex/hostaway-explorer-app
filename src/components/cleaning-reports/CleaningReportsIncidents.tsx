import React from 'react';
import { IncidentsAdminInbox } from '@/components/incidents/admin/IncidentsAdminInbox';

interface CleaningReportsIncidentsProps {
  filters?: {
    dateRange?: string;
    cleaner?: string;
    status?: string;
    property?: string;
    hasIncidents?: string;
  };
}

// Vista de administración del nuevo módulo de incidencias.
// Reemplaza la antigua bandeja basada en `task_reports.issues_found`.
export const CleaningReportsIncidents: React.FC<CleaningReportsIncidentsProps> = () => {
  return <IncidentsAdminInbox />;
};
