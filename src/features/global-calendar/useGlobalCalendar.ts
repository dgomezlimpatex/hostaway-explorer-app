import { useMemo } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useSede } from '@/contexts/SedeContext';
import { useProperties } from '@/hooks/useProperties';
import {
  buildWeek,
  mergeReservations,
  toCleaning,
  weekDaysFrom,
  type CalendarProperty,
  type CalendarWeek,
  type Cleaning,
  type ReservationIssue,
} from './globalCalendarModel';
import {
  buildingByProperty,
  incompleteChecker,
  readBuildingAssignments,
  readWeekReservations,
  readWeekTasks,
  type ReadOnlyDb,
  type SourceCoverage,
  type UnmappedCount,
} from './globalCalendarReads';

const db = supabase as unknown as ReadOnlyDb;

export interface GlobalCalendarData {
  week: CalendarWeek;
  weekStart: string;
  /** Las limpiezas no se pudieron leer o llegaron truncadas. */
  cleaningsState: 'ok' | 'error' | 'truncated';
  coverage: SourceCoverage[];
  unmapped: UnmappedCount[];
  invalidReservations: ReservationIssue[];
  cancelledReservations: number;
  buildingsAvailable: boolean;
  isIncomplete: (propertyId: string) => boolean;
}

export function useGlobalCalendar(weekStart: string) {
  const { activeSede, isInitialized, loading } = useSede();
  const sedeId = activeSede?.id ?? null;
  const enabled = isInitialized && !loading && !!sedeId;
  const propertiesQuery = useProperties();

  const buildingsQuery = useQuery({
    queryKey: ['global-calendar', 'buildings'],
    queryFn: ({ signal }) => readBuildingAssignments(db, signal),
    enabled,
    staleTime: 5 * 60_000,
  });

  const weekQuery = useQuery({
    queryKey: ['global-calendar', 'week', sedeId, weekStart],
    queryFn: async ({ signal }) => {
      const days = weekDaysFrom(weekStart);
      const range = { from: days[0], to: days[6] };
      const [tasks, reservations] = await Promise.all([
        readWeekTasks(db, sedeId as string, range, signal),
        readWeekReservations(db, range, signal),
      ]);
      return { weekStart, tasks, reservations };
    },
    enabled,
    placeholderData: keepPreviousData,
    staleTime: 60_000,
    refetchOnWindowFocus: true,
  });

  const data = useMemo<GlobalCalendarData | null>(() => {
    const properties = propertiesQuery.data;
    const loaded = weekQuery.data;
    if (!properties || !loaded) return null;
    const buildingRead = buildingsQuery.data;
    const buildings = buildingRead?.state === 'ok' ? buildingByProperty(buildingRead.rows) : new Map<string, { id: string; name: string }>();
    const calendarProperties: CalendarProperty[] = properties.map((property) => {
      const building = buildings.get(property.id);
      return {
        id: property.id,
        name: property.nombre?.trim() || 'Propiedad sin nombre',
        code: property.codigo?.trim() || '',
        clientId: property.clienteId || null,
        clientName: property.clientName?.trim() || null,
        buildingId: building?.id ?? null,
        buildingName: building?.name ?? null,
        isActive: property.isActive !== false,
        defaultCheckIn: property.checkInPredeterminado?.slice(0, 5) || null,
        defaultCheckOut: property.checkOutPredeterminado?.slice(0, 5) || null,
      };
    });
    const propertyIds = new Set(calendarProperties.map((property) => property.id));
    const { reservations, tasks } = loaded;
    const merged = mergeReservations(reservations.raws.filter((raw) => propertyIds.has(raw.propertyId)));
    const isIncomplete = incompleteChecker(reservations.coverage);
    const cleanings: Cleaning[] = tasks.state === 'ok'
      ? tasks.rows.map(toCleaning).filter((cleaning): cleaning is Cleaning => !!cleaning)
      : [];
    const week = buildWeek({
      weekDays: weekDaysFrom(loaded.weekStart),
      properties: calendarProperties,
      stays: merged.stays,
      cleanings,
      isIncomplete,
    });
    return {
      week,
      weekStart: loaded.weekStart,
      cleaningsState: tasks.state === 'error' ? 'error' : tasks.truncated ? 'truncated' : 'ok',
      coverage: reservations.coverage,
      unmapped: reservations.unmapped,
      invalidReservations: merged.issues,
      cancelledReservations: merged.cancelled,
      buildingsAvailable: buildingRead?.state === 'ok',
      isIncomplete,
    };
  }, [propertiesQuery.data, weekQuery.data, buildingsQuery.data]);

  const status: 'loading' | 'error' | 'ready' =
    propertiesQuery.isError || weekQuery.isError ? 'error' : data ? 'ready' : 'loading';

  return {
    status,
    data,
    sedeName: activeSede?.nombre ?? null,
    /** Se está cargando otra semana mientras se muestra la anterior. */
    isSwitching: weekQuery.isPlaceholderData || (weekQuery.isFetching && data?.weekStart !== weekStart),
    isRefreshing: weekQuery.isFetching,
    buildingsLoading: buildingsQuery.isLoading,
    refetch: () => {
      void propertiesQuery.refetch();
      void buildingsQuery.refetch();
      void weekQuery.refetch();
    },
  };
}
