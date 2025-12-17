import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Plus, Calendar, Clock, Building2, History } from 'lucide-react';
import { useWorkerAbsences } from '@/hooks/useWorkerAbsences';
import { useWorkerFixedDaysOff } from '@/hooks/useWorkerFixedDaysOff';
import { useWorkerMaintenanceCleanings } from '@/hooks/useWorkerMaintenanceCleanings';
import { FixedDaysOffSection } from './FixedDaysOffSection';
import { MaintenanceCleaningsSection } from './MaintenanceCleaningsSection';
import { AbsencesList } from './AbsencesList';
import { AbsenceCalendarView } from './AbsenceCalendarView';
import { CreateAbsenceModal } from './CreateAbsenceModal';
import { CreateMaintenanceModal } from './CreateMaintenanceModal';
import { AbsenceAuditLog } from './AbsenceAuditLog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface AbsencesTabProps {
  cleanerId: string;
  cleanerName: string;
}

export const AbsencesTab: React.FC<AbsencesTabProps> = ({ cleanerId, cleanerName }) => {
  const [showCreateAbsenceModal, setShowCreateAbsenceModal] = useState(false);
  const [showCreateMaintenanceModal, setShowCreateMaintenanceModal] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  
  const { data: absences = [], isLoading: loadingAbsences } = useWorkerAbsences(cleanerId);
  const { data: fixedDaysOff = [], isLoading: loadingFixedDays } = useWorkerFixedDaysOff(cleanerId);
  const { data: maintenanceCleanings = [], isLoading: loadingMaintenance } = useWorkerMaintenanceCleanings(cleanerId);

  const handleDateClick = (date: Date) => {
    setSelectedDate(date);
    setShowCreateAbsenceModal(true);
  };

  const isLoading = loadingAbsences || loadingFixedDays || loadingMaintenance;

  return (
    <div className="space-y-6">
      {/* Header with action buttons */}
      <div className="flex flex-wrap gap-2 justify-between items-center">
        <h3 className="text-lg font-semibold">Gestión de Ausencias</h3>
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => setShowCreateAbsenceModal(true)}
          >
            <Plus className="h-4 w-4 mr-1" />
            Nueva Ausencia
          </Button>
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => setShowCreateMaintenanceModal(true)}
          >
            <Building2 className="h-4 w-4 mr-1" />
            Limpieza Mantenimiento
          </Button>
        </div>
      </div>

      <Tabs defaultValue="calendar" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="calendar" className="flex items-center gap-1">
            <Calendar className="h-4 w-4" />
            Calendario
          </TabsTrigger>
          <TabsTrigger value="fixed" className="flex items-center gap-1">
            <Clock className="h-4 w-4" />
            Días Fijos
          </TabsTrigger>
          <TabsTrigger value="list" className="flex items-center gap-1">
            <Building2 className="h-4 w-4" />
            Lista
          </TabsTrigger>
          <TabsTrigger value="history" className="flex items-center gap-1">
            <History className="h-4 w-4" />
            Historial
          </TabsTrigger>
        </TabsList>

        <TabsContent value="calendar" className="mt-4">
          <AbsenceCalendarView 
            cleanerId={cleanerId}
            absences={absences}
            fixedDaysOff={fixedDaysOff}
            maintenanceCleanings={maintenanceCleanings}
            onDateClick={handleDateClick}
            isLoading={isLoading}
          />
        </TabsContent>

        <TabsContent value="fixed" className="mt-4 space-y-4">
          <FixedDaysOffSection 
            cleanerId={cleanerId}
            fixedDaysOff={fixedDaysOff}
          />
          <MaintenanceCleaningsSection 
            cleanerId={cleanerId}
            cleanerName={cleanerName}
            maintenanceCleanings={maintenanceCleanings}
            onAddNew={() => setShowCreateMaintenanceModal(true)}
          />
        </TabsContent>

        <TabsContent value="list" className="mt-4">
          <AbsencesList 
            cleanerId={cleanerId}
            absences={absences}
            isLoading={loadingAbsences}
          />
        </TabsContent>

        <TabsContent value="history" className="mt-4">
          <AbsenceAuditLog cleanerId={cleanerId} />
        </TabsContent>
      </Tabs>

      {/* Modals */}
      <CreateAbsenceModal 
        open={showCreateAbsenceModal}
        onOpenChange={setShowCreateAbsenceModal}
        cleanerId={cleanerId}
        cleanerName={cleanerName}
        initialDate={selectedDate}
      />
      
      <CreateMaintenanceModal 
        open={showCreateMaintenanceModal}
        onOpenChange={setShowCreateMaintenanceModal}
        cleanerId={cleanerId}
        cleanerName={cleanerName}
      />
    </div>
  );
};
