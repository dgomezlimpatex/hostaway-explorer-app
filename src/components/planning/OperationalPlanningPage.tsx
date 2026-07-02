import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, ArrowRight, Building2, CalendarDays, CheckCircle2, Clock3, Loader2, Plus, ShieldAlert, Sparkles, Trash2, Users } from 'lucide-react';
import { useSede } from '@/contexts/SedeContext';
import {
  useApplyOperationalPlanningReplacement,
  useApproveOperationalPlanningRun,
  useDiscardOperationalPlanningRun,
  useGenerateOperationalPlanningRun,
  useOperationalPlanningBuildings,
  useOperationalPlanningOverview,
  useOperationalPlanningPreview,
  useOperationalPlanningRuns,
  useOperationalPlanningWorkers,
  useSaveOperationalPlanningSettings,
  useUpdateOperationalPlanningPropertyProfile,
  useUpdateOperationalPlanningWorkerProfile,
} from '@/hooks/useOperationalPlanning';
import {
  useAssignCleanerToGroup,
  useAssignPropertyToGroup,
  useCleanerAssignments,
  useCreatePropertyGroup,
  usePropertyAssignments,
  usePropertyGroups,
  useRemoveCleanerFromGroup,
  useRemovePropertyFromGroup,
  useUpdateCleanerAssignment,
  useUpdatePropertyGroup,
} from '@/hooks/usePropertyGroups';
import { useCleaners } from '@/hooks/useCleaners';
import { useProperties } from '@/hooks/useProperties';
import { useWorkerAbsences } from '@/hooks/useWorkerAbsences';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { ABSENCE_TYPE_CONFIG } from '@/types/workerAbsence';
import { formatMadridDate } from '@/utils/date';
import { CreateAbsenceModal } from '@/components/workers/absences/CreateAbsenceModal';
import { AbsencesList } from '@/components/workers/absences/AbsencesList';
import { useIsMobile } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';

const formatLongDate = (date: string) =>
  new Date(`${date}T12:00:00`).toLocaleDateString('es-ES', {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
  });

const formatHours = (minutes: number) => `${(minutes / 60).toFixed(minutes % 60 === 0 ? 0 : 1)} h`;

const statusTone = (value: number, inverse = false) => {
  if (inverse) {
    if (value === 0) return 'text-emerald-600';
    if (value <= 2) return 'text-amber-600';
    return 'text-rose-600';
  }
  if (value >= 80) return 'text-emerald-600';
  if (value >= 50) return 'text-amber-600';
  return 'text-rose-600';
};

const getReadableErrorMessage = (error: unknown) => {
  if (error instanceof Error) return error.message;
  if (error && typeof error === 'object' && 'message' in error) {
    return String((error as { message: unknown }).message);
  }
  return 'No se pudo cargar la información de planificación.';
};

const conflictCodeLabel = (code: string) => {
  switch (code) {
    case 'missing-property':
      return 'Propiedad pendiente';
    case 'missing-building':
      return 'Edificio sin configurar';
    case 'missing-duration':
      return 'Duración pendiente';
    case 'invalid-window':
      return 'Horario inválido';
    case 'outside-window':
      return 'Fuera de ventana';
    case 'missing-team':
      return 'Equipo pendiente';
    case 'no-candidate':
      return 'Sin candidata segura';
    case 'insufficient-team':
      return 'Equipo insuficiente';
    case 'overlap':
      return 'Solape';
    case 'over-capacity':
      return 'Sin capacidad';
    case 'weekly-overload':
      return 'Exceso semanal';
    case 'worker-unavailable':
      return 'Trabajadora no disponible';
    case 'worker-restriction':
      return 'Restricción operativa';
    case 'missing-zone':
      return 'Zona pendiente';
    case 'extraordinary-excluded':
      return 'Extraordinaria excluida';
    default:
      return code.replaceAll('-', ' ');
  }
};

const predictiveAlertTone = (severity: 'info' | 'warning' | 'critical') => {
  if (severity === 'critical') return 'border-rose-200 bg-rose-50 text-rose-900';
  if (severity === 'warning') return 'border-amber-200 bg-amber-50 text-amber-900';
  return 'border-sky-200 bg-sky-50 text-sky-900';
};

const absenceTypeLabel = (absenceType: string) =>
  ABSENCE_TYPE_CONFIG[absenceType as keyof typeof ABSENCE_TYPE_CONFIG]?.label || absenceType;

const getBuildingCoverageState = ({
  propertyCount,
  titularCount,
  substituteCount,
  backupCount,
}: {
  propertyCount: number;
  titularCount: number;
  substituteCount: number;
  backupCount: number;
}) => {
  if (propertyCount === 0) {
    return {
      label: 'Sin propiedades',
      tone: 'border-slate-200 bg-slate-50 text-slate-700',
    };
  }

  if (titularCount === 0) {
    return {
      label: 'Sin titulares',
      tone: 'border-rose-200 bg-rose-50 text-rose-700',
    };
  }

  if (substituteCount === 0 || backupCount === 0) {
    return {
      label: 'Cobertura parcial',
      tone: 'border-amber-200 bg-amber-50 text-amber-700',
    };
  }

  return {
    label: 'Cobertura completa',
    tone: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  };
};

const planningTabOptions = [
  { value: 'overview', label: 'Resumen' },
  { value: 'preview', label: 'Vista previa' },
  { value: 'workers', label: 'Equipo' },
  { value: 'buildings', label: 'Edificios' },
  { value: 'coverage', label: 'Cobertura' },
  { value: 'performance', label: 'Rendimiento' },
  { value: 'rules', label: 'Reglas' },
] as const;

const ProposalCard = ({
  item,
}: {
  item: NonNullable<ReturnType<typeof useOperationalPlanningPreview>['data']>['items'][number];
}) => (
  <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <div className="flex items-center gap-2">
          <h4 className="text-base font-black text-slate-900">{item.proposal.propertyCode}</h4>
          <Badge variant="outline" className="border-sky-200 bg-sky-50 text-sky-700">
            {item.proposal.startTime} - {item.proposal.endTime}
          </Badge>
        </div>
        <p className="mt-1 text-sm font-medium text-slate-600">{item.proposal.propertyName}</p>
        <p className="mt-1 text-sm text-slate-500">{item.proposal.propertyGroupName || 'Sin edificio'}</p>
      </div>
      <div className="text-right">
        <p className="text-xs font-bold uppercase tracking-[0.22em] text-slate-400">Duración</p>
        <p className="text-base font-black text-slate-900">{item.proposal.durationMinutes} min</p>
      </div>
    </div>

    <p className="mt-4 text-sm leading-6 text-slate-700">{item.explanation}</p>

    <div className="mt-4 flex flex-wrap gap-2">
      {item.proposedCleanerNames.map((name) => (
        <Badge key={name} className="bg-[#310984] text-white hover:bg-[#310984]">
          {name}
        </Badge>
      ))}
    </div>

    {item.warnings.length > 0 && (
      <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
        <p className="font-bold">Advertencias</p>
        <ul className="mt-2 space-y-1">
          {item.warnings.map((warning) => (
            <li key={warning}>• {warning}</li>
          ))}
        </ul>
      </div>
    )}
  </div>
);

export const OperationalPlanningPage = () => {
  const isMobile = useIsMobile();
  const { activeSede } = useSede();
  const {
    data: overviewData,
    isLoading: overviewLoading,
    isError: overviewIsError,
    error: overviewError,
  } = useOperationalPlanningOverview();
  const { data: runs = [] } = useOperationalPlanningRuns();
  const { data: workers = [], isLoading: workersLoading } = useOperationalPlanningWorkers();
  const { data: buildings = [], isLoading: buildingsLoading } = useOperationalPlanningBuildings();
  const { data: allGroups = [] } = usePropertyGroups();
  const { cleaners } = useCleaners();
  const { data: properties = [] } = useProperties();
  const generateRun = useGenerateOperationalPlanningRun();
  const applyReplacement = useApplyOperationalPlanningReplacement();
  const approveRun = useApproveOperationalPlanningRun();
  const discardRun = useDiscardOperationalPlanningRun();
  const saveSettings = useSaveOperationalPlanningSettings();
  const createGroup = useCreatePropertyGroup();
  const updateGroup = useUpdatePropertyGroup();
  const assignProperty = useAssignPropertyToGroup();
  const removeProperty = useRemovePropertyFromGroup();
  const assignCleaner = useAssignCleanerToGroup();
  const updateCleanerAssignment = useUpdateCleanerAssignment();
  const removeCleaner = useRemoveCleanerFromGroup();
  const updatePlanningPropertyProfile = useUpdateOperationalPlanningPropertyProfile();
  const updatePlanningWorkerProfile = useUpdateOperationalPlanningWorkerProfile();

  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const previewQuery = useOperationalPlanningPreview(selectedRunId);
  const preview = previewQuery.data;

  const settings = overviewData?.settings;
  const [dateFrom, setDateFrom] = useState(formatMadridDate(new Date()));
  const [dateTo, setDateTo] = useState(formatMadridDate(new Date(Date.now() + 13 * 86400000)));
  const [horizonDays, setHorizonDays] = useState(14);
  const [bufferMinutes, setBufferMinutes] = useState(30);
  const [fallbackDailyCapacityMinutes, setFallbackDailyCapacityMinutes] = useState(480);
  const [weeklyTolerancePercent, setWeeklyTolerancePercent] = useState(10);
  const [allowBackups, setAllowBackups] = useState(true);
  const [excludeExtraordinary, setExcludeExtraordinary] = useState(true);
  const [approvalRequired, setApprovalRequired] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  const [selectedBuildingId, setSelectedBuildingId] = useState<string | null>(null);
  const [selectedFocusDate, setSelectedFocusDate] = useState<string | null>(null);
  const [buildingSearch, setBuildingSearch] = useState('');
  const [buildingFilter, setBuildingFilter] = useState<'all' | 'attention' | 'covered'>('all');
  const [newPropertyId, setNewPropertyId] = useState('');
  const [newCleanerId, setNewCleanerId] = useState('');
  const [newCleanerRole, setNewCleanerRole] = useState<'primary' | 'secondary' | 'backup'>('primary');
  const [selectedCoverageCleanerId, setSelectedCoverageCleanerId] = useState<string | null>(null);
  const [workerSearch, setWorkerSearch] = useState('');
  const [workerFilter, setWorkerFilter] = useState<'all' | 'attention' | 'available' | 'without-zone'>('all');
  const [absenceModalOpen, setAbsenceModalOpen] = useState(false);
  const [approveDialogOpen, setApproveDialogOpen] = useState(false);

  const selectedBuilding = useMemo(() => {
    if (!selectedBuildingId) return null;
    return allGroups.find((group) => group.id === selectedBuildingId) || null;
  }, [allGroups, selectedBuildingId]);

  const { data: propertyAssignments = [] } = usePropertyAssignments(selectedBuildingId || '');
  const { data: cleanerAssignments = [] } = useCleanerAssignments(selectedBuildingId || '');
  const selectedPlanningWorker = useMemo(
    () => workers.find((worker) => worker.id === selectedCoverageCleanerId) || null,
    [selectedCoverageCleanerId, workers],
  );
  const selectedCoverageCleaner = useMemo(
    () => cleaners.find((cleaner) => cleaner.id === selectedCoverageCleanerId) || null,
    [cleaners, selectedCoverageCleanerId],
  );
  const { data: selectedCoverageAbsences = [], isLoading: selectedCoverageAbsencesLoading } = useWorkerAbsences(
    selectedCoverageCleanerId || '',
    dateFrom,
    dateTo,
  );

  const [buildingForm, setBuildingForm] = useState({
    name: '',
    displayName: '',
    internalCode: '',
    zone: '',
    checkOutTime: '11:00',
    checkInTime: '16:00',
    recommendedCapacity: 1,
    difficultyLevel: 1,
    generalInstructions: '',
    planningNotes: '',
  });
  const [workerForm, setWorkerForm] = useState({
    contractHoursPerWeek: 40,
    planningMaxDailyMinutes: 480,
    planningZone: '',
    planningOperationalRestrictions: '',
    planningCanHandleLinenLoad: true,
    planningCanHandleComplexCleanings: true,
  });

  useEffect(() => {
    if (!settings) return;
    setHorizonDays(settings.horizonDays);
    setBufferMinutes(settings.bufferMinutes);
    setFallbackDailyCapacityMinutes(settings.fallbackDailyCapacityMinutes);
    setWeeklyTolerancePercent(settings.weeklyTolerancePercent);
    setAllowBackups(settings.allowBackups);
    setExcludeExtraordinary(settings.excludeExtraordinary);
    setApprovalRequired(settings.approvalRequired);
    setDateTo(formatMadridDate(new Date(Date.now() + Math.max(0, settings.horizonDays - 1) * 86400000)));
  }, [settings]);

  useEffect(() => {
    if (!selectedRunId && runs.length > 0) {
      setSelectedRunId(runs[0].id);
    }
  }, [runs, selectedRunId]);

  useEffect(() => {
    if (!selectedBuildingId && buildings.length > 0) {
      setSelectedBuildingId(buildings[0].id);
    }
  }, [buildings, selectedBuildingId]);

  useEffect(() => {
    if (!selectedBuilding) return;
    setBuildingForm({
      name: selectedBuilding.name,
      displayName: selectedBuilding.displayName || '',
      internalCode: selectedBuilding.internalCode || '',
      zone: selectedBuilding.zone || '',
      checkOutTime: selectedBuilding.checkOutTime || '11:00',
      checkInTime: selectedBuilding.checkInTime || '16:00',
      recommendedCapacity: selectedBuilding.recommendedCapacity || 1,
      difficultyLevel: selectedBuilding.difficultyLevel || 1,
      generalInstructions: selectedBuilding.generalInstructions || '',
      planningNotes: selectedBuilding.planningNotes || '',
    });
  }, [selectedBuilding]);

  useEffect(() => {
    if (!selectedCoverageCleanerId && cleaners.length > 0) {
      setSelectedCoverageCleanerId(cleaners[0].id);
    }
  }, [cleaners, selectedCoverageCleanerId]);

  useEffect(() => {
    if (!selectedCoverageCleaner) return;
    setWorkerForm({
      contractHoursPerWeek: selectedCoverageCleaner.contractHoursPerWeek || 40,
      planningMaxDailyMinutes: selectedCoverageCleaner.planningMaxDailyMinutes || 480,
      planningZone: selectedCoverageCleaner.planningZone || '',
      planningOperationalRestrictions: selectedCoverageCleaner.planningOperationalRestrictions || '',
      planningCanHandleLinenLoad: selectedCoverageCleaner.planningCanHandleLinenLoad ?? true,
      planningCanHandleComplexCleanings: selectedCoverageCleaner.planningCanHandleComplexCleanings ?? true,
    });
  }, [selectedCoverageCleaner]);

  const groupedPreviewItems = useMemo(() => {
    if (!preview) return [];
    const groups = new Map<string, typeof preview.items>();
    preview.items.forEach((item) => {
      const key = item.proposal.taskDate;
      const current = groups.get(key) || [];
      current.push(item);
      groups.set(key, current);
    });
    return Array.from(groups.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, items]) => ({
        date,
        items: items.sort((a, b) => a.proposal.startTime.localeCompare(b.proposal.startTime)),
      }));
  }, [preview]);

  useEffect(() => {
    const overviewDates = overviewData?.overview.days.map((day) => day.date) || [];
    const previewDates = groupedPreviewItems.map((group) => group.date);
    const allDates = [...new Set([...overviewDates, ...previewDates])];

    if (allDates.length === 0) {
      setSelectedFocusDate(null);
      return;
    }

    if (selectedFocusDate && allDates.includes(selectedFocusDate)) return;

    const preferredDate =
      [...(overviewData?.overview.days || [])]
        .sort((a, b) => b.deficitMinutes - a.deficitMinutes || b.unassigned - a.unassigned || a.date.localeCompare(b.date))[0]?.date
      || previewDates[0]
      || overviewDates[0];

    setSelectedFocusDate(preferredDate);
  }, [groupedPreviewItems, overviewData?.overview.days, selectedFocusDate]);

  const proposedLoadByCleaner = useMemo(() => {
    if (!preview) return [];

    const grouped = new Map<
      string,
      {
        cleanerName: string;
        taskCount: number;
        totalMinutes: number;
        buildings: Set<string>;
        days: Set<string>;
      }
    >();

    preview.items.forEach((item) => {
      item.proposedCleanerNames.forEach((cleanerName) => {
        const current = grouped.get(cleanerName) || {
          cleanerName,
          taskCount: 0,
          totalMinutes: 0,
          buildings: new Set<string>(),
          days: new Set<string>(),
        };

        current.taskCount += 1;
        current.totalMinutes += item.proposal.durationMinutes;
        if (item.proposal.propertyGroupName) current.buildings.add(item.proposal.propertyGroupName);
        current.days.add(item.proposal.taskDate);
        grouped.set(cleanerName, current);
      });
    });

    return Array.from(grouped.values())
      .map((entry) => ({
        cleanerName: entry.cleanerName,
        taskCount: entry.taskCount,
        totalMinutes: entry.totalMinutes,
        buildingCount: entry.buildings.size,
        dayCount: entry.days.size,
      }))
      .sort((a, b) => b.totalMinutes - a.totalMinutes || b.taskCount - a.taskCount);
  }, [preview]);

  const pendingNotificationPreview = useMemo(() => {
    if (!preview) return [];

    const grouped = new Map<
      string,
      {
        cleanerName: string;
        taskDate: string;
        tasks: Array<{
          propertyCode: string;
          startTime: string;
          endTime: string;
        }>;
      }
    >();

    preview.items.forEach((item) => {
      item.proposedCleanerNames.forEach((cleanerName) => {
        const key = `${cleanerName}::${item.proposal.taskDate}`;
        const current = grouped.get(key) || {
          cleanerName,
          taskDate: item.proposal.taskDate,
          tasks: [],
        };

        current.tasks.push({
          propertyCode: item.proposal.propertyCode,
          startTime: item.proposal.startTime,
          endTime: item.proposal.endTime,
        });
        grouped.set(key, current);
      });
    });

    return Array.from(grouped.values())
      .map((entry) => ({
        ...entry,
        tasks: entry.tasks.sort((a, b) => a.startTime.localeCompare(b.startTime)),
      }))
      .sort(
        (a, b) =>
          a.taskDate.localeCompare(b.taskDate) || a.cleanerName.localeCompare(b.cleanerName),
      );
  }, [preview]);

  const assignedProperties = useMemo(
    () => propertyAssignments
      .map((assignment) => ({
        assignmentId: assignment.id,
        property: properties.find((property) => property.id === assignment.propertyId) || null,
      }))
      .filter((entry) => entry.property),
    [propertyAssignments, properties],
  );

  const availableProperties = useMemo(() => {
    const assignedIds = new Set(propertyAssignments.map((assignment) => assignment.propertyId));
    return properties.filter((property) => !assignedIds.has(property.id));
  }, [properties, propertyAssignments]);

  const assignedCleaners = useMemo(
    () => cleanerAssignments
      .map((assignment) => ({
        assignment,
        cleaner: cleaners.find((cleaner) => cleaner.id === assignment.cleanerId) || null,
      }))
      .filter((entry) => entry.cleaner),
    [cleanerAssignments, cleaners],
  );

  const availableCleaners = useMemo(() => {
    const assignedIds = new Set(cleanerAssignments.map((assignment) => assignment.cleanerId));
    return cleaners.filter((cleaner) => !assignedIds.has(cleaner.id));
  }, [cleaners, cleanerAssignments]);

  const displayBuildings = useMemo(() => {
    if (!selectedBuilding) return buildings;
    if (buildings.some((building) => building.id === selectedBuilding.id)) return buildings;
    return [
      {
        id: selectedBuilding.id,
        name: selectedBuilding.name,
        displayName: selectedBuilding.displayName || null,
        internalCode: selectedBuilding.internalCode || null,
        zone: selectedBuilding.zone || null,
        propertyCount: assignedProperties.length,
        titularCount: assignedCleaners.filter((entry) => (entry.assignment.roleType || 'primary') === 'primary').length,
        substituteCount: assignedCleaners.filter((entry) => entry.assignment.roleType === 'secondary').length,
        backupCount: assignedCleaners.filter((entry) => entry.assignment.roleType === 'backup').length,
        isActive: selectedBuilding.isActive,
      },
      ...buildings,
    ];
  }, [assignedCleaners, assignedProperties.length, buildings, selectedBuilding]);

  const filteredBuildings = useMemo(() => {
    const normalizedSearch = buildingSearch.trim().toLowerCase();

    return displayBuildings.filter((building) => {
      const matchesSearch =
        !normalizedSearch
        || (building.displayName || building.name).toLowerCase().includes(normalizedSearch)
        || (building.internalCode || '').toLowerCase().includes(normalizedSearch)
        || (building.zone || '').toLowerCase().includes(normalizedSearch);

      if (!matchesSearch) return false;

      const needsAttention =
        building.propertyCount === 0
        || building.titularCount === 0
        || building.substituteCount === 0
        || building.backupCount === 0;

      if (buildingFilter === 'attention') return needsAttention;
      if (buildingFilter === 'covered') return !needsAttention;
      return true;
    });
  }, [buildingFilter, buildingSearch, displayBuildings]);

  const selectedBuildingCoverage = useMemo(() => {
    if (!selectedBuilding) return null;

    return getBuildingCoverageState({
      propertyCount: assignedProperties.length,
      titularCount: assignedCleaners.filter((entry) => (entry.assignment.roleType || 'primary') === 'primary').length,
      substituteCount: assignedCleaners.filter((entry) => entry.assignment.roleType === 'secondary').length,
      backupCount: assignedCleaners.filter((entry) => entry.assignment.roleType === 'backup').length,
    });
  }, [assignedCleaners, assignedProperties.length, selectedBuilding]);

  const utilizationPercent = overviewData?.overview
    ? Math.min(
        100,
        Math.round((overviewData.overview.requiredMinutes / Math.max(1, overviewData.overview.availableMinutes)) * 100),
      )
    : 0;
  const overviewErrorMessage = overviewIsError ? getReadableErrorMessage(overviewError) : null;
  const overviewMetric = (value: string | number, empty = '--') => {
    if (overviewLoading) return '...';
    if (overviewIsError || !overviewData) return empty;
    return value;
  };

  const selectedFocusDaySummary = useMemo(
    () => overviewData?.overview.days.find((day) => day.date === selectedFocusDate) || null,
    [overviewData?.overview.days, selectedFocusDate],
  );

  const selectedFocusPreviewItems = useMemo(
    () => preview?.items.filter((item) => item.proposal.taskDate === selectedFocusDate) || [],
    [preview, selectedFocusDate],
  );

  const selectedFocusConflicts = useMemo(
    () => preview?.conflicts.filter((conflict) => String(conflict.details?.date || '') === selectedFocusDate) || [],
    [preview, selectedFocusDate],
  );

  const previewFocusDate = useMemo(
    () => selectedFocusDate || groupedPreviewItems[0]?.date || null,
    [groupedPreviewItems, selectedFocusDate],
  );

  const visiblePreviewGroups = useMemo(() => {
    if (!isMobile) return groupedPreviewItems;
    if (!previewFocusDate) return groupedPreviewItems.slice(0, 1);
    return groupedPreviewItems.filter((group) => group.date === previewFocusDate);
  }, [groupedPreviewItems, isMobile, previewFocusDate]);

  const visiblePreviewConflicts = useMemo(() => {
    if (!preview) return [];
    if (!isMobile || !previewFocusDate) return preview.conflicts;
    return preview.conflicts.filter(
      (conflict) => String(conflict.details?.date || '') === previewFocusDate,
    );
  }, [isMobile, preview, previewFocusDate]);

  const conflictSummaryByCode = useMemo(() => {
    const grouped = new Map<string, number>();

    (preview?.conflicts || []).forEach((conflict) => {
      grouped.set(conflict.code, (grouped.get(conflict.code) || 0) + 1);
    });

    return Array.from(grouped.entries())
      .map(([code, count]) => ({ code, count }))
      .sort((a, b) => b.count - a.count || a.code.localeCompare(b.code));
  }, [preview]);

  const predictiveAlerts = useMemo(() => overviewData?.alerts || [], [overviewData?.alerts]);
  const substitutionSuggestions = useMemo(() => overviewData?.substitutions || [], [overviewData?.substitutions]);
  const performance = overviewData?.performance;

  const filteredWorkers = useMemo(() => {
    const normalizedSearch = workerSearch.trim().toLowerCase();

    return [...workers]
      .filter((worker) => {
        if (
          normalizedSearch &&
          !worker.name.toLowerCase().includes(normalizedSearch) &&
          !(worker.zone || '').toLowerCase().includes(normalizedSearch) &&
          !(worker.assignedBuildingNames || []).some((name) => name.toLowerCase().includes(normalizedSearch))
        ) {
          return false;
        }

        if (workerFilter === 'attention') {
          return (
            worker.activeAbsenceCount > 0
            || !!worker.planningOperationalRestrictions
            || !worker.zone
            || !worker.contractHoursPerWeek
          );
        }

        if (workerFilter === 'available') {
          return worker.activeAbsenceCount === 0;
        }

        if (workerFilter === 'without-zone') {
          return !worker.zone;
        }

        return true;
      })
      .sort((a, b) => {
        const riskA = Number(a.activeAbsenceCount > 0 || !!a.planningOperationalRestrictions || !a.zone);
        const riskB = Number(b.activeAbsenceCount > 0 || !!b.planningOperationalRestrictions || !b.zone);
        return riskB - riskA || a.name.localeCompare(b.name);
      });
  }, [workerFilter, workerSearch, workers]);

  const pendingSubstitutionCount = useMemo(
    () => substitutionSuggestions.reduce((sum, absence) => sum + absence.items.length, 0),
    [substitutionSuggestions],
  );

  const handleGenerate = async () => {
    if (!activeSede?.id) return;
    const previewResult = await generateRun.mutateAsync({
      sedeId: activeSede.id,
      dateFrom,
      dateTo,
    });
    setSelectedRunId(previewResult.run.id);
    setActiveTab('preview');
  };

  const handleApplyReplacement = async (item: typeof substitutionSuggestions[number]['items'][number]) => {
    if (item.recommendedCleaners.length === 0) return;

    await applyReplacement.mutateAsync({
      taskId: item.taskId,
      replacementCleanerIds: item.recommendedCleaners.slice(0, item.missingCleaners).map((candidate) => candidate.cleanerId),
      replacedCleanerIds: item.assignedCleanerIds.filter((cleanerId) => !item.availableAssignedCleanerIds.includes(cleanerId)),
      keepCleanerIds: item.availableAssignedCleanerIds,
    });
  };

  const handleSaveSettings = async () => {
    await saveSettings.mutateAsync({
      horizonDays,
      bufferMinutes,
      fallbackDailyCapacityMinutes,
      weeklyTolerancePercent,
      allowBackups,
      excludeExtraordinary,
      approvalRequired,
    });
  };

  const handleCreateBuilding = async () => {
    if (!activeSede?.id) return;
    const created = await createGroup.mutateAsync({
      name: `Nuevo edificio ${allGroups.length + 1}`,
      displayName: '',
      internalCode: '',
      zone: '',
      clientName: '',
      supervisorName: '',
      generalInstructions: '',
      difficultyLevel: 1,
      recommendedCapacity: 1,
      planningNotes: '',
      description: '',
      checkOutTime: '11:00',
      checkInTime: '16:00',
      isActive: true,
      autoAssignEnabled: false,
    });
    setSelectedBuildingId(created.id);
  };

  const handleSaveBuilding = async () => {
    if (!selectedBuilding) return;
    await updateGroup.mutateAsync({
      id: selectedBuilding.id,
      updates: {
        name: buildingForm.name,
        displayName: buildingForm.displayName || undefined,
        internalCode: buildingForm.internalCode || undefined,
        zone: buildingForm.zone || undefined,
        checkOutTime: buildingForm.checkOutTime,
        checkInTime: buildingForm.checkInTime,
        recommendedCapacity: buildingForm.recommendedCapacity,
        difficultyLevel: buildingForm.difficultyLevel,
        generalInstructions: buildingForm.generalInstructions || undefined,
        planningNotes: buildingForm.planningNotes || undefined,
      },
    });
  };

  const handleAssignProperty = async () => {
    if (!selectedBuildingId || !newPropertyId) return;
    await assignProperty.mutateAsync({ groupId: selectedBuildingId, propertyId: newPropertyId });
    setNewPropertyId('');
  };

  const handleAssignCleaner = async (roleOverride?: 'primary' | 'secondary' | 'backup') => {
    if (!selectedBuildingId || !newCleanerId) return;
    const roleToAssign = roleOverride || newCleanerRole;
    const currentCount = cleanerAssignments.length;
    const priorityBase = roleToAssign === 'primary' ? 10 : roleToAssign === 'secondary' ? 20 : 30;
    await assignCleaner.mutateAsync({
      propertyGroupId: selectedBuildingId,
      cleanerId: newCleanerId,
      priority: priorityBase + currentCount,
      roleType: roleToAssign,
      knowledgeLevel: roleToAssign === 'primary' ? 5 : roleToAssign === 'secondary' ? 3 : 2,
      maxTasksPerDay: 8,
      maxDailyMinutesOverride: null,
      estimatedTravelTimeMinutes: 15,
      notes: null,
      isActive: true,
    });
    setNewCleanerId('');
  };

  const handleSaveWorkerProfile = async () => {
    if (!selectedCoverageCleaner) return;
    await updatePlanningWorkerProfile.mutateAsync({
      cleanerId: selectedCoverageCleaner.id,
      updates: {
        contractHoursPerWeek: workerForm.contractHoursPerWeek,
        planningMaxDailyMinutes: workerForm.planningMaxDailyMinutes,
        planningZone: workerForm.planningZone || null,
        planningOperationalRestrictions: workerForm.planningOperationalRestrictions || null,
        planningCanHandleLinenLoad: workerForm.planningCanHandleLinenLoad,
        planningCanHandleComplexCleanings: workerForm.planningCanHandleComplexCleanings,
      },
    });
  };

  const isLoading = overviewLoading;

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#f8fbff_0%,#f5f2ff_40%,#ffffff_100%)]">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-4 px-3 py-4 pb-24 md:gap-6 md:px-6 md:py-6 md:pb-6 lg:px-8">
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
          <Card className="border-white/80 bg-white/92">
            <CardHeader className="gap-4 md:flex-row md:items-start md:justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.28em] text-[#310984]/70">
                  Planificación operativa
                </p>
                <CardTitle className="mt-2 text-2xl font-black text-slate-950 md:text-3xl">
                  Próximos 14 días
                </CardTitle>
                <CardDescription className="mt-2 text-sm text-slate-600">
                  Genera un borrador seguro para tareas normales sin cubrir, revisa conflictos y apruébalo solo cuando lo tengas claro.
                </CardDescription>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm">
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">Sede activa</p>
                <p className="mt-1 text-base font-black text-slate-900">{activeSede?.nombre || 'Sin sede activa'}</p>
              </div>
            </CardHeader>
            <CardContent>
              {overviewErrorMessage && (
                <div className="mb-4 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                    <div>
                      <p className="font-black">No se pudo cargar el resumen de planificación.</p>
                      <p className="mt-1 leading-6">{overviewErrorMessage}</p>
                    </div>
                  </div>
                </div>
              )}
              <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
                <div className="rounded-2xl border border-sky-200 bg-sky-50 p-4">
                  <p className="text-xs font-black uppercase tracking-[0.22em] text-sky-700">Sin cubrir</p>
                  <p className="mt-2 text-3xl font-black text-slate-950">
                    {overviewMetric(overviewData?.overview.unassignedTasks ?? 0)}
                  </p>
                  <p className="mt-1 text-xs text-slate-600 md:text-sm">Tareas pendientes de propuesta</p>
                </div>
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
                  <p className="text-xs font-black uppercase tracking-[0.22em] text-emerald-700">Capacidad</p>
                  <p className="mt-2 text-3xl font-black text-slate-950">
                    {overviewMetric(overviewData ? formatHours(overviewData.overview.availableMinutes) : '0 h')}
                  </p>
                  <p className="mt-1 text-xs text-slate-600 md:text-sm">Capacidad teórica disponible</p>
                </div>
                <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
                  <p className="text-xs font-black uppercase tracking-[0.22em] text-amber-700">Incidencia de carga</p>
                  <p className={`mt-2 text-3xl font-black ${statusTone(utilizationPercent)}`}>
                    {overviewMetric(`${utilizationPercent}%`)}
                  </p>
                  <p className="mt-1 text-xs text-slate-600 md:text-sm">Relación horas necesarias / disponibles</p>
                </div>
                <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4">
                  <p className="text-xs font-black uppercase tracking-[0.22em] text-rose-700">Riesgo</p>
                  <p className="mt-2 text-3xl font-black text-slate-950">
                    {overviewMetric(overviewData?.overview.deficitDays ?? 0)}
                  </p>
                  <p className="mt-1 text-xs text-slate-600 md:text-sm">Días con déficit o conflicto</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-[#310984]/20 bg-[#190044] text-white shadow-[0_28px_80px_rgba(49,9,132,0.22)]">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.22em] text-white/45">Pulso del plan</p>
                  <CardTitle className="mt-2 text-2xl font-black text-white">Centro de decisión</CardTitle>
                </div>
                <Sparkles className="h-5 w-5 text-cyan-300" />
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-3 xl:grid-cols-1">
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <p className="text-xs font-bold uppercase tracking-[0.2em] text-white/50">Horas requeridas</p>
                  <p className="mt-2 text-2xl font-black text-white">
                    {overviewMetric(overviewData ? formatHours(overviewData.overview.requiredMinutes) : '0 h')}
                  </p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <p className="text-xs font-bold uppercase tracking-[0.2em] text-white/50">Bajas activas</p>
                  <p className="mt-2 text-2xl font-black text-white">
                    {overviewMetric(overviewData?.overview.activeAbsences ?? 0)}
                  </p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <p className="text-xs font-bold uppercase tracking-[0.2em] text-white/50">Tareas críticas</p>
                  <p className="mt-2 text-2xl font-black text-white">
                    {overviewMetric(overviewData?.overview.criticalTasks ?? 0)}
                  </p>
                </div>
                <div className="rounded-2xl border border-cyan-200/20 bg-cyan-300/10 p-4">
                  <p className="text-xs font-bold uppercase tracking-[0.2em] text-cyan-100/80">Tiempo ahorrado</p>
                  <p className="mt-2 text-2xl font-black text-white">
                    {overviewMetric(performance ? formatHours(performance.estimatedTimeSavedMinutes) : '0 h')}
                  </p>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <Label htmlFor="planning-date-from" className="text-xs uppercase tracking-[0.18em] text-white/60">
                    Desde
                  </Label>
                  <Input
                    id="planning-date-from"
                    type="date"
                    value={dateFrom}
                    onChange={(event) => setDateFrom(event.target.value)}
                    className="mt-2 border-white/10 bg-white/5 text-white"
                  />
                </div>
                <div>
                  <Label htmlFor="planning-date-to" className="text-xs uppercase tracking-[0.18em] text-white/60">
                    Hasta
                  </Label>
                  <Input
                    id="planning-date-to"
                    type="date"
                    value={dateTo}
                    onChange={(event) => setDateTo(event.target.value)}
                    className="mt-2 border-white/10 bg-white/5 text-white"
                  />
                </div>
              </div>

              <Button
                className="w-full rounded-2xl bg-cyan-300 text-slate-950 hover:bg-cyan-200"
                onClick={handleGenerate}
                disabled={!activeSede?.id || generateRun.isPending}
              >
                {generateRun.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CalendarDays className="h-4 w-4" />}
                Planificar tareas
              </Button>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-3 md:grid-cols-3">
          <Button
            className="h-12 rounded-2xl bg-[#310984] text-white hover:bg-[#26066b]"
            onClick={handleGenerate}
            disabled={!activeSede?.id || generateRun.isPending}
          >
            {generateRun.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CalendarDays className="h-4 w-4" />}
            Planificar tareas
          </Button>
          <Button
            type="button"
            variant="outline"
            className="h-12 rounded-2xl border-amber-200 bg-amber-50 text-amber-900 hover:bg-amber-100"
            onClick={() => setActiveTab('coverage')}
          >
            <ShieldAlert className="h-4 w-4" />
            Cubrir bajas
          </Button>
          <Button
            type="button"
            variant="outline"
            className="h-12 rounded-2xl border-slate-200 bg-white text-slate-900 hover:bg-slate-50"
            onClick={() => setActiveTab('buildings')}
          >
            <Building2 className="h-4 w-4" />
            Configurar edificios
          </Button>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <div className="md:hidden">
            <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
              <Label className="text-xs font-black uppercase tracking-[0.2em] text-slate-500">
                Sección
              </Label>
              <Select value={activeTab} onValueChange={setActiveTab}>
                <SelectTrigger className="mt-2 rounded-xl border-slate-200 bg-slate-50">
                  <SelectValue placeholder="Selecciona una vista" />
                </SelectTrigger>
                <SelectContent>
                  {planningTabOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <TabsList className="hidden h-auto w-full justify-start gap-2 rounded-2xl border border-slate-200 bg-white p-2 md:flex">
            <TabsTrigger value="overview" className="rounded-xl px-4 py-2">Resumen</TabsTrigger>
            <TabsTrigger value="preview" className="rounded-xl px-4 py-2">Vista previa</TabsTrigger>
            <TabsTrigger value="workers" className="rounded-xl px-4 py-2">Equipo</TabsTrigger>
            <TabsTrigger value="buildings" className="rounded-xl px-4 py-2">Edificios</TabsTrigger>
            <TabsTrigger value="coverage" className="rounded-xl px-4 py-2">Cobertura</TabsTrigger>
            <TabsTrigger value="performance" className="rounded-xl px-4 py-2">Rendimiento</TabsTrigger>
            <TabsTrigger value="rules" className="rounded-xl px-4 py-2">Reglas</TabsTrigger>
          </TabsList>

          <TabsContent value="overview">
            <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
              <Card>
                <CardHeader>
                  <CardTitle className="text-xl font-black">Radar diario</CardTitle>
                  <CardDescription>Lectura rápida de carga, huecos y presión operativa por día.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {isLoading ? (
                    <div className="flex min-h-48 flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-slate-300 bg-slate-50 text-sm text-slate-500">
                      <Loader2 className="h-6 w-6 animate-spin text-[#310984]" />
                      <span>Cargando tareas, capacidad y bajas de la sede activa...</span>
                    </div>
                  ) : overviewErrorMessage ? (
                    <div className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-sm text-rose-800">
                      <p className="font-black">No se puede mostrar el radar ahora mismo.</p>
                      <p className="mt-2 leading-6">{overviewErrorMessage}</p>
                    </div>
                  ) : (overviewData?.overview.days || []).length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6 text-sm text-slate-600">
                      <p className="font-black text-slate-900">No hay tareas normales en este rango.</p>
                      <p className="mt-2 leading-6">
                        Revisa la sede activa, las fechas o la sincronización de reservas si esperabas ver limpiezas pendientes.
                      </p>
                    </div>
                  ) : (
                    (overviewData?.overview.days || []).map((day) => {
                      const capacityPercent = Math.min(100, Math.round((day.requiredMinutes / Math.max(1, day.availableMinutes)) * 100));
                      return (
                        <button
                          key={day.date}
                          type="button"
                          onClick={() => setSelectedFocusDate(day.date)}
                          className={`w-full rounded-2xl border p-4 text-left transition ${
                            selectedFocusDate === day.date
                              ? 'border-[#310984] bg-[#310984]/5 shadow-sm'
                              : 'border-slate-200 bg-slate-50 hover:border-slate-300'
                          }`}
                        >
                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <div>
                              <p className="text-sm font-black uppercase tracking-[0.18em] text-slate-500">{formatLongDate(day.date)}</p>
                              <p className="mt-2 text-lg font-black text-slate-950">
                                {day.unassigned} sin cubrir · {day.tasks} tareas
                              </p>
                            </div>
                            <div className="text-right">
                              <p className={`text-2xl font-black ${statusTone(capacityPercent)}`}>{capacityPercent}%</p>
                              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">ocupación</p>
                            </div>
                          </div>
                          <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-200">
                            <div
                              className={`h-full rounded-full ${capacityPercent >= 85 ? 'bg-rose-500' : capacityPercent >= 60 ? 'bg-amber-500' : 'bg-emerald-500'}`}
                              style={{ width: `${capacityPercent}%` }}
                            />
                          </div>
                          <div className="mt-3 flex flex-wrap gap-2 text-sm text-slate-600">
                            <span>{formatHours(day.requiredMinutes)} necesarias</span>
                            <span>·</span>
                            <span>{formatHours(day.availableMinutes)} disponibles</span>
                            <span>·</span>
                            <span>{day.criticalTasks} críticas</span>
                          </div>
                        </button>
                      );
                    })
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-xl font-black">Foco operativo</CardTitle>
                  <CardDescription>Resumen rápido del día que más te conviene revisar ahora.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {!selectedFocusDate || !selectedFocusDaySummary ? (
                    <div className="rounded-2xl border border-dashed border-slate-300 p-6 text-sm text-slate-500">
                      Selecciona un día del radar para ver su detalle.
                    </div>
                  ) : (
                    <>
                      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <p className="text-sm font-black text-slate-950">
                              {formatLongDate(selectedFocusDate)}
                            </p>
                            <p className="mt-1 text-sm text-slate-600">
                              {selectedFocusDaySummary.unassigned} sin cubrir · {selectedFocusDaySummary.criticalTasks} críticas
                            </p>
                          </div>
                          <Badge variant={selectedFocusDaySummary.deficitMinutes > 0 ? 'destructive' : 'secondary'}>
                            {selectedFocusDaySummary.deficitMinutes > 0
                              ? `${formatHours(selectedFocusDaySummary.deficitMinutes)} de déficit`
                              : 'Cobertura controlada'}
                          </Badge>
                        </div>
                        <div className="mt-3 text-sm text-slate-600">
                          {formatHours(selectedFocusDaySummary.requiredMinutes)} necesarias · {formatHours(selectedFocusDaySummary.availableMinutes)} disponibles
                        </div>
                      </div>

                      <div className="grid gap-3 sm:grid-cols-3">
                        <div className="rounded-2xl border border-slate-200 bg-white p-4">
                          <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">Propuestas</p>
                          <p className="mt-2 text-2xl font-black text-slate-950">{selectedFocusPreviewItems.length}</p>
                        </div>
                        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
                          <p className="text-xs font-black uppercase tracking-[0.18em] text-amber-700">Conflictos</p>
                          <p className="mt-2 text-2xl font-black text-slate-950">{selectedFocusConflicts.length}</p>
                        </div>
                        <div className="rounded-2xl border border-sky-200 bg-sky-50 p-4">
                          <p className="text-xs font-black uppercase tracking-[0.18em] text-sky-700">Tareas</p>
                          <p className="mt-2 text-2xl font-black text-slate-950">{selectedFocusDaySummary.tasks}</p>
                        </div>
                      </div>

                      <Button
                        variant="outline"
                        className="w-full rounded-2xl"
                        onClick={() => setActiveTab('preview')}
                      >
                        Ver borrador del día en vista previa
                      </Button>
                    </>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-xl font-black">Alertas predictivas</CardTitle>
                  <CardDescription>Señales tempranas para actuar antes de que el problema llegue al calendario.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {predictiveAlerts.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-slate-300 p-6 text-sm text-slate-500">
                      No hay alertas predictivas relevantes ahora mismo.
                    </div>
                  ) : (
                    predictiveAlerts.map((alert) => (
                      <div key={alert.id} className={`rounded-2xl border p-4 ${predictiveAlertTone(alert.severity)}`}>
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-sm font-black">{alert.title}</p>
                            <p className="mt-1 text-sm leading-6 opacity-90">{alert.message}</p>
                          </div>
                          <Badge
                            variant="outline"
                            className={alert.severity === 'critical'
                              ? 'border-rose-300 bg-white/60 text-rose-700'
                              : alert.severity === 'warning'
                                ? 'border-amber-300 bg-white/60 text-amber-700'
                                : 'border-sky-300 bg-white/60 text-sky-700'}
                          >
                            {alert.severity === 'critical' ? 'Crítica' : alert.severity === 'warning' ? 'Aviso' : 'Info'}
                          </Badge>
                        </div>
                        {(alert.date || alert.propertyGroupName || alert.cleanerName) && (
                          <div className="mt-3 flex flex-wrap gap-2 text-xs font-semibold uppercase tracking-[0.16em] opacity-70">
                            {alert.date && <span>{formatLongDate(alert.date)}</span>}
                            {alert.propertyGroupName && <span>{alert.propertyGroupName}</span>}
                            {alert.cleanerName && <span>{alert.cleanerName}</span>}
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="preview">
            <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
              <Card>
                <CardHeader className="gap-4 md:flex-row md:items-start md:justify-between">
                  <div>
                    <CardTitle className="text-xl font-black">Borrador de cobertura</CardTitle>
                    <CardDescription>
                      {preview
                        ? `Periodo ${formatLongDate(preview.run.dateFrom)} → ${formatLongDate(preview.run.dateTo)}`
                        : 'Genera un borrador para revisar a quién cubriría cada tarea.'}
                    </CardDescription>
                  </div>
                  {preview && (
                    <div className="grid w-full gap-2 sm:flex sm:w-auto sm:flex-wrap">
                      <Button
                        variant="outline"
                        className="w-full rounded-xl sm:w-auto"
                        onClick={handleGenerate}
                        disabled={generateRun.isPending}
                      >
                        {generateRun.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CalendarDays className="h-4 w-4" />}
                        Recalcular
                      </Button>
                      <Button
                        variant="outline"
                        className="w-full rounded-xl sm:w-auto"
                        onClick={() => discardRun.mutate(preview.run.id)}
                        disabled={discardRun.isPending || preview.run.status !== 'draft'}
                      >
                        Descartar
                      </Button>
                      <Button
                        className="w-full rounded-xl sm:w-auto"
                        onClick={() => setApproveDialogOpen(true)}
                        disabled={approveRun.isPending || preview.run.status !== 'draft'}
                      >
                        {approveRun.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                        Aprobar planificación
                      </Button>
                    </div>
                  )}
                </CardHeader>
                <CardContent className="space-y-5">
                  {!preview ? (
                    <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6 text-sm text-slate-600">
                      <p className="font-bold text-slate-900">Todavía no hay borrador.</p>
                      <p className="mt-1">Genera una propuesta para ver tareas, conflictos y avisos antes de aplicar nada.</p>
                      <Button
                        className="mt-4 rounded-xl bg-[#310984] text-white hover:bg-[#26066b]"
                        onClick={handleGenerate}
                        disabled={!activeSede?.id || generateRun.isPending}
                      >
                        {generateRun.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CalendarDays className="h-4 w-4" />}
                        Planificar tareas
                      </Button>
                    </div>
                  ) : previewQuery.isLoading ? (
                    <div className="flex min-h-64 items-center justify-center">
                      <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
                    </div>
                  ) : (
                    <>
                      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                          <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-500">Tareas</p>
                          <p className="mt-2 text-2xl font-black text-slate-950">{preview.run.summary.totalTasks}</p>
                        </div>
                        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
                          <p className="text-xs font-black uppercase tracking-[0.2em] text-emerald-700">Propuestas</p>
                          <p className="mt-2 text-2xl font-black text-slate-950">{preview.run.summary.proposedTasks}</p>
                        </div>
                        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
                          <p className="text-xs font-black uppercase tracking-[0.2em] text-amber-700">Personas</p>
                          <p className="mt-2 text-2xl font-black text-slate-950">{preview.run.summary.proposedAssignments}</p>
                        </div>
                        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4">
                          <p className="text-xs font-black uppercase tracking-[0.2em] text-rose-700">Conflictos</p>
                          <p className="mt-2 text-2xl font-black text-slate-950">{preview.run.summary.conflictCount}</p>
                        </div>
                      </div>

                      <div className="space-y-5">
                        {groupedPreviewItems.length > 0 && (
                          <div className={cn('flex flex-wrap gap-2', isMobile && 'flex-col')}>
                            {isMobile ? (
                              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                                <Label className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">
                                  Día en revisión
                                </Label>
                                <Select
                                  value={previewFocusDate || groupedPreviewItems[0].date}
                                  onValueChange={(value) => setSelectedFocusDate(value)}
                                >
                                  <SelectTrigger className="mt-2 rounded-xl border-slate-200 bg-white">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {groupedPreviewItems.map((group) => (
                                      <SelectItem key={`focus-mobile-${group.date}`} value={group.date}>
                                        {formatLongDate(group.date)} · {group.items.length}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                            ) : (
                              groupedPreviewItems.map((group) => (
                              <button
                                key={`focus-${group.date}`}
                                type="button"
                                onClick={() => setSelectedFocusDate(group.date)}
                                className={`rounded-full border px-3 py-1.5 text-xs font-black uppercase tracking-[0.18em] transition ${
                                  selectedFocusDate === group.date
                                    ? 'border-[#310984] bg-[#310984] text-white'
                                    : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                                }`}
                              >
                                {formatLongDate(group.date)} · {group.items.length}
                              </button>
                              ))
                            )}
                          </div>
                        )}

                        {visiblePreviewGroups.map((group) => (
                          <div key={group.date} className="space-y-3">
                            <div className="flex items-center gap-2">
                              <CalendarDays className="h-4 w-4 text-[#310984]" />
                              <h3 className="text-sm font-black uppercase tracking-[0.22em] text-slate-600">
                                {formatLongDate(group.date)}
                              </h3>
                            </div>
                            <div className="space-y-3">
                              {group.items.map((item) => (
                                <ProposalCard key={item.id} item={item} />
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>

              <div className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-xl font-black">Conflictos</CardTitle>
                    <CardDescription>Las tareas sin propuesta segura quedan aquí para revisión manual.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {preview?.conflicts.length ? (
                      <>
                        <div className="flex flex-wrap gap-2">
                          {conflictSummaryByCode.map((entry) => (
                            <Badge
                              key={entry.code}
                              variant="outline"
                              className="border-rose-200 bg-rose-50 text-rose-700"
                            >
                              {conflictCodeLabel(entry.code)} · {entry.count}
                            </Badge>
                          ))}
                        </div>

                        {visiblePreviewConflicts
                          .filter((conflict) => !previewFocusDate || String(conflict.details?.date || '') === previewFocusDate)
                          .map((conflict) => (
                            <div key={conflict.id} className="rounded-2xl border border-rose-200 bg-rose-50 p-4">
                              <div className="flex items-start gap-3">
                                <ShieldAlert className="mt-0.5 h-5 w-5 text-rose-600" />
                                <div className="min-w-0">
                                  <div className="flex flex-wrap items-center gap-2">
                                    {conflict.details?.propertyCode && (
                                      <Badge variant="outline" className="border-rose-300 bg-white text-rose-700">
                                        {String(conflict.details.propertyCode)}
                                      </Badge>
                                    )}
                                    {conflict.details?.date && (
                                      <span className="text-xs font-semibold uppercase tracking-[0.18em] text-rose-700">
                                        {formatLongDate(String(conflict.details.date))}
                                      </span>
                                    )}
                                  </div>
                                  <p className="mt-2 text-sm font-black text-rose-900">{conflict.message}</p>
                                  <p className="mt-2 text-xs font-semibold uppercase tracking-[0.18em] text-rose-700">
                                    {conflictCodeLabel(String(conflict.code))}
                                  </p>
                                  {(conflict.details?.startTime || conflict.details?.endTime) && (
                                    <p className="mt-2 text-xs text-rose-800">
                                      {String(conflict.details?.startTime || '--:--')} - {String(conflict.details?.endTime || '--:--')}
                                    </p>
                                  )}
                                </div>
                              </div>
                            </div>
                          ))}
                      </>
                    ) : (
                      <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
                        No hay conflictos en el borrador actual.
                      </div>
                    )}
                    {preview?.conflicts.length > 0 && visiblePreviewConflicts.length === 0 && (
                      <div className="rounded-2xl border border-dashed border-slate-300 p-4 text-sm text-slate-500">
                        No hay conflictos para el día seleccionado.
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-xl font-black">Carga propuesta</CardTitle>
                    <CardDescription>
                      Revisa si el borrador está equilibrado antes de aprobar.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {!preview ? (
                      <div className="rounded-2xl border border-dashed border-slate-300 p-4 text-sm text-slate-500">
                        Genera un borrador para ver si el reparto queda equilibrado.
                      </div>
                    ) : proposedLoadByCleaner.length === 0 ? (
                      <div className="rounded-2xl border border-dashed border-slate-300 p-4 text-sm text-slate-500">
                        Este borrador todavía no tiene carga repartida.
                      </div>
                    ) : (
                      proposedLoadByCleaner.map((entry) => (
                        <div key={entry.cleanerName} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="text-sm font-black text-slate-950">{entry.cleanerName}</p>
                              <p className="mt-1 text-xs uppercase tracking-[0.18em] text-slate-500">
                                {entry.taskCount} tareas · {entry.dayCount} días · {entry.buildingCount} edificios
                              </p>
                            </div>
                            <Badge variant="outline" className="border-sky-200 bg-sky-50 text-sky-700">
                              {formatHours(entry.totalMinutes)}
                            </Badge>
                          </div>
                        </div>
                      ))
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-xl font-black">Avisos previstos</CardTitle>
                    <CardDescription>
                      Agrupado estimado de notificaciones por trabajadora y día al aprobar.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {!preview ? (
                      <div className="rounded-2xl border border-dashed border-slate-300 p-4 text-sm text-slate-500">
                        Genera un borrador para ver los avisos antes de enviarlos.
                      </div>
                    ) : pendingNotificationPreview.length === 0 ? (
                      <div className="rounded-2xl border border-dashed border-slate-300 p-4 text-sm text-slate-500">
                        Este borrador no enviaría avisos.
                      </div>
                    ) : (
                      pendingNotificationPreview.slice(0, 8).map((entry) => (
                        <div key={`${entry.cleanerName}-${entry.taskDate}`} className="rounded-2xl border border-slate-200 bg-white p-4">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="text-sm font-black text-slate-950">{entry.cleanerName}</p>
                              <p className="mt-1 text-xs uppercase tracking-[0.18em] text-slate-500">
                                {formatLongDate(entry.taskDate)}
                              </p>
                            </div>
                            <Badge variant="secondary">{entry.tasks.length} tareas</Badge>
                          </div>
                          <div className="mt-3 space-y-1 text-sm text-slate-600">
                            {entry.tasks.map((task) => (
                              <p key={`${task.propertyCode}-${task.startTime}-${task.endTime}`}>
                                {task.propertyCode} · {task.startTime} - {task.endTime}
                              </p>
                            ))}
                          </div>
                        </div>
                      ))
                    )}
                    {pendingNotificationPreview.length > 8 && (
                      <div className="rounded-2xl border border-dashed border-slate-300 p-3 text-xs text-slate-500">
                        Y {pendingNotificationPreview.length - 8} agrupados más al aprobar.
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-xl font-black">Qué hace el motor</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3 text-sm leading-6 text-slate-600">
                    <div className="flex gap-3">
                      <ArrowRight className="mt-1 h-4 w-4 text-[#310984]" />
                      <p>Prioriza titulares del edificio, después suplentes, backups y por último equipo de la misma zona.</p>
                    </div>
                    <div className="flex gap-3">
                      <ArrowRight className="mt-1 h-4 w-4 text-[#310984]" />
                      <p>Excluye extraordinarias y nunca toca tareas ya asignadas en esta primera versión.</p>
                    </div>
                    <div className="flex gap-3">
                      <ArrowRight className="mt-1 h-4 w-4 text-[#310984]" />
                      <p>Si una tarea no cabe por horarios, cobertura o datos incompletos, la deja en conflicto en vez de forzar una mala decisión.</p>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="workers">
            <div className="grid gap-4 xl:grid-cols-[420px_minmax(0,1fr)]">
              <Card>
                <CardHeader>
                  <CardTitle className="text-xl font-black">Equipo operativo</CardTitle>
                  <CardDescription>Busca rápido, detecta riesgos y entra a editar sin salir del módulo.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_180px]">
                    <div className="space-y-2">
                      <Label>Buscar trabajadora</Label>
                      <Input
                        value={workerSearch}
                        onChange={(event) => setWorkerSearch(event.target.value)}
                        placeholder="Nombre, zona o edificio..."
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Filtro</Label>
                      <Select value={workerFilter} onValueChange={(value: 'all' | 'attention' | 'available' | 'without-zone') => setWorkerFilter(value)}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Todo el equipo</SelectItem>
                          <SelectItem value="attention">Necesitan revisión</SelectItem>
                          <SelectItem value="available">Disponibles</SelectItem>
                          <SelectItem value="without-zone">Sin zona</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-4">
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                      <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">Equipo</p>
                      <p className="mt-2 text-2xl font-black text-slate-950">{workers.length}</p>
                    </div>
                    <div className="rounded-2xl border border-rose-200 bg-rose-50 p-3">
                      <p className="text-xs font-black uppercase tracking-[0.18em] text-rose-700">Con ausencias</p>
                      <p className="mt-2 text-2xl font-black text-slate-950">{workers.filter((worker) => worker.activeAbsenceCount > 0).length}</p>
                    </div>
                    <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3">
                      <p className="text-xs font-black uppercase tracking-[0.18em] text-amber-700">Con restricciones</p>
                      <p className="mt-2 text-2xl font-black text-slate-950">{workers.filter((worker) => !!worker.planningOperationalRestrictions).length}</p>
                    </div>
                    <div className="rounded-2xl border border-sky-200 bg-sky-50 p-3">
                      <p className="text-xs font-black uppercase tracking-[0.18em] text-sky-700">Sin zona</p>
                      <p className="mt-2 text-2xl font-black text-slate-950">{workers.filter((worker) => !worker.zone).length}</p>
                    </div>
                  </div>

                  <div className="space-y-3">
                    {workersLoading ? (
                      <div className="flex min-h-40 items-center justify-center">
                        <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
                      </div>
                    ) : filteredWorkers.length === 0 ? (
                      <div className="rounded-2xl border border-dashed border-slate-300 p-5 text-sm text-slate-500">
                        No hay trabajadoras que coincidan con el filtro actual.
                      </div>
                    ) : (
                      filteredWorkers.map((worker) => {
                        const needsAttention =
                          worker.activeAbsenceCount > 0
                          || !!worker.planningOperationalRestrictions
                          || !worker.zone
                          || !worker.contractHoursPerWeek;

                        return (
                          <button
                            key={worker.id}
                            type="button"
                            onClick={() => setSelectedCoverageCleanerId(worker.id)}
                            className={`w-full rounded-2xl border p-4 text-left transition ${
                              selectedCoverageCleanerId === worker.id
                                ? 'border-[#310984] bg-[#310984]/5 shadow-sm'
                                : 'border-slate-200 bg-white hover:border-slate-300'
                            }`}
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <p className="truncate text-base font-black text-slate-950">{worker.name}</p>
                                <p className="mt-1 truncate text-sm text-slate-500">{worker.zone || 'Sin zona operativa'}</p>
                              </div>
                              <Badge variant={needsAttention ? 'destructive' : 'secondary'}>
                                {needsAttention ? 'Revisar' : 'OK'}
                              </Badge>
                            </div>

                            <div className="mt-3 flex flex-wrap gap-2">
                              <Badge variant="outline">{formatHours(worker.maxDailyMinutes)}</Badge>
                              <Badge variant="outline">{worker.contractHoursPerWeek ?? 0} h/sem</Badge>
                              {worker.primaryBuildingCount > 0 && <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100">{worker.primaryBuildingCount} titular</Badge>}
                              {worker.secondaryBuildingCount > 0 && <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100">{worker.secondaryBuildingCount} suplente</Badge>}
                              {worker.backupBuildingCount > 0 && <Badge className="bg-sky-100 text-sky-800 hover:bg-sky-100">{worker.backupBuildingCount} backup</Badge>}
                            </div>

                            <div className="mt-3 space-y-1 text-sm text-slate-600">
                              <p>Ausencias activas: <span className={statusTone(worker.activeAbsenceCount, true)}>{worker.activeAbsenceCount}</span></p>
                              <p>Días fijos libres: <span className="font-bold text-slate-900">{worker.fixedDaysOffCount}</span></p>
                              <p>Bloques fijos: <span className="font-bold text-slate-900">{worker.maintenanceCount}</span></p>
                            </div>
                          </button>
                        );
                      })
                    )}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-xl font-black">Editor rápido del equipo</CardTitle>
                  <CardDescription>
                    Perfil operativo, capacidades y cobertura estructural de la trabajadora seleccionada.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-5">
                  {!selectedCoverageCleaner || !selectedPlanningWorker ? (
                    <div className="rounded-2xl border border-dashed border-slate-300 p-8 text-sm text-slate-500">
                      Selecciona una trabajadora en la columna izquierda para editarla.
                    </div>
                  ) : (
                    <>
                      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <p className="text-lg font-black text-slate-950">{selectedCoverageCleaner.name}</p>
                            <p className="mt-1 text-sm text-slate-500">{selectedCoverageCleaner.email || 'Sin email operativo'}</p>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <Badge variant={selectedPlanningWorker.activeAbsenceCount > 0 ? 'destructive' : 'secondary'}>
                              {selectedPlanningWorker.activeAbsenceCount > 0
                                ? `${selectedPlanningWorker.activeAbsenceCount} ausencia${selectedPlanningWorker.activeAbsenceCount > 1 ? 's' : ''}`
                                : 'Disponible'}
                            </Badge>
                            {selectedPlanningWorker.planningOperationalRestrictions && (
                              <Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-800">
                                Restricciones
                              </Badge>
                            )}
                          </div>
                        </div>

                        <div className="mt-4 grid gap-3 sm:grid-cols-3">
                          <div className="rounded-2xl border border-white bg-white p-3">
                            <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">Titular</p>
                            <p className="mt-2 text-2xl font-black text-slate-950">{selectedPlanningWorker.primaryBuildingCount}</p>
                          </div>
                          <div className="rounded-2xl border border-white bg-white p-3">
                            <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">Suplente</p>
                            <p className="mt-2 text-2xl font-black text-slate-950">{selectedPlanningWorker.secondaryBuildingCount}</p>
                          </div>
                          <div className="rounded-2xl border border-white bg-white p-3">
                            <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">Backup</p>
                            <p className="mt-2 text-2xl font-black text-slate-950">{selectedPlanningWorker.backupBuildingCount}</p>
                          </div>
                        </div>
                      </div>

                      <div className="grid gap-4 md:grid-cols-2">
                        <div className="space-y-2">
                          <Label>Horas contratadas / semana</Label>
                          <Input
                            type="number"
                            min={0}
                            step={1}
                            value={workerForm.contractHoursPerWeek}
                            onChange={(event) =>
                              setWorkerForm((prev) => ({
                                ...prev,
                                contractHoursPerWeek: Number(event.target.value) || 0,
                              }))
                            }
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Capacidad diaria (min)</Label>
                          <Input
                            type="number"
                            min={60}
                            step={30}
                            value={workerForm.planningMaxDailyMinutes}
                            onChange={(event) =>
                              setWorkerForm((prev) => ({
                                ...prev,
                                planningMaxDailyMinutes: Number(event.target.value) || 480,
                              }))
                            }
                          />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label>Zona operativa</Label>
                        <Input
                          value={workerForm.planningZone}
                          onChange={(event) =>
                            setWorkerForm((prev) => ({ ...prev, planningZone: event.target.value }))
                          }
                          placeholder="Ej: Centro, Marina, Orzán..."
                        />
                      </div>

                      <div className="space-y-2">
                        <Label>Restricciones operativas</Label>
                        <Textarea
                          value={workerForm.planningOperationalRestrictions}
                          onChange={(event) =>
                            setWorkerForm((prev) => ({
                              ...prev,
                              planningOperationalRestrictions: event.target.value,
                            }))
                          }
                          placeholder="Ej: evitar cargas largas, solo mañanas, no edificios sin ascensor..."
                        />
                      </div>

                      <div className="grid gap-3 lg:grid-cols-2">
                        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                          <div className="flex items-center justify-between gap-4">
                            <div>
                              <p className="font-bold text-slate-900">Puede asumir carga de lencería</p>
                              <p className="text-sm text-slate-500">Para edificios con más volumen o bolsas pesadas.</p>
                            </div>
                            <Switch
                              checked={workerForm.planningCanHandleLinenLoad}
                              onCheckedChange={(checked) =>
                                setWorkerForm((prev) => ({ ...prev, planningCanHandleLinenLoad: checked }))
                              }
                            />
                          </div>
                        </div>

                        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                          <div className="flex items-center justify-between gap-4">
                            <div>
                              <p className="font-bold text-slate-900">Puede asumir limpiezas complejas</p>
                              <p className="text-sm text-slate-500">Útil para propiedades delicadas o más exigentes.</p>
                            </div>
                            <Switch
                              checked={workerForm.planningCanHandleComplexCleanings}
                              onCheckedChange={(checked) =>
                                setWorkerForm((prev) => ({ ...prev, planningCanHandleComplexCleanings: checked }))
                              }
                            />
                          </div>
                        </div>
                      </div>

                      <div className="space-y-3">
                        <div className="flex items-center justify-between gap-3">
                          <p className="text-sm font-black uppercase tracking-[0.18em] text-slate-500">Edificios asignados</p>
                          <Button
                            type="button"
                            variant="outline"
                            className="rounded-xl"
                            onClick={() => setActiveTab('buildings')}
                          >
                            Editar cobertura por edificios
                          </Button>
                        </div>
                        {selectedPlanningWorker.assignedBuildingNames.length === 0 ? (
                          <div className="rounded-2xl border border-dashed border-slate-300 p-4 text-sm text-slate-500">
                            Esta trabajadora todavía no tiene edificios vinculados en planificación.
                          </div>
                        ) : (
                          <div className="flex flex-wrap gap-2">
                            {selectedPlanningWorker.assignedBuildingNames.map((buildingName) => (
                              <Badge key={buildingName} variant="outline" className="border-slate-200 bg-white text-slate-700">
                                {buildingName}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </div>

                      <div className="flex flex-wrap gap-3">
                        <Button
                          className="rounded-2xl"
                          onClick={handleSaveWorkerProfile}
                          disabled={updatePlanningWorkerProfile.isPending}
                        >
                          {updatePlanningWorkerProfile.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                          Guardar perfil operativo
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          className="rounded-2xl"
                          onClick={() => setActiveTab('coverage')}
                        >
                          Gestionar ausencias y cobertura
                        </Button>
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="buildings">
            <div className="grid gap-4 xl:grid-cols-[320px_minmax(0,1fr)]">
              <Card>
                <CardHeader className="gap-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <CardTitle className="text-xl font-black">Edificios</CardTitle>
                      <CardDescription>Selecciona el grupo operativo que quieres afinar.</CardDescription>
                    </div>
                    <Button size="sm" className="rounded-xl" onClick={handleCreateBuilding} disabled={createGroup.isPending}>
                      <Plus className="h-4 w-4" />
                      Nuevo
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid gap-3">
                    <div className="space-y-2">
                      <Label>Buscar edificio</Label>
                      <Input
                        value={buildingSearch}
                        onChange={(event) => setBuildingSearch(event.target.value)}
                        placeholder="Nombre, código o zona..."
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Filtro</Label>
                      <Select value={buildingFilter} onValueChange={(value: 'all' | 'attention' | 'covered') => setBuildingFilter(value)}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Todos</SelectItem>
                          <SelectItem value="attention">Necesitan cobertura</SelectItem>
                          <SelectItem value="covered">Cobertura completa</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-3">
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                      <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">Edificios</p>
                      <p className="mt-2 text-2xl font-black text-slate-950">{displayBuildings.length}</p>
                    </div>
                    <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3">
                      <p className="text-xs font-black uppercase tracking-[0.18em] text-amber-700">A revisar</p>
                      <p className="mt-2 text-2xl font-black text-slate-950">
                        {displayBuildings.filter((building) => building.propertyCount === 0 || building.titularCount === 0 || building.substituteCount === 0 || building.backupCount === 0).length}
                      </p>
                    </div>
                    <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-3">
                      <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-700">Completos</p>
                      <p className="mt-2 text-2xl font-black text-slate-950">
                        {displayBuildings.filter((building) => building.propertyCount > 0 && building.titularCount > 0 && building.substituteCount > 0 && building.backupCount > 0).length}
                      </p>
                    </div>
                  </div>

                  {buildingsLoading ? (
                    <div className="flex min-h-48 items-center justify-center">
                      <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
                    </div>
                  ) : filteredBuildings.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-slate-300 p-5 text-sm text-slate-500">
                      No hay edificios que coincidan con el filtro actual.
                    </div>
                  ) : (
                    filteredBuildings.map((building) => {
                      const coverage = getBuildingCoverageState(building);

                      return (
                        <button
                          key={building.id}
                          type="button"
                          onClick={() => setSelectedBuildingId(building.id)}
                          className={`w-full rounded-2xl border p-4 text-left transition ${
                            selectedBuildingId === building.id
                              ? 'border-[#310984] bg-[#310984]/5 shadow-sm'
                              : 'border-slate-200 bg-white hover:border-slate-300'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="truncate text-base font-black text-slate-950">{building.displayName || building.name}</p>
                              <p className="mt-1 truncate text-sm text-slate-500">
                                {building.internalCode || 'Sin código'} · {building.zone || 'Sin zona'}
                              </p>
                            </div>
                            <Badge variant="outline">{building.propertyCount} props</Badge>
                          </div>
                          <div className="mt-3 flex flex-wrap gap-2 text-xs font-semibold text-slate-500">
                            <span>{building.titularCount} titulares</span>
                            <span>·</span>
                            <span>{building.substituteCount} suplentes</span>
                            <span>·</span>
                            <span>{building.backupCount} backups</span>
                          </div>
                          <div className="mt-3">
                            <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-black uppercase tracking-[0.18em] ${coverage.tone}`}>
                              {coverage.label}
                            </span>
                          </div>
                        </button>
                      );
                    })
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="gap-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <CardTitle className="text-xl font-black">Editor operativo</CardTitle>
                      <CardDescription>
                        {selectedBuilding
                          ? `Ajusta identidad, cobertura y propiedades de ${selectedBuilding.displayName || selectedBuilding.name}.`
                          : 'Selecciona un edificio para editarlo.'}
                      </CardDescription>
                    </div>
                    {selectedBuilding && (
                      <Button className="rounded-xl" onClick={handleSaveBuilding} disabled={updateGroup.isPending}>
                        {updateGroup.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                        Guardar edificio
                      </Button>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="space-y-6">
                  {!selectedBuilding ? (
                    <div className="rounded-2xl border border-dashed border-slate-300 p-8 text-sm text-slate-500">
                      Selecciona un edificio a la izquierda para editarlo.
                    </div>
                  ) : (
                    <>
                      <div className="grid gap-3 sm:grid-cols-4">
                        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                          <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">Propiedades</p>
                          <p className="mt-2 text-2xl font-black text-slate-950">{assignedProperties.length}</p>
                        </div>
                        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
                          <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-700">Titulares</p>
                          <p className="mt-2 text-2xl font-black text-slate-950">
                            {assignedCleaners.filter((entry) => (entry.assignment.roleType || 'primary') === 'primary').length}
                          </p>
                        </div>
                        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
                          <p className="text-xs font-black uppercase tracking-[0.18em] text-amber-700">Suplentes</p>
                          <p className="mt-2 text-2xl font-black text-slate-950">
                            {assignedCleaners.filter((entry) => entry.assignment.roleType === 'secondary').length}
                          </p>
                        </div>
                        <div className="rounded-2xl border border-sky-200 bg-sky-50 p-4">
                          <p className="text-xs font-black uppercase tracking-[0.18em] text-sky-700">Backups</p>
                          <p className="mt-2 text-2xl font-black text-slate-950">
                            {assignedCleaners.filter((entry) => entry.assignment.roleType === 'backup').length}
                          </p>
                        </div>
                      </div>

                      {selectedBuildingCoverage && (
                        <div className={`rounded-2xl border p-4 ${selectedBuildingCoverage.tone}`}>
                          <p className="text-xs font-black uppercase tracking-[0.2em]">Estado de cobertura</p>
                          <p className="mt-2 text-lg font-black">{selectedBuildingCoverage.label}</p>
                          <p className="mt-1 text-sm opacity-90">
                            El edificio necesita al menos propiedades vinculadas, personal titular y, preferiblemente, suplente y backup para quedar bien cubierto.
                          </p>
                        </div>
                      )}

                      <div className="grid gap-4 md:grid-cols-2">
                        <div className="space-y-2">
                          <Label>Nombre interno</Label>
                          <Input value={buildingForm.name} onChange={(e) => setBuildingForm((prev) => ({ ...prev, name: e.target.value }))} />
                        </div>
                        <div className="space-y-2">
                          <Label>Nombre visible</Label>
                          <Input value={buildingForm.displayName} onChange={(e) => setBuildingForm((prev) => ({ ...prev, displayName: e.target.value }))} />
                        </div>
                        <div className="space-y-2">
                          <Label>Código interno</Label>
                          <Input value={buildingForm.internalCode} onChange={(e) => setBuildingForm((prev) => ({ ...prev, internalCode: e.target.value }))} />
                        </div>
                        <div className="space-y-2">
                          <Label>Zona</Label>
                          <Input value={buildingForm.zone} onChange={(e) => setBuildingForm((prev) => ({ ...prev, zone: e.target.value }))} />
                        </div>
                        <div className="space-y-2">
                          <Label>Check-out tipo</Label>
                          <Input type="time" value={buildingForm.checkOutTime} onChange={(e) => setBuildingForm((prev) => ({ ...prev, checkOutTime: e.target.value }))} />
                        </div>
                        <div className="space-y-2">
                          <Label>Check-in tipo</Label>
                          <Input type="time" value={buildingForm.checkInTime} onChange={(e) => setBuildingForm((prev) => ({ ...prev, checkInTime: e.target.value }))} />
                        </div>
                        <div className="space-y-2">
                          <Label>Capacidad recomendada</Label>
                          <Input type="number" min={1} value={buildingForm.recommendedCapacity} onChange={(e) => setBuildingForm((prev) => ({ ...prev, recommendedCapacity: Number(e.target.value) || 1 }))} />
                        </div>
                        <div className="space-y-2">
                          <Label>Dificultad operativa</Label>
                          <Input type="number" min={1} max={5} value={buildingForm.difficultyLevel} onChange={(e) => setBuildingForm((prev) => ({ ...prev, difficultyLevel: Number(e.target.value) || 1 }))} />
                        </div>
                      </div>

                      <div className="grid gap-4 md:grid-cols-2">
                        <div className="space-y-2">
                          <Label>Instrucciones generales</Label>
                          <Textarea value={buildingForm.generalInstructions} onChange={(e) => setBuildingForm((prev) => ({ ...prev, generalInstructions: e.target.value }))} />
                        </div>
                        <div className="space-y-2">
                          <Label>Notas de planificación</Label>
                          <Textarea value={buildingForm.planningNotes} onChange={(e) => setBuildingForm((prev) => ({ ...prev, planningNotes: e.target.value }))} />
                        </div>
                      </div>

                      <div className="grid gap-4 lg:grid-cols-2">
                        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                          <div className="flex items-center justify-between gap-3">
                            <div>
                              <p className="text-sm font-black uppercase tracking-[0.18em] text-slate-500">Propiedades del edificio</p>
                              <p className="mt-1 text-sm text-slate-600">Asocia las propiedades que deben cubrirse como un mismo bloque operativo.</p>
                            </div>
                          </div>

                          <div className="mt-4 flex gap-2">
                            <Select value={newPropertyId} onValueChange={setNewPropertyId}>
                              <SelectTrigger className="rounded-xl bg-white">
                                <SelectValue placeholder="Añadir propiedad" />
                              </SelectTrigger>
                              <SelectContent>
                                {availableProperties.map((property) => (
                                  <SelectItem key={property.id} value={property.id}>
                                    {property.codigo} · {property.nombre}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <Button className="rounded-xl" onClick={handleAssignProperty} disabled={!newPropertyId || assignProperty.isPending}>
                              <Plus className="h-4 w-4" />
                            </Button>
                          </div>

                          <div className="mt-4 space-y-3">
                            {assignedProperties.length === 0 ? (
                              <div className="rounded-xl border border-dashed border-slate-300 bg-white p-4 text-sm text-slate-600">
                                <p className="font-black text-slate-950">Sin propiedades vinculadas.</p>
                                <p className="mt-1">Añade la primera propiedad para que el motor sepa qué tareas pertenecen a este edificio.</p>
                                <Button
                                  size="sm"
                                  className="mt-3 rounded-xl bg-[#310984] hover:bg-[#26066b]"
                                  onClick={handleAssignProperty}
                                  disabled={!newPropertyId || assignProperty.isPending}
                                >
                                  <Plus className="h-4 w-4" />
                                  Añadir propiedad
                                </Button>
                              </div>
                            ) : (
                              assignedProperties.map(({ assignmentId, property }) => (
                                <div key={assignmentId} className="rounded-xl border border-slate-200 bg-white p-3">
                                  <div className="flex items-start justify-between gap-3">
                                    <div>
                                      <p className="font-black text-slate-950">{property!.codigo}</p>
                                      <p className="text-sm text-slate-500">{property!.nombre}</p>
                                    </div>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="rounded-xl text-rose-600 hover:bg-rose-50 hover:text-rose-700"
                                      onClick={() => removeProperty.mutate({ assignmentId, groupId: selectedBuilding.id })}
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </div>

                                  <div className="mt-3 grid gap-2 md:grid-cols-3">
                                    <div className="space-y-1">
                                      <Label className="text-xs">Checkout min</Label>
                                      <Input
                                        type="number"
                                        min={0}
                                        defaultValue={property!.planningEstimatedCheckoutMinutes || property!.duracionServicio || 0}
                                        className="h-9 rounded-xl bg-white"
                                        onBlur={(e) =>
                                          updatePlanningPropertyProfile.mutate({
                                            propertyId: property!.id,
                                            updates: { planningEstimatedCheckoutMinutes: Number(e.target.value) || 0 },
                                          })
                                        }
                                      />
                                    </div>
                                    <div className="space-y-1">
                                      <Label className="text-xs">Stay min</Label>
                                      <Input
                                        type="number"
                                        min={0}
                                        defaultValue={property!.planningEstimatedStayMinutes || property!.duracionServicio || 0}
                                        className="h-9 rounded-xl bg-white"
                                        onBlur={(e) =>
                                          updatePlanningPropertyProfile.mutate({
                                            propertyId: property!.id,
                                            updates: { planningEstimatedStayMinutes: Number(e.target.value) || 0 },
                                          })
                                        }
                                      />
                                    </div>
                                    <div className="space-y-1">
                                      <Label className="text-xs">Personas</Label>
                                      <Input
                                        type="number"
                                        min={1}
                                        defaultValue={property!.planningRequiredCleaners || 1}
                                        className="h-9 rounded-xl bg-white"
                                        onBlur={(e) =>
                                          updatePlanningPropertyProfile.mutate({
                                            propertyId: property!.id,
                                            updates: { planningRequiredCleaners: Number(e.target.value) || 1 },
                                          })
                                        }
                                      />
                                    </div>
                                  </div>

                                  <div className="mt-3 grid gap-2 md:grid-cols-3">
                                    <div className="space-y-1">
                                      <Label className="text-xs">Complejidad</Label>
                                      <Input
                                        type="number"
                                        min={1}
                                        max={5}
                                        defaultValue={property!.planningComplexity || 1}
                                        className="h-9 rounded-xl bg-white"
                                        onBlur={(e) =>
                                          updatePlanningPropertyProfile.mutate({
                                            propertyId: property!.id,
                                            updates: { planningComplexity: Number(e.target.value) || 1 },
                                          })
                                        }
                                      />
                                    </div>
                                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                                      <div className="flex items-center justify-between gap-3">
                                        <div>
                                          <p className="text-xs font-black uppercase tracking-[0.12em] text-slate-500">Carga lencería</p>
                                        </div>
                                        <Switch
                                          checked={property!.planningRequiresLinenLoad ?? false}
                                          onCheckedChange={(checked) =>
                                            updatePlanningPropertyProfile.mutate({
                                              propertyId: property!.id,
                                              updates: { planningRequiresLinenLoad: checked },
                                            })
                                          }
                                        />
                                      </div>
                                    </div>
                                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                                      <div className="flex items-center justify-between gap-3">
                                        <div>
                                          <p className="text-xs font-black uppercase tracking-[0.12em] text-slate-500">Carga amenities</p>
                                        </div>
                                        <Switch
                                          checked={property!.planningRequiresAmenitiesLoad ?? false}
                                          onCheckedChange={(checked) =>
                                            updatePlanningPropertyProfile.mutate({
                                              propertyId: property!.id,
                                              updates: { planningRequiresAmenitiesLoad: checked },
                                            })
                                          }
                                        />
                                      </div>
                                    </div>
                                  </div>

                                  <div className="mt-3 space-y-1">
                                    <Label className="text-xs">Instrucciones especiales</Label>
                                    <Textarea
                                      defaultValue={property!.planningSpecialInstructions || ''}
                                      className="min-h-[88px] rounded-xl bg-white"
                                      onBlur={(e) =>
                                        updatePlanningPropertyProfile.mutate({
                                          propertyId: property!.id,
                                          updates: { planningSpecialInstructions: e.target.value || null },
                                        })
                                      }
                                    />
                                  </div>
                                </div>
                              ))
                            )}
                          </div>
                        </div>

                        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                          <p className="text-sm font-black uppercase tracking-[0.18em] text-slate-500">Cobertura humana</p>
                          <p className="mt-1 text-sm text-slate-600">Define titulares, suplentes y backups del edificio.</p>

                          <div className="mt-4 grid gap-2 md:grid-cols-[minmax(0,1fr)_160px_auto]">
                            <Select value={newCleanerId} onValueChange={setNewCleanerId}>
                              <SelectTrigger className="rounded-xl bg-white">
                                <SelectValue placeholder="Añadir trabajadora" />
                              </SelectTrigger>
                              <SelectContent>
                                {availableCleaners.map((cleaner) => (
                                  <SelectItem key={cleaner.id} value={cleaner.id}>
                                    {cleaner.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <Select value={newCleanerRole} onValueChange={(value: 'primary' | 'secondary' | 'backup') => setNewCleanerRole(value)}>
                              <SelectTrigger className="rounded-xl bg-white">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="primary">Titular</SelectItem>
                                <SelectItem value="secondary">Suplente</SelectItem>
                                <SelectItem value="backup">Backup</SelectItem>
                              </SelectContent>
                            </Select>
                            <Button className="rounded-xl" onClick={() => handleAssignCleaner()} disabled={!newCleanerId || assignCleaner.isPending}>
                              <Plus className="h-4 w-4" />
                            </Button>
                          </div>

                          <div className="mt-4 space-y-3">
                            {assignedCleaners.length === 0 ? (
                              <div className="rounded-xl border border-dashed border-slate-300 bg-white p-4 text-sm text-slate-600">
                                <p className="font-black text-slate-950">Sin equipo asignado.</p>
                                <p className="mt-1">Añade titulares para que el motor pueda cubrir este edificio con criterio.</p>
                                <Button
                                  size="sm"
                                  className="mt-3 rounded-xl bg-[#310984] hover:bg-[#26066b]"
                                  onClick={() => {
                                    handleAssignCleaner('primary');
                                  }}
                                  disabled={!newCleanerId || assignCleaner.isPending}
                                >
                                  <Plus className="h-4 w-4" />
                                  Añadir titular
                                </Button>
                              </div>
                            ) : (
                              assignedCleaners.map(({ assignment, cleaner }) => (
                                <div key={assignment.id} className="rounded-xl border border-slate-200 bg-white p-3">
                                  <div className="flex items-start justify-between gap-3">
                                    <div>
                                      <p className="font-black text-slate-950">{cleaner!.name}</p>
                                      <p className="text-sm text-slate-500">{cleaner!.planningZone || 'Sin zona operativa'}</p>
                                    </div>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="rounded-xl text-rose-600 hover:bg-rose-50 hover:text-rose-700"
                                      onClick={() => removeCleaner.mutate({ assignmentId: assignment.id, groupId: selectedBuilding.id })}
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </div>

                                  <div className="mt-3 grid gap-2 md:grid-cols-3">
                                    <div className="space-y-1">
                                      <Label className="text-xs">Rol</Label>
                                      <Select
                                        value={assignment.roleType || 'primary'}
                                        onValueChange={(value: 'primary' | 'secondary' | 'backup') =>
                                          updateCleanerAssignment.mutate({
                                            id: assignment.id,
                                            groupId: selectedBuilding.id,
                                            updates: { roleType: value },
                                          })
                                        }
                                      >
                                        <SelectTrigger className="h-9 rounded-xl bg-white">
                                          <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                          <SelectItem value="primary">Titular</SelectItem>
                                          <SelectItem value="secondary">Suplente</SelectItem>
                                          <SelectItem value="backup">Backup</SelectItem>
                                        </SelectContent>
                                      </Select>
                                    </div>
                                    <div className="space-y-1">
                                      <Label className="text-xs">Conocimiento</Label>
                                      <Input
                                        type="number"
                                        min={1}
                                        max={5}
                                        className="h-9 rounded-xl bg-white"
                                        value={assignment.knowledgeLevel || 3}
                                        onChange={(e) =>
                                          updateCleanerAssignment.mutate({
                                            id: assignment.id,
                                            groupId: selectedBuilding.id,
                                            updates: { knowledgeLevel: Number(e.target.value) || 3 },
                                          })
                                        }
                                      />
                                    </div>
                                    <div className="space-y-1">
                                      <Label className="text-xs">Máx tareas/día</Label>
                                      <Input
                                        type="number"
                                        min={1}
                                        className="h-9 rounded-xl bg-white"
                                        value={assignment.maxTasksPerDay || 8}
                                        onChange={(e) =>
                                          updateCleanerAssignment.mutate({
                                            id: assignment.id,
                                            groupId: selectedBuilding.id,
                                            updates: { maxTasksPerDay: Number(e.target.value) || 8 },
                                          })
                                        }
                                      />
                                    </div>
                                  </div>

                                  <div className="mt-3 grid gap-2 md:grid-cols-2">
                                    <div className="space-y-1">
                                      <Label className="text-xs">Capacidad diaria override (min)</Label>
                                      <Input
                                        type="number"
                                        min={0}
                                        step={30}
                                        className="h-9 rounded-xl bg-white"
                                        value={assignment.maxDailyMinutesOverride || 0}
                                        onChange={(e) =>
                                          updateCleanerAssignment.mutate({
                                            id: assignment.id,
                                            groupId: selectedBuilding.id,
                                            updates: { maxDailyMinutesOverride: Number(e.target.value) > 0 ? Number(e.target.value) : null },
                                          })
                                        }
                                      />
                                    </div>
                                    <div className="space-y-1">
                                      <Label className="text-xs">Traslado estimado (min)</Label>
                                      <Input
                                        type="number"
                                        min={0}
                                        step={5}
                                        className="h-9 rounded-xl bg-white"
                                        value={assignment.estimatedTravelTimeMinutes || 15}
                                        onChange={(e) =>
                                          updateCleanerAssignment.mutate({
                                            id: assignment.id,
                                            groupId: selectedBuilding.id,
                                            updates: { estimatedTravelTimeMinutes: Number(e.target.value) || 15 },
                                          })
                                        }
                                      />
                                    </div>
                                  </div>
                                </div>
                              ))
                            )}
                          </div>
                        </div>
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="coverage">
            <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
              <Card className="xl:col-span-2">
                <CardHeader>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <CardTitle className="text-xl font-black">Cubrir bajas y ausencias</CardTitle>
                      <CardDescription>El sistema propone quién puede cubrir cada hueco, ordenado por encaje operativo y con advertencias.</CardDescription>
                    </div>
                    <Badge variant={pendingSubstitutionCount > 0 ? 'destructive' : 'secondary'}>
                      {pendingSubstitutionCount} tareas sin cubrir
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {substitutionSuggestions.length === 0 ? (
                    <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
                      No hay ausencias que dejen tareas sin cubrir dentro del horizonte actual.
                    </div>
                  ) : (
                    substitutionSuggestions.map((absence) => (
                      <div key={absence.absenceId} className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <p className="text-base font-black text-slate-950">{absence.cleanerName}</p>
                            <p className="mt-1 text-sm text-slate-600">
                              {absenceTypeLabel(absence.absenceType)} · {formatLongDate(absence.startDate)}{absence.startDate !== absence.endDate ? ` → ${formatLongDate(absence.endDate)}` : ''}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-black text-slate-950">{absence.affectedTasks} tareas afectadas</p>
                            <p className="text-xs uppercase tracking-[0.18em] text-slate-500">
                              {absence.affectedBuildings.join(' · ')}
                            </p>
                          </div>
                        </div>

                        <div className="mt-4 grid gap-3 xl:grid-cols-2">
                          {absence.items.map((item) => (
                            <div key={item.taskId} className="rounded-2xl border border-white bg-white p-4 shadow-sm">
                              <div className="flex flex-wrap items-start justify-between gap-3">
                                <div>
                                  <p className="text-sm font-black uppercase tracking-[0.18em] text-slate-500">{formatLongDate(item.taskDate)}</p>
                                  <p className="mt-1 text-lg font-black text-slate-950">{item.propertyCode}</p>
                                  <p className="text-sm text-slate-600">{item.propertyGroupName || item.propertyName}</p>
                                </div>
                                <Badge variant="outline">{item.startTime} - {item.endTime}</Badge>
                              </div>

                              <div className="mt-3 rounded-2xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
                                <p className="font-semibold text-slate-900">{item.explanation}</p>
                                <p className="mt-2">
                                  Equipo actual disponible: <span className="font-bold">{item.availableAssignedCleanerNames.join(', ') || 'Nadie'}</span>
                                </p>
                                <p className="mt-1">
                                  Falta cubrir: <span className="font-bold">{item.missingCleaners} persona{item.missingCleaners > 1 ? 's' : ''}</span>
                                </p>
                              </div>

                              <div className="mt-3 space-y-2">
                                {item.recommendedCleaners.length === 0 ? (
                                  <div className="rounded-2xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">
                                    No hay candidata segura. Déjala para revisión manual.
                                  </div>
                                ) : (
                                  item.recommendedCleaners.map((candidate, index) => (
                                    <div key={`${item.taskId}-${candidate.cleanerId}`} className="rounded-2xl border border-slate-200 p-3">
                                      <div className="flex items-start justify-between gap-3">
                                        <div>
                                          <p className="font-black text-slate-950">
                                            {index + 1}. {candidate.cleanerName}
                                          </p>
                                          <p className="mt-1 text-sm text-slate-600">
                                            {candidate.reasons.join(' ')}
                                          </p>
                                        </div>
                                        <Badge className="bg-[#310984] text-white hover:bg-[#310984]">
                                          {candidate.score} pts
                                        </Badge>
                                      </div>
                                      {candidate.warnings.length > 0 && (
                                        <div className="mt-2 text-xs leading-5 text-amber-700">
                                          {candidate.warnings.join(' · ')}
                                        </div>
                                      )}
                                    </div>
                                  ))
                                )}
                              </div>

                              {item.warnings.length > 0 && (
                                <div className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-900">
                                  {item.warnings.join(' · ')}
                                </div>
                              )}

                              <Button
                                className="mt-4 w-full rounded-2xl"
                                disabled={item.recommendedCleaners.length === 0 || applyReplacement.isPending}
                                onClick={() => handleApplyReplacement(item)}
                              >
                                {applyReplacement.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
                                Cubrir baja
                              </Button>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-xl font-black">Días con más presión</CardTitle>
                  <CardDescription>Detecta días donde hará falta cubrir huecos antes de que llegue el problema.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {(overviewData?.overview.days || [])
                    .filter((day) => day.deficitMinutes > 0 || day.unassigned > 0 || day.criticalTasks > 0)
                    .sort((a, b) => b.deficitMinutes - a.deficitMinutes || b.unassigned - a.unassigned)
                    .map((day) => (
                      <div key={day.date} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-sm font-black uppercase tracking-[0.2em] text-slate-500">{formatLongDate(day.date)}</p>
                            <p className="mt-2 text-lg font-black text-slate-950">
                              {day.unassigned} sin cubrir · {day.criticalTasks} críticas
                            </p>
                          </div>
                          <Badge variant={day.deficitMinutes > 0 ? 'destructive' : 'secondary'}>
                            {day.deficitMinutes > 0 ? `${formatHours(day.deficitMinutes)} de déficit` : 'Revisión'}
                          </Badge>
                        </div>
                        <div className="mt-3 text-sm text-slate-600">
                          {formatHours(day.requiredMinutes)} necesarias · {formatHours(day.availableMinutes)} disponibles
                        </div>
                      </div>
                    ))}
                  {!(overviewData?.overview.days || []).some((day) => day.deficitMinutes > 0 || day.unassigned > 0 || day.criticalTasks > 0) && (
                    <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
                      No hay días especialmente tensos dentro del horizonte actual.
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-xl font-black">Vigilancia de equipo</CardTitle>
                  <CardDescription>Lectura rápida para detectar quién necesita cobertura o revisión de disponibilidad.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {[...workers]
                    .sort((a, b) => b.activeAbsenceCount - a.activeAbsenceCount || b.fixedDaysOffCount - a.fixedDaysOffCount)
                    .map((worker) => (
                      <div key={worker.id} className="rounded-2xl border border-slate-200 bg-white p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="font-black text-slate-950">{worker.name}</p>
                            <p className="text-sm text-slate-500">{worker.zone || 'Sin zona operativa'}</p>
                          </div>
                          <Badge variant={worker.activeAbsenceCount > 0 ? 'destructive' : worker.fixedDaysOffCount > 0 ? 'secondary' : 'outline'}>
                            {worker.activeAbsenceCount > 0
                              ? `${worker.activeAbsenceCount} ausencia${worker.activeAbsenceCount > 1 ? 's' : ''}`
                              : worker.fixedDaysOffCount > 0
                                ? `${worker.fixedDaysOffCount} día libre`
                                : 'Disponible'}
                          </Badge>
                        </div>
                        <div className="mt-3 space-y-1 text-sm text-slate-600">
                          <p>Capacidad diaria: <span className="font-bold text-slate-900">{formatHours(worker.maxDailyMinutes)}</span></p>
                          <p>Bloques fijos: <span className="font-bold text-slate-900">{worker.maintenanceCount}</span></p>
                        </div>
                        {worker.planningOperationalRestrictions && (
                          <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-900">
                            {worker.planningOperationalRestrictions}
                          </div>
                        )}
                      </div>
                    ))}
                </CardContent>
              </Card>

              <div className="space-y-4 xl:col-start-2">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-xl font-black">Perfil operativo</CardTitle>
                    <CardDescription>
                      Ajusta capacidad, zona y restricciones para que el motor proponga con mejor criterio.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label>Trabajadora</Label>
                      <Select value={selectedCoverageCleanerId || ''} onValueChange={setSelectedCoverageCleanerId}>
                        <SelectTrigger className="rounded-xl bg-white">
                          <SelectValue placeholder="Selecciona trabajadora" />
                        </SelectTrigger>
                        <SelectContent>
                          {[...workers].sort((a, b) => a.name.localeCompare(b.name)).map((worker) => (
                            <SelectItem key={worker.id} value={worker.id}>
                              {worker.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {selectedCoverageCleaner ? (
                      <>
                        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="font-black text-slate-950">{selectedCoverageCleaner.name}</p>
                              <p className="text-sm text-slate-500">{selectedCoverageCleaner.email || 'Sin email operativo'}</p>
                            </div>
                            <Badge
                              variant={
                                selectedCoverageAbsences.length > 0
                                  ? 'destructive'
                                  : selectedCoverageCleaner.planningOperationalRestrictions
                                    ? 'secondary'
                                    : 'outline'
                              }
                            >
                              {selectedCoverageAbsences.length > 0
                                ? `${selectedCoverageAbsences.length} ausencia${selectedCoverageAbsences.length > 1 ? 's' : ''}`
                                : 'Disponible'}
                            </Badge>
                          </div>
                        </div>

                        <div className="grid gap-4 md:grid-cols-2">
                          <div className="space-y-2">
                            <Label>Capacidad diaria (min)</Label>
                            <Input
                              type="number"
                              min={60}
                              step={30}
                              value={workerForm.planningMaxDailyMinutes}
                              onChange={(event) =>
                                setWorkerForm((prev) => ({
                                  ...prev,
                                  planningMaxDailyMinutes: Number(event.target.value) || 480,
                                }))
                              }
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Zona operativa</Label>
                            <Input
                              value={workerForm.planningZone}
                              onChange={(event) =>
                                setWorkerForm((prev) => ({ ...prev, planningZone: event.target.value }))
                              }
                              placeholder="Ej: Centro, Orzan, Marina..."
                            />
                          </div>
                        </div>

                        <div className="space-y-2">
                          <Label>Restricciones operativas</Label>
                          <Textarea
                            value={workerForm.planningOperationalRestrictions}
                            onChange={(event) =>
                              setWorkerForm((prev) => ({
                                ...prev,
                                planningOperationalRestrictions: event.target.value,
                              }))
                            }
                            placeholder="Ej: evitar cargas largas, no asignar edificios sin ascensor, solo mañanas..."
                          />
                        </div>

                        <div className="grid gap-3">
                          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                            <div className="flex items-center justify-between gap-4">
                              <div>
                                <p className="font-bold text-slate-900">Puede asumir carga de lenceria</p>
                                <p className="text-sm text-slate-500">Util para edificios con mas volumen o bolsas pesadas.</p>
                              </div>
                              <Switch
                                checked={workerForm.planningCanHandleLinenLoad}
                                onCheckedChange={(checked) =>
                                  setWorkerForm((prev) => ({ ...prev, planningCanHandleLinenLoad: checked }))
                                }
                              />
                            </div>
                          </div>

                          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                            <div className="flex items-center justify-between gap-4">
                              <div>
                                <p className="font-bold text-slate-900">Puede asumir limpiezas complejas</p>
                                <p className="text-sm text-slate-500">Permite priorizarla en propiedades mas exigentes o delicadas.</p>
                              </div>
                              <Switch
                                checked={workerForm.planningCanHandleComplexCleanings}
                                onCheckedChange={(checked) =>
                                  setWorkerForm((prev) => ({ ...prev, planningCanHandleComplexCleanings: checked }))
                                }
                              />
                            </div>
                          </div>
                        </div>

                        <Button
                          className="w-full rounded-2xl"
                          onClick={handleSaveWorkerProfile}
                          disabled={updatePlanningWorkerProfile.isPending}
                        >
                          {updatePlanningWorkerProfile.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                          Guardar perfil operativo
                        </Button>
                      </>
                    ) : (
                      <div className="rounded-2xl border border-dashed border-slate-300 p-5 text-sm text-slate-500">
                        Selecciona una trabajadora para editar su perfil operativo.
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="gap-3">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <CardTitle className="text-xl font-black">Ausencias y cobertura</CardTitle>
                        <CardDescription>Registra bajas, vacaciones o bloqueos parciales sin salir del modulo.</CardDescription>
                      </div>
                      <Button
                        variant="outline"
                        className="rounded-xl"
                        onClick={() => setAbsenceModalOpen(true)}
                        disabled={!selectedCoverageCleaner}
                      >
                        <Plus className="h-4 w-4" />
                        Nueva ausencia
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {selectedCoverageCleaner ? (
                      <>
                        <div className="grid gap-2 sm:grid-cols-3">
                          {Object.entries(ABSENCE_TYPE_CONFIG)
                            .filter(([key]) => selectedCoverageAbsences.some((absence) => absence.absenceType === key))
                            .map(([key, config]) => {
                              const count = selectedCoverageAbsences.filter((absence) => absence.absenceType === key).length;
                              return (
                                <div
                                  key={key}
                                  className="rounded-2xl border p-3 text-sm"
                                  style={{ borderColor: `${config.color}55`, backgroundColor: `${config.color}10` }}
                                >
                                  <p className="font-black" style={{ color: config.color }}>
                                    {config.label}
                                  </p>
                                  <p className="mt-1 text-slate-700">{count} registrada{count > 1 ? 's' : ''}</p>
                                </div>
                              );
                            })}
                        </div>
                        <AbsencesList
                          cleanerId={selectedCoverageCleaner.id}
                          absences={selectedCoverageAbsences}
                          isLoading={selectedCoverageAbsencesLoading}
                        />
                      </>
                    ) : (
                      <div className="rounded-2xl border border-dashed border-slate-300 p-5 text-sm text-slate-500">
                        Selecciona una trabajadora para revisar sus ausencias dentro del horizonte de planificación.
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </div>
            {selectedCoverageCleaner && (
              <CreateAbsenceModal
                open={absenceModalOpen}
                onOpenChange={setAbsenceModalOpen}
                cleanerId={selectedCoverageCleaner.id}
                cleanerName={selectedCoverageCleaner.name}
              />
            )}
          </TabsContent>

          <TabsContent value="performance">
            <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
              <Card>
                <CardHeader>
                  <CardTitle className="text-xl font-black">Dashboard de rendimiento</CardTitle>
                  <CardDescription>Mide cuánto está ayudando el sistema y dónde sigue necesitando más inteligencia operativa.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-5">
                  <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                    <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
                      <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-700">% automático</p>
                      <p className="mt-2 text-3xl font-black text-slate-950">{performance?.automationRate ?? 0}%</p>
                      <p className="mt-1 text-sm text-slate-600">Tareas propuestas sin intervención manual</p>
                    </div>
                    <div className="rounded-2xl border border-sky-200 bg-sky-50 p-4">
                      <p className="text-xs font-black uppercase tracking-[0.18em] text-sky-700">Borradores aprobados</p>
                      <p className="mt-2 text-3xl font-black text-slate-950">{performance?.approvedRuns ?? 0}</p>
                      <p className="mt-1 text-sm text-slate-600">Últimos 30 días</p>
                    </div>
                    <div className="rounded-2xl border border-violet-200 bg-violet-50 p-4">
                      <p className="text-xs font-black uppercase tracking-[0.18em] text-violet-700">Tareas planificadas</p>
                      <p className="mt-2 text-3xl font-black text-slate-950">{performance?.plannedTasks ?? 0}</p>
                      <p className="mt-1 text-sm text-slate-600">Aplicadas desde el módulo</p>
                    </div>
                    <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
                      <p className="text-xs font-black uppercase tracking-[0.18em] text-amber-700">Tiempo ahorrado</p>
                      <p className="mt-2 text-3xl font-black text-slate-950">
                        {performance ? formatHours(performance.estimatedTimeSavedMinutes) : '0 h'}
                      </p>
                      <p className="mt-1 text-sm text-slate-600">Estimación frente a asignación manual</p>
                    </div>
                  </div>

                  <div className="grid gap-4 xl:grid-cols-2">
                    <Card className="border-slate-200 shadow-none">
                      <CardHeader>
                        <CardTitle className="text-lg font-black">Edificios con más conflictos</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        {(performance?.buildingsWithMostConflicts || []).length === 0 ? (
                          <div className="rounded-2xl border border-dashed border-slate-300 p-4 text-sm text-slate-500">
                            Aún no hay histórico suficiente de conflictos.
                          </div>
                        ) : (
                          performance?.buildingsWithMostConflicts.map((building) => (
                            <div key={building.propertyGroupId || building.propertyGroupName} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                              <div className="flex items-center justify-between gap-3">
                                <p className="font-black text-slate-950">{building.propertyGroupName}</p>
                                <Badge variant="secondary">{building.conflictCount} conflictos</Badge>
                              </div>
                            </div>
                          ))
                        )}
                      </CardContent>
                    </Card>

                    <Card className="border-slate-200 shadow-none">
                      <CardHeader>
                        <CardTitle className="text-lg font-black">Trabajadoras sobrecargadas</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        {(performance?.overloadedWorkers || []).length === 0 ? (
                          <div className="rounded-2xl border border-dashed border-slate-300 p-4 text-sm text-slate-500">
                            No hay sobrecargas fuertes dentro del horizonte actual.
                          </div>
                        ) : (
                          performance?.overloadedWorkers.map((worker) => (
                            <div key={worker.cleanerId} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                              <div className="flex items-center justify-between gap-3">
                                <p className="font-black text-slate-950">{worker.cleanerName}</p>
                                <Badge variant={worker.utilizationPercent >= 100 ? 'destructive' : 'secondary'}>
                                  {worker.utilizationPercent}%
                                </Badge>
                              </div>
                              <p className="mt-2 text-sm text-slate-600">
                                Pico de {formatHours(worker.assignedMinutes)} sobre {formatHours(worker.maxDailyMinutes)} · {worker.affectedDays} día{worker.affectedDays > 1 ? 's' : ''} afectado{worker.affectedDays > 1 ? 's' : ''}
                              </p>
                            </div>
                          ))
                        )}
                      </CardContent>
                    </Card>
                  </div>
                </CardContent>
              </Card>

              <div className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg font-black">Días más problemáticos</CardTitle>
                    <CardDescription>Los que más conviene revisar primero si hoy fueras a replantear la semana.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {(performance?.pressureDays || []).map((day) => (
                      <div key={day.date} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="font-black text-slate-950">{formatLongDate(day.date)}</p>
                            <p className="mt-1 text-sm text-slate-600">
                              {day.unassigned} sin cubrir · {day.criticalTasks} críticas
                            </p>
                          </div>
                          <Badge variant={day.deficitMinutes > 0 ? 'destructive' : 'secondary'}>
                            {day.pressureScore} pts
                          </Badge>
                        </div>
                        <p className="mt-2 text-sm text-slate-600">
                          {formatHours(day.requiredMinutes)} necesarias · {formatHours(day.availableMinutes)} disponibles
                        </p>
                      </div>
                    ))}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg font-black">Lectura rápida</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3 text-sm leading-6 text-slate-600">
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                      <p>
                        El porcentaje automático mide cuántas tareas quedaron cubiertas por el motor dentro de los borradores aprobados.
                      </p>
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                      <p>
                        El tiempo ahorrado es una estimación conservadora comparando la propuesta automática con una planificación manual tarea a tarea.
                      </p>
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                      <p>
                        Si un mismo edificio o una misma trabajadora aparecen repetidamente aquí, ya tenemos una pista clara de dónde mejorar reglas y cobertura.
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="rules">
            <Card>
              <CardHeader>
                <CardTitle className="text-xl font-black">Reglas del motor</CardTitle>
                <CardDescription>
                  Ajusta el margen operativo y el comportamiento del borrador sin tocar código.
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_280px]">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="planning-horizon">Horizonte (días)</Label>
                    <Input
                      id="planning-horizon"
                      type="number"
                      min={1}
                      max={30}
                      value={horizonDays}
                      onChange={(event) => setHorizonDays(Number(event.target.value))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="planning-buffer">Margen de seguridad (minutos)</Label>
                    <Input
                      id="planning-buffer"
                      type="number"
                      min={0}
                      step={5}
                      value={bufferMinutes}
                      onChange={(event) => setBufferMinutes(Number(event.target.value))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="planning-fallback">Capacidad diaria por defecto (minutos)</Label>
                    <Input
                      id="planning-fallback"
                      type="number"
                      min={60}
                      step={30}
                      value={fallbackDailyCapacityMinutes}
                      onChange={(event) => setFallbackDailyCapacityMinutes(Number(event.target.value))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="planning-weekly-tolerance">Tolerancia semanal (%)</Label>
                    <Input
                      id="planning-weekly-tolerance"
                      type="number"
                      min={0}
                      max={100}
                      value={weeklyTolerancePercent}
                      onChange={(event) => setWeeklyTolerancePercent(Number(event.target.value))}
                    />
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <p className="font-bold text-slate-900">Permitir backups</p>
                        <p className="text-sm text-slate-500">Solo si titulares y suplentes no bastan.</p>
                      </div>
                      <Switch checked={allowBackups} onCheckedChange={setAllowBackups} />
                    </div>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <p className="font-bold text-slate-900">Excluir extraordinarias</p>
                        <p className="text-sm text-slate-500">MVP solo para limpiezas turísticas normales.</p>
                      </div>
                      <Switch checked={excludeExtraordinary} onCheckedChange={setExcludeExtraordinary} />
                    </div>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 md:col-span-2">
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <p className="font-bold text-slate-900">Aprobación obligatoria</p>
                        <p className="text-sm text-slate-500">Nada se aplica a tareas reales hasta revisar el borrador.</p>
                      </div>
                      <Switch checked={approvalRequired} onCheckedChange={setApprovalRequired} />
                    </div>
                  </div>
                </div>

                <div className="rounded-3xl border border-[#310984]/10 bg-[#310984] p-5 text-white">
                  <p className="text-xs font-black uppercase tracking-[0.22em] text-white/60">Motor actual</p>
                  <div className="mt-4 space-y-3 text-sm leading-6 text-white/80">
                    <p>1. Prioriza titulares y suplentes del edificio.</p>
                    <p>2. Revisa capacidad diaria, ausencias y días libres.</p>
                    <p>3. Valida la ventana entre check-out y check-in.</p>
                    <p>4. Si no ve una opción segura, no fuerza la asignación.</p>
                  </div>
                  <Button
                    className="mt-6 w-full rounded-2xl bg-white text-[#310984] hover:bg-white/90"
                    onClick={handleSaveSettings}
                    disabled={saveSettings.isPending}
                  >
                    {saveSettings.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Clock3 className="h-4 w-4" />}
                    Guardar reglas
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {!activeSede?.id && (
          <Card className="border-amber-200 bg-amber-50">
            <CardContent className="flex items-center gap-3 p-5 text-amber-900">
              <AlertTriangle className="h-5 w-5" />
              <p>Necesitas una sede activa para usar el módulo de planificación.</p>
            </CardContent>
          </Card>
        )}

        <AlertDialog open={approveDialogOpen} onOpenChange={setApproveDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Aprobar planificación</AlertDialogTitle>
              <AlertDialogDescription>
                Se asignarán {preview?.run.summary.proposedTasks ?? 0} tareas reales y se prepararán los avisos agrupados para las trabajadoras.
                Revisa el borrador antes de continuar: esta acción ya cambia la planificación operativa.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Seguir revisando</AlertDialogCancel>
              <AlertDialogAction
                className="bg-[#310984] hover:bg-[#26066b]"
                disabled={approveRun.isPending || !preview}
                onClick={() => {
                  if (!preview) return;
                  approveRun.mutate(preview.run.id);
                }}
              >
                {approveRun.isPending ? 'Aprobando...' : 'Aprobar y enviar avisos'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
};

