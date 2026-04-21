import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useSede } from '@/contexts/SedeContext';
import { addDays, format, parseISO } from 'date-fns';
import { formatMadridDate } from '@/utils/date';
import { useStaffingTargets } from './useStaffingTargets';

const TURNO_MEDIO_HORAS = 6;
const ANOMALY_THRESHOLD_CHECKOUTS = 100; // checkouts/día sospechosos
const DEFAULT_DURATION_HOURS = 1.5;

export type ForecastStatus = 'green' | 'yellow' | 'red' | 'idle';

export interface ForecastDay {
  date: string; // YYYY-MM-DD
  dayOfWeek: number; // 0-6
  checkoutsAvantio: number;
  checkoutsInternos: number;
  checkoutsTotal: number;
  cargaHoras: number;
  capacidadHoras: number;
  cobertura: number; // 0..N (1 = exacto)
  estado: ForecastStatus;
  deficitHoras: number;
  deficitPersonas: number;
  workersAvailable: number;
  workersAbsent: number;
  minWorkersTarget: number;
  minHoursTarget: number;
  isAnomaly: boolean;
  isHoliday: boolean;
  // Horas REALES de tareas creadas en el día
  horasTareasTotal: number;       // suma duración de TODAS las tareas
  horasTareasAsignadas: number;   // suma duración de tareas con cleaner_id
  tareasTotal: number;
  tareasAsignadas: number;
}

export interface StaffingForecast {
  days: ForecastDay[];
  rangeStart: string;
  rangeEnd: string;
  summary: {
    totalDays: number;
    redDays: number;
    yellowDays: number;
    greenDays: number;
    worstDay?: ForecastDay;
    anomalies: number;
  };
}

// Festivos hardcodeados España + Comunidad Valenciana 2025-2026
const HOLIDAYS = new Set<string>([
  '2025-01-01','2025-01-06','2025-04-18','2025-05-01','2025-08-15',
  '2025-10-09','2025-10-12','2025-11-01','2025-12-06','2025-12-08','2025-12-25',
  '2026-01-01','2026-01-06','2026-03-19','2026-04-03','2026-05-01','2026-08-15',
  '2026-10-09','2026-10-12','2026-11-01','2026-12-06','2026-12-08','2026-12-25',
]);

const computeStatus = (
  cargaHoras: number,
  capacidadHoras: number,
  workersAvailable: number,
  minWorkers: number
): ForecastStatus => {
  if (cargaHoras === 0) return 'idle';
  const cobertura = capacidadHoras / cargaHoras;
  const workersOk = workersAvailable >= minWorkers;
  if (cobertura >= 1.1 && workersOk) return 'green';
  if (cobertura >= 0.9 && workersOk) return 'yellow';
  return 'red';
};

export const useStaffingForecast = (rangeDays: number = 45) => {
  const { activeSede } = useSede();
  const sedeId = activeSede?.id ?? null;
  const { data: targets } = useStaffingTargets();

  return useQuery({
    queryKey: ['staffing-forecast', sedeId, rangeDays, targets?.length ?? 0],
    enabled: !!sedeId,
    staleTime: 5 * 60 * 1000,
    queryFn: async (): Promise<StaffingForecast> => {
      const today = new Date();
      const rangeStart = formatMadridDate(today);
      const rangeEnd = formatMadridDate(addDays(today, rangeDays - 1));

      // 1) Reservas Avantio (checkouts en rango)
      const { data: avantio, error: avErr } = await supabase
        .from('avantio_reservations')
        .select('departure_date, status, property_id, properties(duracion_servicio, sede_id)')
        .gte('departure_date', rangeStart)
        .lte('departure_date', rangeEnd)
        .in('status', ['confirmed', 'CONFIRMED', 'reserved', 'RESERVED']);
      if (avErr) throw avErr;

      // 2) Reservas internas (clientes)
      const { data: internas, error: intErr } = await supabase
        .from('client_reservations')
        .select('check_out_date, status, property_id, properties(duracion_servicio, sede_id)')
        .gte('check_out_date', rangeStart)
        .lte('check_out_date', rangeEnd)
        .neq('status', 'cancelled');
      if (intErr) throw intErr;

      // 3) Disponibilidad por día de semana de cleaners de la sede
      let cleanersQ = supabase
        .from('cleaners')
        .select('id, sede_id')
        .eq('is_active', true);
      if (sedeId) cleanersQ = cleanersQ.eq('sede_id', sedeId);
      const { data: cleaners, error: clErr } = await cleanersQ;
      if (clErr) throw clErr;
      const cleanerIds = (cleaners ?? []).map(c => c.id);

      const { data: availability, error: avlErr } = cleanerIds.length
        ? await supabase
            .from('cleaner_availability')
            .select('*')
            .in('cleaner_id', cleanerIds)
        : { data: [], error: null };
      if (avlErr) throw avlErr;

      // 4) Ausencias confirmadas en el rango
      const { data: absences, error: absErr } = cleanerIds.length
        ? await supabase
            .from('worker_absences')
            .select('cleaner_id, start_date, end_date')
            .in('cleaner_id', cleanerIds)
            .lte('start_date', rangeEnd)
            .gte('end_date', rangeStart)
        : { data: [], error: null };
      if (absErr) throw absErr;

      // Helper: mins entre HH:MM:SS
      const hoursBetween = (start: string | null, end: string | null) => {
        if (!start || !end) return 0;
        const [sh, sm] = start.split(':').map(Number);
        const [eh, em] = end.split(':').map(Number);
        return Math.max(0, (eh * 60 + em - sh * 60 - sm) / 60);
      };

      const targetMap = new Map<number, { min_workers: number; min_hours: number }>();
      (targets ?? []).forEach(t => {
        targetMap.set(t.day_of_week, { min_workers: t.min_workers, min_hours: Number(t.min_hours) });
      });

      const days: ForecastDay[] = [];
      for (let i = 0; i < rangeDays; i++) {
        const d = addDays(today, i);
        const dateStr = formatMadridDate(d);
        const dow = d.getDay();

        // Carga (filtrada por sede si aplica)
        const checkoutsAvantio = (avantio ?? []).filter((r: any) => {
          if (r.departure_date !== dateStr) return false;
          if (sedeId && r.properties?.sede_id && r.properties.sede_id !== sedeId) return false;
          return true;
        });
        const checkoutsInternos = (internas ?? []).filter((r: any) => {
          if (r.check_out_date !== dateStr) return false;
          if (sedeId && r.properties?.sede_id && r.properties.sede_id !== sedeId) return false;
          return true;
        });

        const cargaHoras =
          checkoutsAvantio.reduce(
            (s: number, r: any) => s + (Number(r.properties?.duracion_servicio) || DEFAULT_DURATION_HOURS),
            0
          ) +
          checkoutsInternos.reduce(
            (s: number, r: any) => s + (Number(r.properties?.duracion_servicio) || DEFAULT_DURATION_HOURS),
            0
          );

        // Capacidad
        const absentToday = new Set(
          (absences ?? [])
            .filter((a: any) => a.start_date <= dateStr && a.end_date >= dateStr)
            .map((a: any) => a.cleaner_id)
        );
        let capacidadHoras = 0;
        let workersAvailable = 0;
        cleanerIds.forEach(cid => {
          if (absentToday.has(cid)) return;
          const av = (availability ?? []).find(
            (a: any) => a.cleaner_id === cid && a.day_of_week === dow
          );
          if (av && av.is_available) {
            capacidadHoras += hoursBetween(av.start_time, av.end_time);
            workersAvailable += 1;
          }
        });

        const target = targetMap.get(dow) ?? { min_workers: 2, min_hours: 12 };
        const checkoutsTotal = checkoutsAvantio.length + checkoutsInternos.length;
        const isAnomaly = checkoutsTotal > ANOMALY_THRESHOLD_CHECKOUTS;
        const cobertura = cargaHoras > 0 ? capacidadHoras / cargaHoras : 0;
        const estado = computeStatus(cargaHoras, capacidadHoras, workersAvailable, target.min_workers);
        const deficitHoras = Math.max(0, cargaHoras - capacidadHoras);
        const deficitPersonas = Math.ceil(deficitHoras / TURNO_MEDIO_HORAS);

        days.push({
          date: dateStr,
          dayOfWeek: dow,
          checkoutsAvantio: checkoutsAvantio.length,
          checkoutsInternos: checkoutsInternos.length,
          checkoutsTotal,
          cargaHoras: Math.round(cargaHoras * 10) / 10,
          capacidadHoras: Math.round(capacidadHoras * 10) / 10,
          cobertura: Math.round(cobertura * 100) / 100,
          estado,
          deficitHoras: Math.round(deficitHoras * 10) / 10,
          deficitPersonas,
          workersAvailable,
          workersAbsent: absentToday.size,
          minWorkersTarget: target.min_workers,
          minHoursTarget: target.min_hours,
          isAnomaly,
          isHoliday: HOLIDAYS.has(dateStr),
        });
      }

      const redDays = days.filter(d => d.estado === 'red').length;
      const yellowDays = days.filter(d => d.estado === 'yellow').length;
      const greenDays = days.filter(d => d.estado === 'green').length;
      const worstDay = days
        .filter(d => d.estado === 'red')
        .sort((a, b) => b.deficitHoras - a.deficitHoras)[0];
      const anomalies = days.filter(d => d.isAnomaly).length;

      return {
        days,
        rangeStart,
        rangeEnd,
        summary: {
          totalDays: days.length,
          redDays,
          yellowDays,
          greenDays,
          worstDay,
          anomalies,
        },
      };
    },
  });
};

export const useDayForecast = (date: string | null) => {
  const { data, ...rest } = useStaffingForecast(60);
  const day = data?.days.find(d => d.date === date) ?? null;
  return { day, ...rest };
};
