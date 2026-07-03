import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Plus, Calendar, Clock, Building2, History, CalendarOff } from 'lucide-react';
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
  const today = new Date().toISOString().slice(0, 10);
  const activeOrUpcomingAbsences = absences.filter((absence) => absence.endDate >= today);
  const activeFixedDays = fixedDaysOff.filter((day) => day.isActive);
  const activeMaintenance = maintenanceCleanings.filter((cleaning) => cleaning.isActive);

  const handleDateClick = (date: Date) => {
    setSelectedDate(date);
    setShowCreateAbsenceModal(true);
  };

  const isLoading = loadingAbsences || loadingFixedDays || loadingMaintenance;

  return (
    <div className="space-y-6">
      {/* Header with action buttons */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-lg font-black text-slate-950">Ausencias</h3>
          <p className="text-sm text-slate-500">Bajas, días libres y limpiezas de mantenimiento de {cleanerName}.</p>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:flex">
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => {
              setSelectedDate(null);
              setShowCreateAbsenceModal(true);
            }}
            className="rounded-xl"
          >
            <Plus className="h-4 w-4 mr-1" />
            Nueva ausencia
          </Button>
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => setShowCreateMaintenanceModal(true)}
            className="rounded-xl"
          >
            <Building2 className="h-4 w-4 mr-1" />
            Mantenimiento
          </Button>
        </div>
      </div>

      <div className="grid gap-2 sm:grid-cols-3">
        <AbsenceSummaryCard
          label="Ausencias próximas"
          value={activeOrUpcomingAbsences.length}
          helper={activeOrUpcomingAbsences.length ? 'Revisar cobertura' : 'Sin avisos'}
          tone={activeOrUpcomingAbsences.length ? 'warning' : 'ok'}
        />
        <AbsenceSummaryCard
          label="Días fijos libres"
          value={activeFixedDays.length}
          helper="Patrón semanal"
          tone="neutral"
        />
        <AbsenceSummaryCard
          label="Mantenimientos"
          value={activeMaintenance.length}
          helper="Bloqueos operativos"
          tone="neutral"
        />
      </div>

      <Tabs defaultValue="calendar" className="w-full">
        <TabsList className="grid h-auto w-full grid-cols-2 rounded-2xl bg-slate-100 p-1 sm:grid-cols-4">
          <TabsTrigger value="calendar" className="flex items-center gap-1 rounded-xl py-2.5">
            <Calendar className="h-4 w-4" />
            Calendario
          </TabsTrigger>
          <TabsTrigger value="fixed" className="flex items-center gap-1 rounded-xl py-2.5">
            <Clock className="h-4 w-4" />
            Días fijos
          </TabsTrigger>
          <TabsTrigger value="list" className="flex items-center gap-1 rounded-xl py-2.5">
            <Building2 className="h-4 w-4" />
            Lista
          </TabsTrigger>
          <TabsTrigger value="history" className="flex items-center gap-1 rounded-xl py-2.5">
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

const AbsenceSummaryCard = ({
  label,
  value,
  helper,
  tone,
}: {
  label: string;
  value: number;
  helper: string;
  tone: 'ok' | 'warning' | 'neutral';
}) => {
  const toneClasses = {
    ok: 'border-emerald-200 bg-emerald-50 text-emerald-900',
    warning: 'border-amber-200 bg-amber-50 text-amber-950',
    neutral: 'border-slate-200 bg-white text-slate-950',
  }[tone];

  return (
    <div className={`rounded-2xl border p-4 ${toneClasses}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.14em] opacity-70">{label}</p>
          <p className="mt-1 text-3xl font-black">{value}</p>
        </div>
        <CalendarOff className="h-5 w-5 opacity-70" />
      </div>
      <Badge variant="outline" className="mt-3 bg-white/70">
        {helper}
      </Badge>
    </div>
  );
};
