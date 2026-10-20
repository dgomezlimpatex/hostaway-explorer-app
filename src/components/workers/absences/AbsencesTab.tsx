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
import { AbsenceType } from '@/types/workerAbsence';
import { SENSITIVE_ABSENCE_TYPES } from '@/lib/roleCapabilities';
import { countUpcomingAbsences, madridTodayKey } from './availabilityStatus';

interface AbsencesTabProps {
  cleanerId: string;
  cleanerName: string;
  /** Crear, editar y eliminar (por defecto, sí; el planificador lo usa así). */
  canEdit?: boolean;
  /** Tipo médico/personal, notas e historial (por defecto, sí). */
  showSensitive?: boolean;
}

const ALL_ABSENCE_TYPES: AbsenceType[] = ['vacation', 'sick', 'day_off', 'holiday', 'personal', 'external_work'];

export const AbsencesTab: React.FC<AbsencesTabProps> = ({ cleanerId, cleanerName, canEdit = true, showSensitive = true }) => {
  const [showCreateAbsenceModal, setShowCreateAbsenceModal] = useState(false);
  const [showCreateAvailabilityModal, setShowCreateAvailabilityModal] = useState(false);
  const [showCreateMaintenanceModal, setShowCreateMaintenanceModal] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedEndDate, setSelectedEndDate] = useState<Date | null>(null);
  
  const absencesQuery = useWorkerAbsences(cleanerId);
  const fixedDaysQuery = useWorkerFixedDaysOff(cleanerId);
  const maintenanceQuery = useWorkerMaintenanceCleanings(cleanerId);
  const { data: absences = [], isLoading: loadingAbsences } = absencesQuery;
  const { data: fixedDaysOff = [], isLoading: loadingFixedDays } = fixedDaysQuery;
  const { data: maintenanceCleanings = [], isLoading: loadingMaintenance } = maintenanceQuery;
  const failed = [
    absencesQuery.error && 'ausencias',
    fixedDaysQuery.error && 'días libres',
    maintenanceQuery.error && 'franjas y mantenimientos',
  ].filter(Boolean) as string[];
  const retry = () => {
    if (absencesQuery.error) absencesQuery.refetch();
    if (fixedDaysQuery.error) fixedDaysQuery.refetch();
    if (maintenanceQuery.error) maintenanceQuery.refetch();
  };
  // «Hoy» en Madrid: entre las 00:00 y la 01:00/02:00 la fecha UTC aún es la de ayer.
  const upcomingCount = countUpcomingAbsences(absences, madridTodayKey());
  const allowedTypes = showSensitive
    ? ALL_ABSENCE_TYPES
    : ALL_ABSENCE_TYPES.filter((type) => !(SENSITIVE_ABSENCE_TYPES as readonly string[]).includes(type));
  const canEditType = (type: AbsenceType) => canEdit && allowedTypes.includes(type);
  const activeFixedDays = fixedDaysOff.filter((day) => day.isActive);
  const activeMaintenance = maintenanceCleanings.filter((cleaning) => cleaning.isActive && cleaning.scheduleType !== 'unavailability');

  const handleDateClick = (date: Date) => {
    if (!canEdit) return;
    setSelectedDate(date);
    setSelectedEndDate(date);
    setShowCreateAbsenceModal(true);
  };

  const handleDateRangeSelect = (startDate: Date, endDate: Date) => {
    if (!canEdit) return;
    setSelectedDate(startDate);
    setSelectedEndDate(endDate);
    setShowCreateAbsenceModal(true);
  };

  const isLoading = loadingAbsences || loadingFixedDays || loadingMaintenance;

  return (
    <div className="space-y-6">
      {/* Header with action buttons */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-lg font-black text-slate-950">Disponibilidad y ausencias</h3>
          <p className="text-sm text-slate-500">Ausencias, días libres fijos, franjas no disponibles y limpiezas de mantenimiento de {cleanerName}.</p>
        </div>
        {canEdit && (
        <div className="grid grid-cols-2 gap-2 sm:flex">
          <Button variant="outline" size="sm" className="rounded-xl" onClick={() => setShowCreateAvailabilityModal(true)}><Clock className="h-4 w-4 mr-1" />Franja no disponible</Button>
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => {
              setSelectedDate(null);
              setSelectedEndDate(null);
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
        )}
      </div>

      {failed.length > 0 ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-900" role="alert">
          No se pudieron consultar: {failed.join(', ')}. Los datos de esta pestaña pueden estar incompletos.{' '}
          <button type="button" className="font-semibold underline underline-offset-2" onClick={retry}>
            Reintentar
          </button>
        </div>
      ) : isLoading ? (
        <p className="text-sm text-slate-500" role="status">Cargando disponibilidad…</p>
      ) : (
      <div className="grid gap-2 sm:grid-cols-3">
        <AbsenceSummaryCard
          label="Ausencias próximas"
          value={upcomingCount}
          helper={upcomingCount ? 'Revisar cobertura' : 'Sin ausencias próximas'}
          tone={upcomingCount ? 'warning' : 'ok'}
        />
        <AbsenceSummaryCard
          label="Días libres fijos"
          value={activeFixedDays.length}
          helper="Patrón semanal"
          tone="neutral"
        />
        <AbsenceSummaryCard
          label="Mantenimientos"
          value={activeMaintenance.length}
          helper="Limpiezas fijas que suman horas"
          tone="neutral"
        />
      </div>
      )}

      <Tabs defaultValue="calendar" className="w-full">
        <TabsList className={showSensitive ? 'grid h-auto w-full grid-cols-2 rounded-2xl bg-slate-100 p-1 sm:grid-cols-4' : 'grid h-auto w-full grid-cols-3 rounded-2xl bg-slate-100 p-1'}>
          <TabsTrigger value="calendar" className="flex items-center gap-1 rounded-xl py-2.5">
            <Calendar className="h-4 w-4" />
            Calendario
          </TabsTrigger>
          <TabsTrigger value="fixed" className="flex items-center gap-1 rounded-xl py-2.5">
            <Clock className="h-4 w-4" />
            Días y franjas
          </TabsTrigger>
          <TabsTrigger value="list" className="flex items-center gap-1 rounded-xl py-2.5">
            <Building2 className="h-4 w-4" />
            Lista
          </TabsTrigger>
          {showSensitive && (
          <TabsTrigger value="history" className="flex items-center gap-1 rounded-xl py-2.5">
            <History className="h-4 w-4" />
            Historial
          </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="calendar" className="mt-4">
          <AbsenceCalendarView 
            cleanerId={cleanerId}
            absences={absences}
            fixedDaysOff={fixedDaysOff}
            maintenanceCleanings={maintenanceCleanings}
            onDateClick={handleDateClick}
            onDateRangeSelect={canEdit ? handleDateRangeSelect : undefined}
            isLoading={isLoading}
            readOnly={!canEdit}
            showSensitive={showSensitive}
          />
        </TabsContent>

        <TabsContent value="fixed" className="mt-4 space-y-4">
          <FixedDaysOffSection 
            cleanerId={cleanerId}
            fixedDaysOff={fixedDaysOff}
            readOnly={!canEdit}
          />
          <MaintenanceCleaningsSection availability readOnly={!canEdit} cleanerId={cleanerId} cleanerName={cleanerName}
            maintenanceCleanings={maintenanceCleanings.filter(item => item.scheduleType === 'unavailability')}
            onAddNew={() => setShowCreateAvailabilityModal(true)} />
          <MaintenanceCleaningsSection 
            cleanerId={cleanerId}
            cleanerName={cleanerName}
            maintenanceCleanings={maintenanceCleanings.filter(item => item.scheduleType !== 'unavailability')}
            onAddNew={() => setShowCreateMaintenanceModal(true)}
            readOnly={!canEdit}
          />
        </TabsContent>

        <TabsContent value="list" className="mt-4">
          <AbsencesList 
            cleanerId={cleanerId}
            absences={absences}
            isLoading={loadingAbsences}
            canEditType={canEditType}
            showSensitive={showSensitive}
          />
        </TabsContent>

        {showSensitive && (
        <TabsContent value="history" className="mt-4">
          <AbsenceAuditLog cleanerId={cleanerId} />
        </TabsContent>
        )}
      </Tabs>

      {canEdit && (<>
      <CreateMaintenanceModal scheduleType="unavailability" open={showCreateAvailabilityModal} onOpenChange={setShowCreateAvailabilityModal} cleanerId={cleanerId} cleanerName={cleanerName} />
      {/* Modals */}
      <CreateAbsenceModal 
        open={showCreateAbsenceModal}
        onOpenChange={setShowCreateAbsenceModal}
        cleanerId={cleanerId}
        cleanerName={cleanerName}
        initialDate={selectedDate}
        initialEndDate={selectedEndDate}
        allowedTypes={allowedTypes}
      />
      
      <CreateMaintenanceModal 
        open={showCreateMaintenanceModal}
        onOpenChange={setShowCreateMaintenanceModal}
        cleanerId={cleanerId}
        cleanerName={cleanerName}
      />
      </>)}
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
