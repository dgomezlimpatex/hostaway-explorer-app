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

// Vista de administración del módulo profesional de incidencias.
export const CleaningReportsIncidents: React.FC<CleaningReportsIncidentsProps> = () => {
  return <IncidentsAdminInbox />;
};
